"use client";

import { useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Heart, Send2, Trash, X } from "reicon-react";

import type { PostComment, Gif } from "@/interfaces/post.interface";
import { cn, timeAgo } from "@/lib/utils";
import {
  useAddCommentMutation,
  useCommentsQuery,
  useDeleteCommentMutation,
  useSetCommentLikeMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";
import EmojiButton, { insertEmoji } from "./emoji-button";
import GifPicker from "./gif-picker";
import Mentions from "./mentions";
import { Textarea } from "../ui/textarea";

const COMMENT_MAX = 2200;

/** Who a reply answers: the thread it joins and the @handle it starts with. */
export type CommentReply = { thread: PostComment; username: string };

/**
 * A post's comments, threads one reply deep. `preview` is the feed's peek:
 * the newest two threads with their newest reply, nothing else.
 */
export function CommentList({
  postId,
  preview = false,
  onReply,
  onCountChange,
}: {
  postId: string;
  preview?: boolean;
  onReply: (reply: CommentReply) => void;
  /** Comments removed (−), so the post's count keeps up. */
  onCountChange: (delta: number) => void;
}) {
  const { data: session } = useSession();
  const t = useT();
  const lang = useLang();
  const viewerId = session?.user?.id;
  // ponytail: the feed peek fetches the whole thread list; add a ?limit once
  // posts draw hundreds of comments.
  const { data, isLoading, isError } = useCommentsQuery(postId);
  const [deleteComment] = useDeleteCommentMutation();
  const [setCommentLike] = useSetCommentLikeMutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const remove = async (comment: PostComment) => {
    const result = await deleteComment({ id: comment.id, postId });
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("commentDeleteFailed"),
      });
      return;
    }
    onCountChange(-1 - (comment.replies?.length ?? 0));
  };

  const like = async (comment: PostComment) => {
    const result = await setCommentLike({
      id: comment.id,
      postId,
      liked: !comment.likedByMe,
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("likeFailed"),
      });
    }
  };

  const canDelete = (comment: PostComment) =>
    comment.author.id === viewerId || data?.postAuthorId === viewerId;

  if (preview && !data?.comments.length) return null;
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {t("commentsLoadFailed")}
      </p>
    );
  }
  if (!data?.comments.length) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <p className="text-lg font-semibold">{t("noCommentsYet")}</p>
        <p className="text-sm text-muted-foreground">{t("startConversation")}</p>
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col", preview ? "gap-3" : "gap-5")}>
      {(preview ? data.comments.slice(-2) : data.comments).map((thread) => {
        const replies = thread.replies ?? [];
        const showReplies = expanded.has(thread.id);
        const shown = preview ? replies.slice(-1) : showReplies ? replies : [];
        return (
          <li key={thread.id} className="flex flex-col gap-3">
            {[thread, ...shown].map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "group flex gap-3",
                  comment !== thread && "ms-11",
                  comment.pending && "pointer-events-none opacity-60",
                )}
              >
                <Link
                  href={`/${comment.author.username}`}
                  tabIndex={-1}
                  aria-hidden
                  className="shrink-0"
                >
                  <Avatar size={comment === thread ? "default" : "sm"}>
                    <AvatarImage
                      src={comment.author.profilePicture?.url}
                      alt=""
                    />
                    <AvatarFallback>
                      {comment.author.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm leading-relaxed break-words whitespace-pre-line">
                    <Link
                      href={`/${comment.author.username}`}
                      className="me-1.5 font-semibold hover:underline hover:underline-offset-4"
                    >
                      {comment.author.username}
                    </Link>
                    <Mentions text={comment.content} />
                  </p>
                  {comment.gif && (
                    // Animated webp from GIPHY: the optimiser would flatten it.
                    <Image
                      src={comment.gif.url}
                      alt={t("gif")}
                      width={comment.gif.width}
                      height={comment.gif.height}
                      unoptimized
                      className="h-auto max-h-48 w-auto max-w-48 rounded-lg"
                    />
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <time dateTime={comment.createdAt} suppressHydrationWarning>
                      {timeAgo(comment.createdAt, lang, t("timeNow"))}
                    </time>
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-pressed={comment.likedByMe}
                      aria-label={`${comment.likedByMe ? t("unlike") : t("like")}, ${t(comment.likeCount === 1 ? "oneLike" : "nLikes", { n: comment.likeCount.toLocaleString(lang) })}`}
                      onClick={() => void like(comment)}
                      className="h-auto p-0 font-normal text-muted-foreground tabular-nums hover:bg-transparent! active:scale-90"
                    >
                      <Heart
                        aria-hidden
                        weight={comment.likedByMe ? "Filled" : "Outline"}
                        className={cn(
                          "size-3.5",
                          comment.likedByMe && "text-destructive",
                        )}
                      />
                      {comment.likeCount.toLocaleString(lang)}
                    </Button>
                    <Button
                      variant="link"
                      size="xs"
                      onClick={() => {
                        setExpanded((e) => new Set(e).add(thread.id));
                        onReply({ thread, username: comment.author.username });
                      }}
                      className="h-auto p-0 text-muted-foreground"
                    >
                      {t("reply")}
                    </Button>
                    {canDelete(comment) && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("deleteComment")}
                        onClick={() => void remove(comment)}
                        className="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
                      >
                        <Trash aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!preview && replies.length > 0 && (
              <Button
                variant="link"
                size="xs"
                onClick={() =>
                  setExpanded((e) => {
                    const next = new Set(e);
                    if (showReplies) next.delete(thread.id);
                    else next.add(thread.id);
                    return next;
                  })
                }
                className="ms-11 h-auto self-start p-0 text-muted-foreground before:me-3 before:inline-block before:h-px before:w-6 before:bg-border"
              >
                {showReplies
                  ? t("hideReplies")
                  : t("viewReplies", { n: replies.length.toLocaleString(lang) })}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The always-there comment field: Enter posts, Shift+Enter breaks the line. */
export function CommentBox({
  postId,
  reply,
  inputRef,
  onCancelReply,
  onPosted,
  className,
}: {
  postId: string;
  reply: CommentReply | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onCancelReply: () => void;
  onPosted: () => void;
  className?: string;
}) {
  const t = useT();
  const [addComment] = useAddCommentMutation();
  const me = useSession().data?.user;
  const [text, setText] = useState("");
  // Starting (or cancelling) a reply swaps in its @handle.
  const [prefilled, setPrefilled] = useState(reply);
  if (reply !== prefilled) {
    setPrefilled(reply);
    setText(reply ? `@${reply.username} ` : "");
  }

  // A picked GIF goes at once, with whatever is typed as its text.
  const submit = async (gif?: Gif) => {
    const content = text.trim();
    if ((!content && !gif) || !me) return;
    // It shows in the thread at once; the field is ready for the next one.
    setText("");
    const result = await addComment({
      postId,
      content,
      gif,
      parentId: reply?.thread.id,
      author: {
        id: me.id,
        username: me.username,
        profilePicture: me.profilePicture,
      },
    });
    if ("error" in result) {
      setText(content);
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          t("commentPostFailed"),
      });
      return;
    }
    onPosted();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className={cn("flex flex-col", className)}
    >
      {reply && (
        <p className="flex h-8 items-center justify-between text-xs text-muted-foreground">
          {t("replyingTo", { name: reply.username })}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("cancelReply")}
            onClick={onCancelReply}
          >
            <X aria-hidden />
          </Button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={1}
          maxLength={COMMENT_MAX}
          aria-label={reply ? t("writeReply") : t("addComment")}
          placeholder={`${reply ? t("writeReply") : t("addComment")}…`}
          className="max-h-32 min-h-8 min-w-0 flex-1 resize-none border-none bg-transparent! py-1.5 focus-visible:ring-0"
        />
        {text.trim() && (
          <Button
            type="submit"
            variant="link"
            size="sm"
            className="px-0"
          >
            <Send2 />
          </Button>
        )}
        <GifPicker onPick={(gif) => void submit(gif)} />
        <EmojiButton
          onEmoji={(emoji) => {
            const next = insertEmoji(inputRef.current, text, emoji);
            setText(next.value);
            requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.setSelectionRange(next.caret, next.caret);
            });
          }}
        />
      </div>
    </form>
  );
}
