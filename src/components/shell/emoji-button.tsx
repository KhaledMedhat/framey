"use client";

import { useState } from "react";
import { EmojiHappy } from "reicon-react";

import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "../ui/emoji-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

/** `value` with `emoji` at the field's caret (or the end), and where the caret goes next. */
export function insertEmoji(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  emoji: string,
) {
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? value.length;
  return {
    value: value.slice(0, start) + emoji + value.slice(end),
    caret: start + emoji.length,
  };
}

/** Smiley button opening frimousse's picker; each pick closes it. */
export default function EmojiButton({
  onEmoji,
  disabled,
  className,
}: {
  onEmoji: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("addEmoji")}
            disabled={disabled}
            className={className}
          />
        }
      >
        <EmojiHappy aria-hidden className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit gap-0 p-0">
        <EmojiPicker
          className="h-80"
          onEmojiSelect={({ emoji }) => {
            onEmoji(emoji);
            setOpen(false);
          }}
        >
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
