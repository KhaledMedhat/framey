import z from "zod";
import { isAtLeast18YearsOld, isValidDate } from "@/lib/utils";
import { Gender } from "@/interfaces/form.interface";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

const profileFieldsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores (no spaces)",
    ),
  gender: z.nativeEnum(Gender, { message: "Please select your gender" }),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((date) => isValidDate(new Date(date)), {
      message: "Invalid date of birth",
    })
    .refine((date) => isAtLeast18YearsOld(new Date(date)), {
      message: "You must be at least 18 years old",
    }),
});

export const registerSchema = z
  .object({
    profilePicture: z.instanceof(File).optional(),
    firstName: z
      .string()
      .min(1, "First name is required")
      .regex(/^[A-Za-z]+$/, "First name can only contain alphabets"),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .regex(/^[A-Za-z]+$/, "Last name can only contain alphabets"),
    email: z.string().email().min(1, "Email is required"),
    username: profileFieldsSchema.shape.username,
    gender: profileFieldsSchema.shape.gender,
    dateOfBirth: profileFieldsSchema.shape.dateOfBirth,
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password cannot be less than 8 characters"),
    confirmPassword: z
      .string()
      .min(1, "Confirm password is required")
      .min(8, "Confirm password cannot be less than 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const registerInputSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .regex(/^[A-Za-z]+$/, "First name can only contain alphabets"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .regex(/^[A-Za-z]+$/, "Last name can only contain alphabets"),
  email: z.string().email().min(1, "Email is required"),
  username: profileFieldsSchema.shape.username,
  gender: profileFieldsSchema.shape.gender,
  dateOfBirth: profileFieldsSchema.shape.dateOfBirth,
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password cannot be less than 8 characters"),
  profilePicture: z
    .object({
      url: z.string(),
      type: z.string().optional(),
      size: z.number().optional(),
      key: z.string().optional(),
    })
    .optional(),
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
export const completeProfileSchema = profileFieldsSchema;

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;
export type PostListInput = z.infer<typeof postListInputSchema>;
export type PostUserListInput = z.infer<typeof postUserListInputSchema>;
