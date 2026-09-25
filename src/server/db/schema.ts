import { relations } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  MediaCover,
  MediaTag,
  PhotoTag,
} from "@/interfaces/post.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { AccountVisibility } from "@/interfaces/general.interface";

type AdapterAccountType =
  | "oauth"
  | "oidc"
  | "email"
  | "webauthn"
  | "credentials";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `framey_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    authorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caption: d.text(),
    location: d.varchar({ length: 512 }),
    tags: d.jsonb().$type<PhotoTag[]>().notNull().default([]),
    hideComments: d.boolean().notNull().default(false),
    hidePostInfo: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("post_author_idx").on(t.authorId),
    index("post_created_at_idx").on(t.createdAt),
  ],
);

export const postMedia = createTable(
  "post_media",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    postId: d
      .uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: d.text().notNull(),
    type: d.varchar({ length: 128 }),
    size: d.integer(),
    key: d.varchar({ length: 512 }),
    width: d.integer(),
    height: d.integer(),
    alt: d.text(),
    tags: d.jsonb().$type<MediaTag[]>().notNull().default([]),
    cover: d.jsonb().$type<MediaCover | null>(),
    muted: d.boolean().notNull().default(false),
    duration: d.doublePrecision(),
    trimStart: d.doublePrecision(),
    trimEnd: d.doublePrecision(),
    order: d.integer().notNull().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("post_media_post_idx").on(t.postId)],
);

export const postCollaborators = createTable(
  "post_collaborator",
  (d) => ({
    postId: d
      .uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    index("post_collaborator_post_idx").on(t.postId),
    index("post_collaborator_user_idx").on(t.userId),
  ],
);

export const postLikes = createTable(
  "post_like",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: d
      .uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index("post_like_user_idx").on(t.userId),
    index("post_like_post_idx").on(t.postId),
  ],
);

export const postComments = createTable(
  "post_comment",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    postId: d
      .uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: d
      .uuid()
      .references((): AnyPgColumn => postComments.id, { onDelete: "cascade" }),
    content: d.text().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("post_comment_post_idx").on(t.postId),
    index("post_comment_author_idx").on(t.authorId),
    index("post_comment_parent_idx").on(t.parentId),
  ],
);

export const users = createTable(
  "user",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    firstName: d.varchar({ length: 255 }).notNull(),
    lastName: d.varchar({ length: 255 }).notNull(),
    email: d.varchar({ length: 255 }).notNull(),
    username: d.varchar({ length: 255 }).notNull().unique(),
    bio: d.text(),
    password: d.varchar({ length: 255 }),
    emailVerified: d.timestamp({
      mode: "date",
      withTimezone: true,
    }),
    profilePicture: d.jsonb().$type<ProfilePicture | null>(),
    profileComplete: d.boolean().notNull().default(false),
    visibility: d
      .varchar({ length: 32 })
      .$type<AccountVisibility>()
      .notNull()
      .default(AccountVisibility.PUBLIC),
  }),
  (t) => [uniqueIndex("user_email_idx").on(t.email)],
);

export const userFollows = createTable(
  "user_follow",
  (d) => ({
    followerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("user_follow_follower_idx").on(t.followerId),
    index("user_follow_following_idx").on(t.followingId),
  ],
);

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: d.varchar({ length: 255 }).$type<AdapterAccountType>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(posts, {
    fields: [postMedia.postId],
    references: [posts.id],
  }),
}));

export const postCollaboratorsRelations = relations(
  postCollaborators,
  ({ one }) => ({
    post: one(posts, {
      fields: [postCollaborators.postId],
      references: [posts.id],
    }),
    user: one(users, {
      fields: [postCollaborators.userId],
      references: [users.id],
    }),
  }),
);

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
}));

export const postCommentsRelations = relations(
  postComments,
  ({ one, many }) => ({
    post: one(posts, {
      fields: [postComments.postId],
      references: [posts.id],
    }),
    author: one(users, {
      fields: [postComments.authorId],
      references: [users.id],
    }),
    parent: one(postComments, {
      fields: [postComments.parentId],
      references: [postComments.id],
      relationName: "commentReplies",
    }),
    replies: many(postComments, {
      relationName: "commentReplies",
    }),
  }),
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  media: many(postMedia),
  collaborators: many(postCollaborators),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  posts: many(posts),
  postComments: many(postComments),
  collaboratedPosts: many(postCollaborators),
  likedPosts: many(postLikes),
  followers: many(userFollows, { relationName: "following" }),
  following: many(userFollows, { relationName: "follower" }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
