import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import { cache } from "react";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { AccountVisibility } from "@/interfaces/general.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { loginSchema, RESERVED_USERNAMES } from "@/lib/validations";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import { verifyPassword } from "@/server/password";
import { clientIp, rateLimit } from "@/server/ratelimit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      profilePicture: ProfilePicture | null;
      profileComplete: boolean;
      visibility: AccountVisibility;
    } & DefaultSession["user"];
  }
  interface User {
    rememberMe?: boolean;
  }
}

// Can't augment `next-auth/jwt`: it re-exports `@auth/core`, which pnpm doesn't
// expose to the app. `expiresAt` is epoch ms and slides forward on every
// session read, like NextAuth's own maxAge.
type SessionToken = { rememberMe?: boolean; expiresAt?: number };

/**
 * The layout, the page and its components each call auth(); within one
 * render they share this read instead of querying the user row each time.
 * Retries twice: under load Neon briefly refuses new connections.
 */
const findUser = cache(async (id: string) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.query.users.findFirst({ where: eq(users.id, id) });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
});

/** Reaches the client as `signIn(...).code`. */
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = { remembered: 30, default: 7 };

/**
 * Turn an email into a username that isn't taken yet. Same alphabet as the
 * username schema: a dot would also make `/john.doe` look like a static file.
 */
async function uniqueUsername(seed: string) {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";

  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}${Math.random().toString(36).slice(2, 6)}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }

  return `${base}${Date.now().toString(36)}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The cast is needed because this `users` table has no `name`/`image` columns;
  // the adapter only writes the fields it is handed, so it is fine at runtime.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as never),
  // Credentials sign-in only works with JWT sessions. The token just carries the
  // user id; the `session` callback reads the row fresh so it is never stale.
  // maxAge is the cookie's ceiling; the `jwt` callback enforces the shorter
  // per-login lifetime ("Remember me" or not).
  session: { strategy: "jwt", maxAge: SESSION_DAYS.remembered * DAY / 1000 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      // Maps Google's profile onto our `users` columns, since this schema has no
      // `name`/`image` columns for the adapter to write into.
      async profile(profile) {
        const [fallbackFirst, ...fallbackRest] = (profile.name ?? "").split(" ");
        return {
          id: profile.sub,
          email: profile.email,
          firstName: profile.given_name ?? fallbackFirst ?? "",
          lastName: profile.family_name ?? fallbackRest.join(" ") ?? "",
          username: await uniqueUsername(profile.email.split("@")[0]!),
          emailVerified: profile.email_verified ? new Date() : null,
          profilePicture: profile.picture ? { url: profile.picture } : null,
          profileComplete: false,
          visibility: AccountVisibility.PUBLIC,
        };
      },
    }),
    Credentials({
      credentials: { email: {}, password: {}, rememberMe: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema
          .pick({ email: true, password: true })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        if (await rateLimit("login", `${clientIp(request)}:${email}`)) {
          throw new TooManyAttempts();
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        // Google-only accounts have no password.
        if (!user?.password) return null;
        if (!(await verifyPassword(parsed.data.password, user.password))) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          rememberMe: credentials.rememberMe === "true",
        };
      },
    }),
  ],
  callbacks: {
    // `allowDangerousEmailAccountLinking` links Google to an existing account
    // with the same email. Password sign-ups don't verify their email, so
    // linking one would let whoever registered someone else's address keep a
    // password into the real owner's account. Only link verified accounts.
    signIn: async ({ account, profile }) => {
      if (account?.provider !== "google" || !profile?.email) return true;

      const existing = await db.query.users.findFirst({
        where: eq(users.email, profile.email.toLowerCase()),
        columns: { id: true, password: true, emailVerified: true },
      });
      if (!existing?.password || existing.emailVerified) return true;

      const alreadyLinked = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.userId, existing.id),
          eq(accounts.provider, "google"),
        ),
        columns: { userId: true },
      });
      return alreadyLinked ? true : "/?error=use-password";
    },
    jwt: ({ token: jwt, user }) => {
      const token = jwt as typeof jwt & SessionToken;
      // Sign-in: Google has no checkbox, so it gets the long session.
      if (user) token.rememberMe = user.rememberMe ?? true;
      // Returning null clears the session cookie (signs the user out).
      if (token.expiresAt && Date.now() > token.expiresAt) return null;
      const days = token.rememberMe
        ? SESSION_DAYS.remembered
        : SESSION_DAYS.default;
      token.expiresAt = Date.now() + days * DAY;
      return token;
    },
    session: async ({ session, token }) => {
      // A failed read counts as signed out for this request only. Throwing
      // would make Auth.js delete the session cookie: a DB blip logging
      // everyone out.
      const row = token.sub
        ? await findUser(token.sub).catch(() => undefined)
        : undefined;
      // Deleted user: return the session without app fields; `auth()` callers
      // should treat a missing `user.id` as signed out.
      if (!row) return { ...session, user: undefined as never };
      return {
        ...session,
        expires: new Date(
          (token as SessionToken).expiresAt!,
        ).toISOString() as never,
        user: {
          ...session.user,
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          username: row.username,
          profilePicture: row.profilePicture,
          profileComplete: row.profileComplete,
          visibility: row.visibility,
        },
      };
    },
  },
  pages: { signIn: "/", error: "/" },
});
