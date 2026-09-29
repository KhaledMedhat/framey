import z from "zod";

import { AccountVisibility, Gender } from "@/interfaces/general.interface";

/**
 * Top-level paths that are (or will be) real routes. `/[slug]` serves
 * profiles, so a user with one of these names would have an unreachable page.
 */
export const RESERVED_USERNAMES = new Set([
  "_next", "about", "accounts", "admin", "api", "archive", "direct", "explore", "help",
  "locations", "login", "logout", "me", "notifications", "onboarding", "p", "privacy",
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

export const photoTagSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  mediaIndex: z.number().int().min(0),
});

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

/** The share step's multipart `post` field; files travel beside it in order. */
export const sharePostInputSchema = z.object({
  caption: z.string().max(2200).optional(),
  location: z.string().trim().max(512).optional(),
  /** Set when the location was picked from Photon's suggestions. */
  place: z
    .object({
      id: z.string().regex(/^[NWR]\d{1,20}$/),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  hideComments: z.boolean(),
  hidePostInfo: z.boolean(),
  /** People tagged on the photos; the server re-reads each username. */
  tags: z.array(photoTagSchema).max(20).optional(),
  media: z
    .array(
      z.object({
        alt: z.string().trim().max(1000).optional(),
        muted: z.boolean().optional(),
        duration: z.number().min(0).optional(),
        hasCover: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
});
export type SharePostInput = z.infer<typeof sharePostInputSchema>;

export const postCursorSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.string().uuid(),
});

export const postIdInputSchema = z.string().uuid();
export const completeProfileSchema = z.object({ username: usernameSchema });

/** Edit profile: what the profile header shows about someone. */
/** "instagram.com/me" → "https://instagram.com/me"; blank stays blank. */
export const WEBSITES_MAX = 5;

export const withScheme = (link: string) =>
  !link || /^https?:\/\//i.test(link) ? link : `https://${link}`;

export const editProfileSchema = z.object({
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  // Blank rows are allowed while editing; the server drops them.
  websites: z
    .array(
      z
        .string()
        .trim()
        .max(200, "Link cannot exceed 200 characters")
        .refine(
          (link) => !link || z.url({ protocol: /^https?$/ }).safeParse(withScheme(link)).success,
          "Enter a valid link, like instagram.com/you",
        ),
    )
    .max(WEBSITES_MAX, `Add up to ${WEBSITES_MAX} links`),
  bio: z.string().trim().max(150, "Bio cannot exceed 150 characters"),
  gender: z.enum(Gender).nullable(),
  visibility: z.enum(AccountVisibility),
});

/** A GIF picked from our GIPHY search: only GIPHY's own media hosts. */
export const gifSchema = z.object({
  url: z
    .url()
    .max(500)
    .regex(/^https:\/\/media[0-9]*\.giphy\.com\//, "Pick a GIF from the list"),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
});

export const commentInputSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(2200, "Comments cannot exceed 2,200 characters"),
    gif: gifSchema.optional(),
    /** Replies attach to the top-level comment they answer. */
    parentId: z.uuid().optional(),
  })
  .refine((c) => c.content || c.gif, {
    message: "Write a comment first",
    path: ["content"],
  });
export type CommentInput = z.infer<typeof commentInputSchema>;

export const collectionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name the collection")
    .max(50, "Names cannot exceed 50 characters"),
  /** Saves this post straight into the new collection. */
  postId: z.uuid().optional(),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const highlightInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Name the highlight")
    .max(30, "Names cannot exceed 30 characters"),
  storyIds: z.array(z.uuid()).min(1, "Pick at least one story").max(100),
});
export type HighlightInput = z.infer<typeof highlightInputSchema>;

/** The story upload's multipart `story` field; the file travels beside it. */
export const storyOverlaySchema = z.object({
  id: z.string().max(40),
  text: z.string().trim().min(1).max(200),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.boolean(),
  size: z.number().min(0.03).max(0.2),
});

export const storyInputSchema = z.object({
  muted: z.boolean().optional(),
  duration: z.number().min(0).max(60).optional(),
  hasCover: z.boolean(),
  closeFriends: z.boolean().optional(),
  overlays: z.array(storyOverlaySchema).max(10).default([]),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

export const MESSAGE_MAX = 2000;

/** One person opens (or finds) your 1:1 chat; two or more make a group. */
export const newChatSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(31),
  name: z.string().trim().max(100).optional(),
});
export type NewChatInput = z.infer<typeof newChatSchema>;

export const sharePostSchema = z
  .object({
    postId: z.uuid(),
    userIds: z.array(z.string().min(1)).max(20).default([]),
    conversationIds: z.array(z.uuid()).max(20).default([]),
    text: z.string().trim().max(MESSAGE_MAX).optional(),
  })
  .refine((v) => v.userIds.length + v.conversationIds.length > 0, {
    message: "Pick someone to send it to",
  });
export type SharePostToChatInput = z.input<typeof sharePostSchema>;

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type EditProfileInput = z.infer<typeof editProfileSchema>;
export type PostInput = z.infer<typeof postSchema>;
