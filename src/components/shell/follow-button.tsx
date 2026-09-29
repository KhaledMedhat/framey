"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "reicon-react";

import { useSetFollowMutation, type ApiError } from "@/store/api";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "../ui/toast";

/** 1234 → "1,234", 12345 → "12.3K": Instagram's count scale. */
export const compact = (n: number, lang: string) =>
  n < 10_000
    ? n.toLocaleString(lang)
    : Intl.NumberFormat(lang, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);

/**
 * Follow / Requested / Following ▾ with an optimistic flip. A private account
 * gets a request instead of a follow. The server page re-renders afterwards
 * so the counts and the grid catch up.
 */
export function FollowButton({
  username,
  following: initialFollowing,
  requested: initialRequested,
  followsMe,
  size,
  className,
}: {
  username: string;
  following: boolean;
  requested: boolean;
  followsMe: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [state, setState] = useState({
    following: initialFollowing,
    requested: initialRequested,
  });
  const [setFollow, { isLoading }] = useSetFollowMutation();

  const toggle = async (next: boolean) => {
    const before = state;
    setState({ following: next, requested: false });
    const result = await setFollow({ username, following: next });
    if ("error" in result) {
      setState(before);
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          `Couldn't ${next ? "follow" : "unfollow"} @${username}. Try again.`,
      });
      return;
    }
    setState({
      following: result.data.following,
      requested: result.data.requested,
    });
    router.refresh();
  };

  if (state.following) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="secondary" size={size} className={className} />
          }
        >
          {t("following")}
          <ChevronDown aria-hidden data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48 p-1.5">
          <DropdownMenuItem
            onClick={() => void toggle(false)}
            className="h-10 px-3"
          >
            {t("unfollow")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (state.requested) {
    return (
      <Button
        variant="secondary"
        size={size}
        disabled={isLoading}
        title={t("withdrawRequest")}
        onClick={() => void toggle(false)}
        className={className}
      >
        {t("requested")}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      disabled={isLoading}
      onClick={() => void toggle(true)}
      className={className}
    >
      {followsMe ? t("followBack") : t("follow")}
    </Button>
  );
}
