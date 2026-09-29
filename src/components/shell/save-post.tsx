"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Add, Bookmark, TickCircle } from "reicon-react";

import { cn } from "@/lib/utils";
import {
  useCreateCollectionMutation,
  useSaveStateQuery,
  useSetSavedMutation,
  type ApiError,
} from "@/store/api";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";

/**
 * Bookmark: a press saves the post and offers the collections to file it in;
 * a press on a saved post unsaves it (and takes it out of every collection).
 */
export default function SavePost({
  postId,
  saved: initial,
  className,
  onSavedChange,
}: {
  postId: string;
  saved: boolean;
  className?: string;
  /** Tells a parent that keeps its own copy of the saved state. */
  onSavedChange?: (saved: boolean) => void;
}) {
  const router = useRouter();
  const t = useT();
  const [saved, setSavedState] = useState(initial);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const { data, isFetching } = useSaveStateQuery(postId, { skip: !open });
  const [setSaved] = useSetSavedMutation();
  const [createCollection, { isLoading: naming }] =
    useCreateCollectionMutation();

  const fail = (error: unknown, fallback: string) =>
    toast.add({
      type: "error",
      description: (error as ApiError).data?.message ?? fallback,
    });

  const toggle = async () => {
    const next = !saved;
    setSavedState(next);
    onSavedChange?.(next);
    setOpen(next);
    const result = await setSaved({ postId, saved: next });
    if ("error" in result) {
      setSavedState(!next);
      onSavedChange?.(!next);
      setOpen(false);
      fail(result.error, t("savedUpdateFailed"));
      return;
    }
    // Profile's Saved tab is server-rendered; bring it up to date.
    router.refresh();
  };

  const toggleCollection = async (collectionId: string, contains: boolean) => {
    const result = await setSaved({ postId, saved: !contains, collectionId });
    if ("error" in result)
      fail(result.error, t("collectionUpdateFailed"));
    else router.refresh();
  };

  const create = async () => {
    const result = await createCollection({ name: name.trim(), postId });
    if ("error" in result) {
      fail(result.error, t("collectionCreateFailed"));
      return;
    }
    setName("");
    setCreating(false);
    router.refresh();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (details.reason === "trigger-press") void toggle();
        else {
          setOpen(next);
          if (!next) setCreating(false);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={saved}
            aria-label={saved ? t("removeFromSaved") : t("save")}
            className={cn(
              "active:scale-90 motion-reduce:transition-none hover:scale-105 hover:bg-transparent!",
              className,
            )}
          />
        }
      >
        <Bookmark
          aria-hidden
          weight={saved ? "Filled" : "Outline"}
          className="size-6"
        />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 gap-3 p-3">
        <p className="text-sm font-semibold">{t("savedAddToCollection")}</p>
        {isFetching && !data ? (
          <div className="flex h-12 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          data &&
          data.collections.length > 0 && (
            <ul className="-mx-1 flex max-h-48 flex-col overflow-y-auto">
              {data.collections.map((c) => (
                <li key={c.id}>
                  <Button
                    variant="ghost"
                    onClick={() => void toggleCollection(c.id, c.contains)}
                    aria-pressed={c.contains}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.contains && <TickCircle aria-hidden weight="Filled" />}
                  </Button>
                </li>
              ))}
            </ul>
          )
        )}
        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) void create();
            }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              aria-label={t("collectionName")}
              placeholder={t("collectionName")}
              disabled={naming}
            />
            <Button type="submit" size="sm" disabled={!name.trim() || naming}>
              {naming ? <Spinner /> : t("add")}
            </Button>
          </form>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <Add aria-hidden data-icon="inline-start" />
            {t("newCollection")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
