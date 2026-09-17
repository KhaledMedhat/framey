import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

import { AccountVisibility } from "@/interfaces/general.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

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
      slug: string | null;
    } & DefaultSession["user"];
  }
}

/** Turn an email/name into a username that isn't taken yet. */
async function uniqueUsername(seed: string) {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, "")
      .slice(0, 20) || "user";

  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}${Math.random().toString(36).slice(2, 6)}`;
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
  session: { strategy: "database" },
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
  ],
  callbacks: {
    // Database sessions: `user` is the row, so expose the app-specific fields.
    session: ({ session, user }) => {
      const row = user as unknown as typeof users.$inferSelect;
      return {
        ...session,
        user: {
          ...session.user,
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          username: row.username,
          profilePicture: row.profilePicture,
          profileComplete: row.profileComplete,
          visibility: row.visibility,
          slug: row.slug,
        },
      };
    },
  },
  pages: { signIn: "/sign-in" },
});
