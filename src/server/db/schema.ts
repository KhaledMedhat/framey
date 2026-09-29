import { relations } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  Gif,
  MediaCover,
  MediaTag,
  PhotoTag,
} from "@/interfaces/post.interface";
import type { StoryOverlay } from "@/interfaces/story.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { AccountVisibility, Gender } from "@/interfaces/general.interface";

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
    // A Photon (OpenStreetMap) place: "N123", "W456" or "R789". Posts sharing
    // it are grouped on /locations/<id>; free-typed locations have none.
    locationId: d.varchar({ length: 32 }),
    locationLat: d.doublePrecision(),
    locationLng: d.doublePrecision(),
    tags: d.jsonb().$type<PhotoTag[]>().notNull().default([]),
    hideComments: d.boolean().notNull().default(false),
    hidePostInfo: d.boolean().notNull().default(false),
    // Set while the author has it archived: hidden from everyone but them.
    archivedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("post_author_idx").on(t.authorId),
    index("post_created_at_idx").on(t.createdAt),
    index("post_location_idx").on(t.locationId, t.createdAt),
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
    // A GIF from GIPHY; the text may then be empty.
    gif: d.jsonb().$type<Gif | null>(),
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

export const commentLikes = createTable(
  "comment_like",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: d
      .uuid()
      .notNull()
      .references(() => postComments.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.commentId] }),
    index("comment_like_comment_idx").on(t.commentId),
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
    /** Links shown under the bio, in order (Instagram allows five). */
    websites: d.jsonb().$type<string[]>().notNull().default([]),
    /** Private: never shown on the profile. Unset until they pick one. */
    gender: d.varchar({ length: 32 }).$type<Gender>(),
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
    /** When they signed up: the first line of their account history. */
    createdAt: d.timestamp({ withTimezone: true }).defaultNow().notNull(),
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

/** A follow waiting on a private account's approval. */
export const followRequests = createTable(
  "follow_request",
  (d) => ({
    requesterId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.requesterId, t.targetId] }),
    index("follow_request_target_idx").on(t.targetId),
  ],
);

/** Either side of a block can't see or reach the other. */
export const userBlocks = createTable(
  "user_block",
  (d) => ({
    blockerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("user_block_blocked_idx").on(t.blockedId),
  ],
);

/** `friendId` sees `userId`'s close-friends stories. */
export const closeFriends = createTable(
  "close_friend",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.friendId] }),
    index("close_friend_friend_idx").on(t.friendId),
  ],
);

/** Every post someone saved; collections only group these. */
export const savedPosts = createTable(
  "saved_post",
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
    index("saved_post_post_idx").on(t.postId),
  ],
);

export const savedCollections = createTable(
  "saved_collection",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: d.varchar({ length: 50 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("saved_collection_user_idx").on(t.userId)],
);

export const savedCollectionPosts = createTable(
  "saved_collection_post",
  (d) => ({
    collectionId: d
      .uuid()
      .notNull()
      .references(() => savedCollections.id, { onDelete: "cascade" }),
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
    primaryKey({ columns: [t.collectionId, t.postId] }),
    index("saved_collection_post_post_idx").on(t.postId),
  ],
);

/** One photo or video, live for 24 hours, then only in its author's archive. */
export const stories = createTable(
  "story",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    authorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: d.text().notNull(),
    key: d.varchar({ length: 512 }),
    type: d.varchar({ length: 128 }),
    width: d.integer(),
    height: d.integer(),
    cover: d.jsonb().$type<MediaCover | null>(),
    muted: d.boolean().notNull().default(false),
    duration: d.doublePrecision(),
    /** Only the author's close friends may see it. */
    closeFriends: d.boolean().notNull().default(false),
    /** Text laid over the photo or video, positioned in fractions of the frame. */
    overlays: d.jsonb().$type<StoryOverlay[]>().notNull().default([]),
    /** Reposted from someone else's story; the author outlives a deleted original. */
    repostOfId: d
      .uuid()
      .references((): AnyPgColumn => stories.id, { onDelete: "set null" }),
    repostOfUserId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("story_author_idx").on(t.authorId, t.createdAt)],
);

export const storyViews = createTable(
  "story_view",
  (d) => ({
    storyId: d
      .uuid()
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    viewerId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.storyId, t.viewerId] })],
);

export const highlights = createTable(
  "highlight",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 30 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("highlight_user_idx").on(t.userId)],
);

export const highlightStories = createTable(
  "highlight_story",
  (d) => ({
    highlightId: d
      .uuid()
      .notNull()
      .references(() => highlights.id, { onDelete: "cascade" }),
    storyId: d
      .uuid()
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.highlightId, t.storyId] })],
);

export type NotificationType =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "follow_request"
  | "follow_accept"
  | "repost";

export const notifications = createTable(
  "notification",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: d.varchar({ length: 32 }).$type<NotificationType>().notNull(),
    postId: d.uuid().references(() => posts.id, { onDelete: "cascade" }),
    commentId: d
      .uuid()
      .references(() => postComments.id, { onDelete: "cascade" }),
    read: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [notifications.postId],
    references: [posts.id],
  }),
  comment: one(postComments, {
    fields: [notifications.commentId],
    references: [postComments.id],
  }),
}));

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

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocked: one(users, {
    fields: [userBlocks.blockedId],
    references: [users.id],
  }),
}));

export const closeFriendsRelations = relations(closeFriends, ({ one }) => ({
  friend: one(users, {
    fields: [closeFriends.friendId],
    references: [users.id],
  }),
}));

export const storiesRelations = relations(stories, ({ one }) => ({
  author: one(users, { fields: [stories.authorId], references: [users.id] }),
}));

export const highlightsRelations = relations(highlights, ({ many }) => ({
  stories: many(highlightStories),
}));

export const highlightStoriesRelations = relations(
  highlightStories,
  ({ one }) => ({
    highlight: one(highlights, {
      fields: [highlightStories.highlightId],
      references: [highlights.id],
    }),
    story: one(stories, {
      fields: [highlightStories.storyId],
      references: [stories.id],
    }),
  }),
);

/** A 1:1 chat or a group. Ordered in the inbox by its latest message. */
export const conversations = createTable(
  "conversation",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    isGroup: d.boolean().notNull().default(false),
    // Groups only; a 1:1 chat is named after the other person.
    name: d.varchar({ length: 100 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
);

export const conversationMembers = createTable(
  "conversation_member",
  (d) => ({
    conversationId: d
      .uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // False while the chat sits in their Requests: whoever started it isn't
    // someone they follow. Accepting, or replying, moves it to the inbox.
    accepted: d.boolean().notNull().default(true),
    // Everything up to here is seen: drives "Seen" and the unread badge.
    lastReadAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    // "Delete chat" / declined request: older messages are hidden from them,
    // and the chat only returns to their list when someone writes again.
    clearedAt: d.timestamp({ withTimezone: true }),
    joinedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_member_user_idx").on(t.userId),
  ],
);

export const messages = createTable(
  "message",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    conversationId: d
      .uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: d.text(),
    // A shared post or reel; null again if it's deleted later.
    postId: d.uuid().references(() => posts.id, { onDelete: "set null" }),
    // One photo or video per message, like Instagram.
    media: d.jsonb().$type<MediaCover | null>(),
    // A reply to this story; null again once the story is deleted.
    storyId: d.uuid().references(() => stories.id, { onDelete: "set null" }),
    // Quoting an earlier message in the chat; null again if that's unsent.
    replyToId: d
      .uuid()
      .references((): AnyPgColumn => messages.id, { onDelete: "set null" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("message_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const messageLikes = createTable(
  "message_like",
  (d) => ({
    messageId: d
      .uuid()
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
);

/** `userId` reposted `postId` onto their profile and their followers' feeds. */
export const postReposts = createTable(
  "post_repost",
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
    index("post_repost_user_idx").on(t.userId, t.createdAt),
  ],
);

export const storyLikes = createTable(
  "story_like",
  (d) => ({
    storyId: d
      .uuid()
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.storyId, t.userId] })],
);

export type AccountEventKind =
  | "created"
  | "name"
  | "username"
  | "bio"
  | "website"
  | "gender"
  | "privacy"
  | "photo";

/** "Account history": each change the user made to their profile, and to what. */
export const accountEvents = createTable(
  "account_event",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: d.varchar({ length: 32 }).$type<AccountEventKind>().notNull(),
    value: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("account_event_user_idx").on(t.userId, t.createdAt)],
);
