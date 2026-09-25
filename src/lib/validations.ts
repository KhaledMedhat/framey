import z from "zod";

/**
 * Top-level paths that are (or will be) real routes. `/[slug]` serves
 * profiles, so a user with one of these names would have an unreachable page.
 */
export const RESERVED_USERNAMES = new Set([
  "_next", "about", "accounts", "admin", "api", "direct", "explore", "help",
  "login", "logout", "me", "notifications", "onboarding", "p", "privacy",
  "reel", "reels", "register", "search", "settings", "signin", "signup",
  "stories", "terms",
]);

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required")
  .max(30, "Username cannot exceed 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores (no spaces)",
  )
  .refine(
    (username) => !RESERVED_USERNAMES.has(username.toLowerCase()),
    "This username isn't available",
  );

// Letters from any script (Arabic, accents, ...) plus apostrophes, hyphens, spaces.
const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} cannot exceed 50 characters`)
    .regex(
      /^[\p{L}\p{M}' -]+$/u,
      `${label} can only contain letters, spaces, apostrophes and hyphens`,
    );

const passwordSchema = z
  .string()
  .min(8, "Password cannot be less than 8 characters")
  // Hashing cost grows with length; cap it so huge inputs can't tie up the server.
  .max(128, "Password cannot exceed 128 characters");

/** What the register API accepts. */
export const registerInputSchema = z.object({
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  email: z.email("Please enter a valid email address").max(255),
  username: usernameSchema,
  password: passwordSchema,
  profilePicture: z
    .instanceof(File)
    .refine((file) => file.type.startsWith("image/"), "Profile picture must be an image")
    .refine((file) => file.size <= 10 * 1024 * 1024, "Profile picture cannot exceed 10MB")
    .optional(),
});

/** The register form: the API input plus the confirmation field. */
export const registerSchema = registerInputSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm password is required") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const postImageAccessibilityItemSchema = z.object({
  alt: z
    .string()
    .max(1000, "Alt text cannot exceed 1,000 characters")
    .optional(),
});

export const DEFAULT_POST_IMAGE_ALT = (index: number) =>
  `Post image ${index + 1}`;

export function resolvePostImageAlt(
  alt: string | undefined,
  index: number,
  fileName?: string,
) {
  const trimmed = alt?.trim();
  if (trimmed) return trimmed;

  const baseName = fileName?.replace(/\.[^.]+$/, "").trim();
  if (baseName) return baseName;

  return DEFAULT_POST_IMAGE_ALT(index);
}

export const photoTagSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  mediaIndex: z.number().int().min(0),
});

export const mediaTagSchema = photoTagSchema.omit({ mediaIndex: true });

export const postSchema = z.object({
  caption: z
    .string()
    .max(2200, "You have exceeded the maximum length of 2,200 characters")
    .optional(),
  location: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  tags: z.array(photoTagSchema).optional(),
  postImageAccessibility: z.array(postImageAccessibilityItemSchema).optional(),
  hideComments: z.boolean(),
  hidePostInfo: z.boolean(),
});

export const mediaCoverSchema = z.object({
  url: z.string().min(1),
  type: z.string().optional(),
  size: z.number().int().optional(),
  key: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

export const postMediaInputSchema = z.object({
  url: z.string().min(1),
  type: z.string().optional(),
  size: z.number().int().optional(),
  key: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  alt: z.string().max(1000).optional(),
  tags: z.array(mediaTagSchema).optional(),
  cover: mediaCoverSchema.nullable().optional(),
  muted: z.boolean().optional(),
  duration: z.number().min(0).optional(),
  trimStart: z.number().min(0).optional(),
  trimEnd: z.number().min(0).optional(),
  order: z.number().int().min(0),
});

export const createPostInputSchema = z.object({
  caption: z.string().max(2200).optional(),
  location: z.string().max(512).optional(),
  collaborators: z.array(z.string().min(1)).optional(),
  tags: z.array(photoTagSchema).optional(),
  hideComments: z.boolean(),
  hidePostInfo: z.boolean(),
  media: z.array(postMediaInputSchema).min(1).max(10),
});

export const postCursorSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.string().uuid(),
});

export const postListInputSchema = z.object({
  limit: z.number().int().min(1).max(30).default(12),
  cursor: postCursorSchema.optional(),
  direction: z.enum(["forward", "backward"]).optional(),
});

export const postUserListInputSchema = postListInputSchema.extend({
  username: z.string().trim().min(1).optional(),
});

export const postIdInputSchema = z.string().uuid();
export const completeProfileSchema = z.object({ username: usernameSchema });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;
export type PostListInput = z.infer<typeof postListInputSchema>;
export type PostUserListInput = z.infer<typeof postUserListInputSchema>;
