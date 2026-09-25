import { eq, or } from "drizzle-orm";

import { ConflictCause } from "@/interfaces/api.interface";
import { registerInputSchema } from "@/lib/validations";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/password";
import { clientIp, rateLimit, tooManyRequests } from "@/server/ratelimit";
import { uploadProfilePicture, utapi } from "@/server/uploadthing";

type Conflict = { field: "email" | "username"; message: ConflictCause };

const conflictResponse = (errors: Conflict[]) =>
  Response.json(
    { message: errors.map((e) => e.message).join(" "), errors },
    { status: 409 },
  );

export async function POST(request: Request) {
  const retryAfter = await rateLimit("register", clientIp(request));
  if (retryAfter) return tooManyRequests(retryAfter);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("profilePicture");
  const parsed = registerInputSchema.safeParse(
    formData && {
      ...Object.fromEntries(formData),
      // An empty file input still arrives as a zero-byte File.
      profilePicture: file instanceof File && file.size > 0 ? file : undefined,
    },
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { password, profilePicture, ...rest } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username.toLowerCase();

  // Report every taken field at once, and before spending time on the upload.
  const taken = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)));
  const conflicts: Conflict[] = [];
  if (taken.some((u) => u.email === email)) {
    conflicts.push({ field: "email", message: ConflictCause.EMAIL_ADDRESS });
  }
  if (taken.some((u) => u.username === username)) {
    conflicts.push({ field: "username", message: ConflictCause.USERNAME });
  }
  if (conflicts.length) return conflictResponse(conflicts);

  const uploaded = profilePicture
    ? await uploadProfilePicture(profilePicture).catch(() => null)
    : null;
  if (profilePicture && !uploaded) {
    return Response.json(
      { message: "Could not upload the profile picture. Please try again." },
      { status: 502 },
    );
  }

  try {
    await db.insert(users).values({
      ...rest,
      email,
      username,
      password: await hashPassword(password),
      profilePicture: uploaded,
      profileComplete: true,
    });
  } catch (error) {
    // Don't leave an orphaned file behind when the account isn't created.
    if (uploaded?.key) await utapi.deleteFiles(uploaded.key).catch(() => {});

    // Backstop for a sign-up that raced past the check above: the unique
    // constraints still reject it (Postgres only reports the first one hit).
    const cause = (error as { cause?: { code?: string; constraint?: string } })
      .cause;
    if (cause?.code === "23505") {
      return conflictResponse([
        cause.constraint?.includes("username")
          ? { field: "username", message: ConflictCause.USERNAME }
          : { field: "email", message: ConflictCause.EMAIL_ADDRESS },
      ]);
    }
    throw error;
  }

  return Response.json({ ok: true }, { status: 201 });
}
