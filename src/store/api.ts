import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { FeedCursor, FeedPage } from "@/interfaces/post.interface";
import type { CompleteProfileInput, RegisterInput } from "@/lib/validations";

export type ApiError = {
  status: number;
  data?: {
    message: string;
    errors?: { field: "email" | "username"; message: string }[];
  };
};

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
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
    feedPage: build.query<FeedPage, FeedCursor>({
      query: (cursor) => ({ url: "/feed", params: cursor }),
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
  }),
});

export const {
  useRegisterMutation,
  useCompleteProfileMutation,
  useLazyFeedPageQuery,
  useSetLikeMutation,
} = api;
