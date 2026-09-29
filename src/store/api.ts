import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  FeedCursor,
  FeedPage,
  FeedPost,
  Gif,
  PostComment,
  PostComments,
} from "@/interfaces/post.interface";
import type { AccountVisibility } from "@/interfaces/general.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import type {
  CollectionInput,
  CommentInput,
  CompleteProfileInput,
  EditProfileInput,
  HighlightInput,
  RegisterInput,
  NewChatInput,
  SharePostInput,
  SharePostToChatInput,
  StoryInput,
} from "@/lib/validations";
import type { NotificationType } from "@/server/db/schema";
import type {
  ChatDetail,
  ChatFolder,
  ChatListItem,
  ChatMessage,
} from "@/server/chat";
import type { CloseFriendChoice, Profile } from "@/server/profile";

export type ApiError = {
  status: number;
  data?: {
    message: string;
    errors?: { field: "email" | "username"; message: string }[];
  };
};

export type AccountPreview = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: ProfilePicture | null;
};

export type FollowListAccount = AccountPreview & {
  visibility: AccountVisibility;
};

export type ProfilePreview = Profile & { posts: FeedPost[] };

export type SaveState = {
  saved: boolean;
  collections: { id: string; name: string; contains: boolean }[];
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: Pick<AccountPreview, "id" | "username" | "profilePicture">;
  postId: string | null;
  thumbnail: string | null;
  comment: string | null;
};

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: [
    "Save",
    "Comments",
    "Notifications",
    "CloseFriends",
    "ProfilePreview",
    "Chats",
    "Chat",
    "Messages",
  ],
  endpoints: (build) => ({
    register: build.mutation<{ ok: true }, RegisterInput>({
      // Multipart so the profile picture travels with the rest of the fields.
      query: (input) => {
        const body = new FormData();
        for (const [key, value] of Object.entries(input)) {
          if (value !== undefined) body.append(key, value);
        }
        return { url: "/auth/register", method: "POST", body };
      },
    }),
    completeProfile: build.mutation<
      { username: string },
      CompleteProfileInput
    >({
      query: (body) => ({ url: "/auth/complete-profile", method: "POST", body }),
    }),
    createPost: build.mutation<
      { id: string },
      {
        post: SharePostInput;
        files: File[];
        /** Keyed by the media's index; only videos have one. */
        covers: Record<number, File>;
      }
    >({
      query: ({ post, files, covers }) => {
        const body = new FormData();
        body.append("post", JSON.stringify(post));
        for (const file of files) body.append("file", file);
        for (const [index, cover] of Object.entries(covers)) {
          body.append(`cover:${index}`, cover);
        }
        return { url: "/posts", method: "POST", body };
      },
    }),
    feedPage: build.query<FeedPage, FeedCursor>({
      query: (cursor) => ({ url: "/feed", params: cursor }),
    }),
    reels: build.query<FeedPost[], string[]>({
      query: (exclude) => ({ url: "/reels", params: { exclude: exclude.join(",") } }),
      keepUnusedDataFor: 0,
    }),
    profilePreview: build.query<ProfilePreview, string>({
      query: (username) => `/users/${encodeURIComponent(username)}`,
      providesTags: (_, __, username) => [{ type: "ProfilePreview", id: username }],
    }),
    searchUsers: build.query<AccountPreview[], string>({
      query: (q) => ({ url: "/users", params: { q } }),
    }),
    setLike: build.mutation<
      { liked: boolean; likeCount: number },
      { postId: string; liked: boolean }
    >({
      query: ({ postId, liked }) => ({
        url: `/posts/${postId}/like`,
        method: liked ? "POST" : "DELETE",
      }),
    }),
    setRepost: build.mutation<
      { reposted: boolean; repostCount: number },
      { postId: string; reposted: boolean }
    >({
      query: ({ postId, reposted }) => ({
        url: `/posts/${postId}/repost`,
        method: reposted ? "POST" : "DELETE",
      }),
    }),
    setFollow: build.mutation<
      { following: boolean; requested: boolean; followers: number },
      { username: string; following: boolean }
    >({
      query: ({ username, following }) => ({
        url: `/users/${username}/follow`,
        method: following ? "POST" : "DELETE",
      }),
      invalidatesTags: (_, __, { username }) => [
        { type: "ProfilePreview", id: username },
      ],
    }),
    followList: build.query<
      FollowListAccount[],
      { username: string; list: "followers" | "following" }
    >({
      query: ({ username, list }) => ({
        url: `/users/${username}/follow`,
        params: { list },
      }),
      keepUnusedDataFor: 0,
    }),
    removeFollower: build.mutation<{ ok: true }, string>({
      query: (userId) => ({ url: `/followers/${userId}`, method: "DELETE" }),
    }),
    editProfile: build.mutation<{ ok: true }, Partial<EditProfileInput>>({
      query: (body) => ({ url: "/profile", method: "PATCH", body }),
    }),
    changePhoto: build.mutation<ProfilePicture, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/profile/photo", method: "POST", body };
      },
    }),
    setBlocked: build.mutation<
      { blocked: boolean },
      { username: string; blocked: boolean }
    >({
      query: ({ username, blocked }) => ({
        url: `/users/${username}/block`,
        method: blocked ? "POST" : "DELETE",
      }),
      invalidatesTags: (_, __, { username }) => [
        { type: "ProfilePreview", id: username },
      ],
    }),
    closeFriends: build.query<CloseFriendChoice[], void>({
      query: () => "/close-friends",
      providesTags: ["CloseFriends"],
    }),
    setCloseFriend: build.mutation<
      { close: boolean },
      { userId: string; close: boolean }
    >({
      query: (body) => ({ url: "/close-friends", method: "PATCH", body }),
      // Tick the circle now; undo if the server refuses.
      async onQueryStarted({ userId, close }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("closeFriends", undefined, (draft) => {
            const friend = draft.find((f) => f.id === userId);
            if (friend) friend.close = close;
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
    }),
    archivePost: build.mutation<
      { archived: boolean },
      { postId: string; archived: boolean }
    >({
      query: ({ postId, archived }) => ({
        url: `/posts/${postId}`,
        method: "PATCH",
        body: { archived },
      }),
    }),
    deletePost: build.mutation<{ ok: true }, string>({
      query: (postId) => ({ url: `/posts/${postId}`, method: "DELETE" }),
    }),
    saveState: build.query<SaveState, string>({
      query: (postId) => `/posts/${postId}/save`,
      providesTags: (_, __, postId) => [{ type: "Save", id: postId }],
      keepUnusedDataFor: 0,
    }),
    setSaved: build.mutation<
      SaveState,
      { postId: string; saved: boolean; collectionId?: string }
    >({
      query: ({ postId, saved, collectionId }) => ({
        url: `/posts/${postId}/save`,
        method: saved ? "POST" : "DELETE",
        body: { collectionId },
      }),
      invalidatesTags: (_, __, { postId }) => [{ type: "Save", id: postId }],
    }),
    createCollection: build.mutation<{ id: string; name: string }, CollectionInput>({
      query: (body) => ({ url: "/collections", method: "POST", body }),
      invalidatesTags: (_, __, { postId }) =>
        postId ? [{ type: "Save", id: postId }] : [],
    }),
    deleteCollection: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/collections/${id}`, method: "DELETE" }),
    }),
    comments: build.query<PostComments, string>({
      query: (postId) => `/posts/${postId}/comments`,
      providesTags: (_, __, postId) => [{ type: "Comments", id: postId }],
      keepUnusedDataFor: 0,
    }),
    addComment: build.mutation<
      { id: string },
      CommentInput & {
        postId: string;
        /** You, for the comment that shows before the server answers. */
        author: PostComment["author"];
      }
    >({
      query: ({ postId, content, gif, parentId }) => ({
        url: `/posts/${postId}/comments`,
        method: "POST",
        body: { content, gif, parentId },
      }),
      async onQueryStarted(
        { postId, author, content, gif, parentId },
        { dispatch, queryFulfilled },
      ) {
        const comment: PostComment = {
          id: `pending-${Date.now()}`,
          content,
          gif: gif ?? null,
          createdAt: new Date().toISOString(),
          author,
          likeCount: 0,
          likedByMe: false,
          pending: true,
        };
        const patch = dispatch(
          api.util.updateQueryData("comments", postId, (draft) => {
            const thread = parentId
              ? draft.comments.find((c) => c.id === parentId)
              : null;
            if (thread) (thread.replies ??= []).push(comment);
            else draft.comments.push({ ...comment, replies: [] });
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
      invalidatesTags: (_, __, { postId }) => [{ type: "Comments", id: postId }],
    }),
    deleteComment: build.mutation<{ ok: true }, { id: string; postId: string }>({
      query: ({ id }) => ({ url: `/comments/${id}`, method: "DELETE" }),
      async onQueryStarted({ id, postId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("comments", postId, (draft) => {
            draft.comments = draft.comments.filter((c) => c.id !== id);
            for (const c of draft.comments) {
              if (c.replies) c.replies = c.replies.filter((r) => r.id !== id);
            }
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
      invalidatesTags: (_, __, { postId }) => [{ type: "Comments", id: postId }],
    }),
    setCommentLike: build.mutation<
      { liked: boolean; likeCount: number },
      { id: string; postId: string; liked: boolean }
    >({
      query: ({ id, liked }) => ({
        url: `/comments/${id}/like`,
        method: liked ? "POST" : "DELETE",
      }),
      // Flip the heart in the cached thread now; undo if the server refuses.
      async onQueryStarted({ id, postId, liked }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("comments", postId, (draft) => {
            for (const comment of draft.comments.flatMap((c) => [c, ...(c.replies ?? [])])) {
              if (comment.id !== id || comment.likedByMe === liked) continue;
              comment.likedByMe = liked;
              comment.likeCount += liked ? 1 : -1;
            }
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
    }),
    createStory: build.mutation<
      { id: string },
      { story: StoryInput; file: File; cover?: File }
    >({
      query: ({ story, file, cover }) => {
        const body = new FormData();
        body.append("story", JSON.stringify(story));
        body.append("file", file);
        if (cover) body.append("cover", cover);
        return { url: "/stories", method: "POST", body };
      },
    }),
    deleteStory: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/stories/${id}`, method: "DELETE" }),
    }),
    setStoryLike: build.mutation<{ liked: boolean }, { id: string; liked: boolean }>({
      query: ({ id, liked }) => ({
        url: `/stories/${id}/like`,
        method: liked ? "POST" : "DELETE",
      }),
    }),
    storyViewers: build.query<(AccountPreview & { liked: boolean })[], string>({
      query: (id) => `/stories/${id}/viewers`,
      keepUnusedDataFor: 0,
    }),
    repostStory: build.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/stories/${id}/repost`, method: "POST" }),
    }),
    replyToStory: build.mutation<{ conversationId: string }, { id: string; text: string }>({
      query: ({ id, text }) => ({
        url: `/stories/${id}/reply`,
        method: "POST",
        body: { text },
      }),
      invalidatesTags: ["Chats"],
    }),
    viewStory: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/stories/${id}/view`, method: "POST" }),
    }),
    createHighlight: build.mutation<{ id: string }, HighlightInput>({
      query: (body) => ({ url: "/highlights", method: "POST", body }),
    }),
    deleteHighlight: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/highlights/${id}`, method: "DELETE" }),
    }),
    notifications: build.query<
      { unread: number; items: NotificationItem[] },
      void
    >({
      query: () => "/notifications",
      providesTags: ["Notifications"],
    }),
    markNotificationsRead: build.mutation<{ ok: true }, void>({
      query: () => ({ url: "/notifications", method: "PATCH" }),
      // Everything reads as seen at once; undone if the server refuses.
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("notifications", undefined, (draft) => {
            draft.unread = 0;
            for (const item of draft.items) item.read = true;
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
    }),
    markNotificationRead: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/notifications/${id}`, method: "PATCH" }),
      // The badge drops the moment you open one.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("notifications", undefined, (draft) => {
            const item = draft.items.find((n) => n.id === id);
            if (!item || item.read) return;
            item.read = true;
            draft.unread = Math.max(0, draft.unread - 1);
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
    }),
    respondFollowRequest: build.mutation<
      { ok: true },
      { userId: string; accept: boolean }
    >({
      query: ({ userId, accept }) => ({
        url: `/follow-requests/${userId}`,
        method: accept ? "POST" : "DELETE",
      }),
      invalidatesTags: ["Notifications"],
    }),
    gifs: build.infiniteQuery<
      {
        gifs: (Gif & { id: string; title: string; preview: string })[];
        nextOffset: number | null;
      },
      string,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (last) => last.nextOffset,
      },
      query: ({ queryArg, pageParam }) => ({
        url: "/gifs",
        params: { q: queryArg, offset: pageParam },
      }),
    }),
    chats: build.query<ChatListItem[], ChatFolder>({
      query: (folder) => ({ url: "/conversations", params: { folder } }),
      providesTags: ["Chats"],
    }),
    unreadChats: build.query<
      { inbox: number; requests: number; senders: AccountPreview[] },
      void
    >({
      query: () => "/conversations/unread",
      providesTags: ["Chats"],
    }),
    chat: build.query<ChatDetail, string>({
      query: (id) => `/conversations/${id}`,
      providesTags: (_, __, id) => [{ type: "Chat", id }],
    }),
    messages: build.infiniteQuery<
      { messages: ChatMessage[]; nextBefore: string | null },
      string,
      string | null
    >({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextBefore,
      },
      query: ({ queryArg, pageParam }) => ({
        url: `/conversations/${queryArg}/messages`,
        params: pageParam ? { before: pageParam } : undefined,
      }),
      providesTags: (_, __, id) => [{ type: "Messages", id }],
    }),
    openChat: build.mutation<{ id: string }, NewChatInput>({
      query: (body) => ({ url: "/conversations", method: "POST", body }),
      invalidatesTags: ["Chats"],
    }),
    sendMessage: build.mutation<
      { ok: true },
      {
        conversationId: string;
        text?: string;
        file?: File;
        gif?: Gif;
        /** The message being answered; its preview shows on the pending one. */
        replyTo?: ChatMessage["replyTo"];
        /** You, for the bubble that shows before the server answers. */
        sender: AccountPreview;
      }
    >({
      query: ({ conversationId, text, file, gif, replyTo }) => {
        const body = new FormData();
        if (replyTo) body.append("replyToId", replyTo.id);
        if (text) body.append("text", text);
        if (file) body.append("file", file);
        if (gif) body.append("gif", JSON.stringify(gif));
        return {
          url: `/conversations/${conversationId}/messages`,
          method: "POST",
          body,
        };
      },
      // The message shows (dimmed) at once; the refetch swaps in the real one.
      async onQueryStarted(
        { conversationId, text, file, gif, replyTo, sender },
        { dispatch, queryFulfilled },
      ) {
        const now = Date.now();
        const first = gif || file ? 0 : 1;
        const draft = (extra: Partial<ChatMessage>, i: number): ChatMessage => ({
          id: `pending-${now}-${i}`,
          senderId: sender.id,
          sender,
          text: null,
          media: null,
          story: null,
          shared: false,
          post: null,
          likes: [],
          // The server quotes it on the first message sent (see the route).
          replyTo: i === first ? (replyTo ?? null) : null,
          createdAt: new Date(now + i).toISOString(),
          pending: true,
          ...extra,
        });
        const pending = [
          ...(gif ? [draft({ media: { ...gif, type: "image/gif" } }, 0)] : []),
          ...(file
            ? [
                draft(
                  { media: { url: URL.createObjectURL(file), type: file.type } },
                  0,
                ),
              ]
            : []),
          ...(text ? [draft({ text }, 1)] : []),
        ];
        const patch = dispatch(
          api.util.updateQueryData("messages", conversationId, (data) => {
            data.pages[0]?.messages.unshift(...pending.reverse());
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
      invalidatesTags: (_, __, { conversationId }) => [
        "Chats",
        { type: "Messages", id: conversationId },
      ],
    }),
    unsendMessage: build.mutation<
      { ok: true },
      { id: string; conversationId: string }
    >({
      query: ({ id }) => ({ url: `/messages/${id}`, method: "DELETE" }),
      async onQueryStarted({ id, conversationId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("messages", conversationId, (data) => {
            for (const page of data.pages) {
              page.messages = page.messages.filter((m) => m.id !== id);
            }
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
      invalidatesTags: (_, __, { conversationId }) => [
        "Chats",
        { type: "Messages", id: conversationId },
      ],
    }),
    setMessageLike: build.mutation<
      { ok: true },
      { id: string; conversationId: string; liked: boolean; userId: string }
    >({
      query: ({ id, liked }) => ({
        url: `/messages/${id}/like`,
        method: liked ? "POST" : "DELETE",
      }),
      async onQueryStarted(
        { id, conversationId, liked, userId },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          api.util.updateQueryData("messages", conversationId, (data) => {
            const message = data.pages
              .flatMap((p) => p.messages)
              .find((m) => m.id === id);
            if (!message) return;
            message.likes = liked
              ? [...new Set([...message.likes, userId])]
              : message.likes.filter((u) => u !== userId);
          }),
        );
        await queryFulfilled.catch(() => patch.undo());
      },
      invalidatesTags: (_, __, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),
    updateChat: build.mutation<
      { ok: true },
      { id: string; action: "read" | "accept" }
    >({
      query: ({ id, action }) => ({
        url: `/conversations/${id}`,
        method: "PATCH",
        body: { action },
      }),
      // Read: the chat's unread dot goes now.
      async onQueryStarted({ id, action }, { dispatch, queryFulfilled }) {
        if (action !== "read") return;
        const patches = (["inbox", "requests"] as const).map((folder) =>
          dispatch(
            api.util.updateQueryData("chats", folder, (chats) => {
              const chat = chats.find((c) => c.id === id);
              if (chat) chat.unread = false;
            }),
          ),
        );
        await queryFulfilled.catch(() => patches.forEach((p) => p.undo()));
      },
      invalidatesTags: (_, __, { id, action }) =>
        action === "read" ? ["Chats"] : ["Chats", { type: "Chat", id }],
    }),
    removeChat: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/conversations/${id}`, method: "DELETE" }),
      invalidatesTags: ["Chats"],
    }),
    sendTyping: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/conversations/${id}/typing`, method: "POST" }),
    }),
    sharePostToChats: build.mutation<
      { conversationIds: string[] },
      SharePostToChatInput
    >({
      query: (body) => ({ url: "/share", method: "POST", body }),
      invalidatesTags: ["Chats"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useCompleteProfileMutation,
  useCreatePostMutation,
  useLazyFeedPageQuery,
  useLazyReelsQuery,
  useSearchUsersQuery,
  useProfilePreviewQuery,
  useSetLikeMutation,
  useSetRepostMutation,
  useSetFollowMutation,
  useFollowListQuery,
  useRemoveFollowerMutation,
  useEditProfileMutation,
  useChangePhotoMutation,
  useSetBlockedMutation,
  useCloseFriendsQuery,
  useSetCloseFriendMutation,
  useArchivePostMutation,
  useDeletePostMutation,
  useSaveStateQuery,
  useSetSavedMutation,
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useSetCommentLikeMutation,
  useCreateStoryMutation,
  useDeleteStoryMutation,
  useViewStoryMutation,
  useSetStoryLikeMutation,
  useStoryViewersQuery,
  useReplyToStoryMutation,
  useRepostStoryMutation,
  useCreateHighlightMutation,
  useDeleteHighlightMutation,
  useNotificationsQuery,
  useMarkNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useRespondFollowRequestMutation,
  useGifsInfiniteQuery,
  useChatsQuery,
  useUnreadChatsQuery,
  useChatQuery,
  useMessagesInfiniteQuery,
  useOpenChatMutation,
  useSendMessageMutation,
  useUnsendMessageMutation,
  useSetMessageLikeMutation,
  useUpdateChatMutation,
  useRemoveChatMutation,
  useSendTypingMutation,
  useSharePostToChatsMutation,
} = api;
