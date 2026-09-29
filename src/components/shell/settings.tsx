"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Add,
  LanguageSquare,
  Lock,
  Search,
  Star,
  TickCircle,
  UserBlock,
  UserEdit,
  X,
  type IconComponent,
} from "reicon-react";

import { AccountVisibility, Gender } from "@/interfaces/general.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { LANGUAGES, type DictKey, type Lang } from "@/lib/i18n";
import { cn, getFullName } from "@/lib/utils";
import {
  editProfileSchema,
  WEBSITES_MAX,
  type EditProfileInput,
} from "@/lib/validations";
import { setLanguage } from "@/server/language-action";
import type { AccountPreview } from "@/store/api";
import {
  useChangePhotoMutation,
  useEditProfileMutation,
  useSetBlockedMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { ImageEditor } from "../editors/image-editor";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../ui/field";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/toast";

const SECTIONS: {
  href: string;
  label: DictKey;
  icon: IconComponent;
  /** English words the settings search also matches. */
  keywords: string;
}[] = [
  {
    href: "/settings/edit-profile",
    label: "editProfile",
    icon: UserEdit,
    keywords: "edit profile name bio photo picture avatar",
  },
  {
    href: "/settings/privacy",
    label: "accountPrivacy",
    icon: Lock,
    keywords: "account privacy private public visibility",
  },
  {
    href: "/settings/close-friends",
    label: "closeFriends",
    icon: Star,
    keywords: "close friends story stories list",
  },
  {
    href: "/settings/blocked",
    label: "blocked",
    icon: UserBlock,
    keywords: "blocked block unblock accounts",
  },
  {
    href: "/settings/language",
    label: "language",
    icon: LanguageSquare,
    keywords: "language translate app english arabic",
  },
];

/**
 * Settings' sidebar: a search over the sections, then the sections. On a
 * phone it is the whole `/settings` page and hides on the sections themselves.
 */
export function SettingsNav() {
  const t = useT();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = SECTIONS.filter(
    (s) => !q || `${t(s.label)} ${s.keywords}`.toLowerCase().includes(q),
  );

  return (
    <aside
      className={cn(
        "w-full shrink-0 flex-col gap-4 px-4 pt-6 md:sticky md:top-0 md:flex md:h-svh md:w-80 md:border-e md:pt-10",
        pathname === "/settings" ? "flex" : "hidden",
      )}
    >
      <h1 className="px-2 text-xl font-bold">{t("settings")}</h1>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchSettings")}
          aria-label={t("searchSettings")}
          className="h-11 rounded-lg ps-10"
        />
      </div>
      <nav aria-label={t("settings")}>
        {shown.length ? (
          <ul className="flex flex-col gap-1">
            {shown.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                    pathname === href && "bg-muted font-semibold",
                  )}
                >
                  <Icon aria-hidden size={22} />
                  {t(label)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        )}
      </nav>
    </aside>
  );
}

const profileFields = editProfileSchema.omit({ visibility: true });
type ProfileFields = Omit<EditProfileInput, "visibility">;

export function EditProfileForm({
  user,
}: {
  user: {
    username: string;
    firstName: string;
    lastName: string;
    websites: string[];
    bio: string | null;
    gender: Gender | null;
    profilePicture: ProfilePicture | null;
  };
}) {
  const t = useT();
  const router = useRouter();
  const [editProfile, { isLoading }] = useEditProfileMutation();
  const [changePhoto, { isLoading: uploading }] = useChangePhotoMutation();
  /** The picked photo, open in the crop/filter editor until Done or Cancel. */
  const [photo, setPhoto] = useState<File | null>(null);
  const [editorStage, setEditorStage] = useState<"crop" | "edit">("crop");
  const form = useForm<ProfileFields>({
    resolver: zodResolver(profileFields),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      websites: user.websites.length ? user.websites : [""],
      bio: user.bio ?? "",
      gender: user.gender,
    },
  });

  const fail = (error: unknown) =>
    toast.add({
      type: "error",
      description: (error as ApiError).data?.message ?? t("somethingWrong"),
    });

  const onSubmit = async (data: ProfileFields) => {
    const result = await editProfile(data);
    if ("error" in result) return fail(result.error);
    toast.add({ description: t("profileSaved") });
    router.refresh();
  };

  const closeEditor = () => {
    setPhoto(null);
    setEditorStage("crop");
  };

  /** The server squares, shrinks and re-encodes it with sharp. */
  const uploadPhoto = async (file: File | undefined) => {
    closeEditor();
    if (!file) return;
    const result = await changePhoto(file);
    if ("error" in result) return fail(result.error);
    router.refresh();
  };

  const genders = [
    { value: Gender.MALE, label: t("male") },
    { value: Gender.FEMALE, label: t("female") },
    { value: Gender.PREFER_NOT_TO_SAY, label: t("preferNotToSay") },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
      <div className="flex items-center gap-4 rounded-2xl bg-muted p-4">
        <Avatar className="size-14">
          <AvatarImage src={user.profilePicture?.url} alt="" />
          <AvatarFallback>
            {`${user.firstName[0]}${user.lastName[0]}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">{user.username}</p>
          <p className="truncate text-muted-foreground">
            {getFullName(user.firstName, user.lastName)}
          </p>
        </div>
        <Button
          render={<label />}
          nativeButton={false}
          disabled={uploading}
          className="cursor-pointer"
        >
          {uploading ? <Spinner /> : t("changePhoto")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              // Picking the same file again must still open the editor.
              event.target.value = "";
            }}
          />
        </Button>
      </div>

      <Dialog open={photo !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent
          className={cn(
            "max-h-screen w-full min-w-0 gap-2 overflow-hidden px-0 transition-[max-width] duration-300 ease-out motion-reduce:transition-none",
            editorStage === "edit"
              ? "max-w-[min(60rem,calc(100%-2rem))]!"
              : "max-w-2xl!",
          )}
        >
          <DialogTitle className="sr-only">{t("changePhoto")}</DialogTitle>
          {photo && (
            <ImageEditor
              file={photo}
              showPrimaryButtons
              onStageChange={setEditorStage}
              onCancel={closeEditor}
              onDone={(media) => void uploadPhoto(media[0]?.file)}
            />
          )}
        </DialogContent>
      </Dialog>

      <FieldGroup className="gap-6">
        <div className="grid grid-cols-2 gap-3">
          {(["firstName", "lastName"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              disabled={isLoading}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={name} className="font-semibold">
                    {t(name)}
                  </FieldLabel>
                  <Input
                    id={name}
                    autoComplete={name === "firstName" ? "given-name" : "family-name"}
                    aria-invalid={fieldState.invalid}
                    className="h-11 rounded-xl"
                    {...field}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ))}
        </div>

        <Controller
          name="websites"
          control={form.control}
          disabled={isLoading}
          render={({ field, fieldState }) => {
            // Array fields report errors per row, by index.
            const rowErrors = fieldState.error as unknown as
              | ({ message?: string } | undefined)[]
              | undefined;
            const links = field.value.length ? field.value : [""];
            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="website-0" className="font-semibold">
                  {t("websites")}
                </FieldLabel>
                <div className="flex flex-col gap-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          id={`website-${i}`}
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          dir="ltr"
                          placeholder="instagram.com/you"
                          value={link}
                          disabled={field.disabled}
                          onBlur={field.onBlur}
                          onChange={(event) =>
                            field.onChange(
                              links.map((l, j) => (j === i ? event.target.value : l)),
                            )
                          }
                          aria-label={t("linkNumber", { n: String(i + 1) })}
                          aria-invalid={Boolean(rowErrors?.[i])}
                          className="h-11 rounded-xl"
                        />
                        {(links.length > 1 || link) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("removeLink")}
                            disabled={field.disabled}
                            onClick={() => field.onChange(links.filter((_, j) => j !== i))}
                          >
                            <X aria-hidden />
                          </Button>
                        )}
                      </div>
                      {rowErrors?.[i]?.message && <FieldError errors={[rowErrors[i]]} />}
                    </div>
                  ))}
                </div>
                {links.length < WEBSITES_MAX && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={field.disabled}
                    onClick={() => field.onChange([...links, ""])}
                    className="self-start px-0"
                  >
                    <Add aria-hidden data-icon="inline-start" />
                    {t("addLink")}
                  </Button>
                )}
                <FieldDescription className="text-xs">{t("websiteNote")}</FieldDescription>
                {fieldState.error?.message && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />

        <Controller
          name="bio"
          control={form.control}
          disabled={isLoading}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bio" className="font-semibold">
                {t("bio")}
              </FieldLabel>
              <div className="relative">
                <Textarea
                  id="bio"
                  rows={3}
                  placeholder={t("bioPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  className="resize-none rounded-xl pe-20"
                  {...field}
                />
                <span
                  className={cn(
                    "absolute end-3 bottom-2 text-xs text-muted-foreground tabular-nums",
                    field.value.length > 150 && "text-destructive",
                  )}
                >
                  {field.value.length} / 150
                </span>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="gender"
          control={form.control}
          disabled={isLoading}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="gender" className="font-semibold">
                {t("gender")}
              </FieldLabel>
              <Select
                items={genders}
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                disabled={field.disabled}
              >
                <SelectTrigger id="gender" className="h-12! w-full rounded-xl px-4">
                  <SelectValue placeholder={t("notSet")} />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription className="text-xs">{t("genderNote")}</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full">
        {isLoading ? <Spinner /> : t("submit")}
      </Button>
    </form>
  );
}

export function PrivacyToggle({ visibility }: { visibility: AccountVisibility }) {
  const t = useT();
  const router = useRouter();
  const [isPrivate, setIsPrivate] = useState(
    visibility === AccountVisibility.PRIVATE,
  );
  const [editProfile, { isLoading }] = useEditProfileMutation();

  const toggle = async (next: boolean) => {
    setIsPrivate(next);
    const result = await editProfile({
      visibility: next ? AccountVisibility.PRIVATE : AccountVisibility.PUBLIC,
    });
    if ("error" in result) {
      setIsPrivate(!next);
      toast.add({ type: "error", description: t("somethingWrong") });
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <label className="flex cursor-pointer items-center justify-between gap-6 rounded-2xl border p-4">
        <span>{t("privateAccount")}</span>
        <Switch
          checked={isPrivate}
          disabled={isLoading}
          onCheckedChange={(checked) => void toggle(checked)}
        />
      </label>
      <div className="flex flex-col gap-4 text-xs text-pretty text-muted-foreground">
        <p>{t("privacyPublicNote")}</p>
        <p>{t("privacyPrivateNote")}</p>
      </div>
    </div>
  );
}

export function BlockedList({ accounts }: { accounts: AccountPreview[] }) {
  const t = useT();
  const [list, setList] = useState(accounts);
  const [setBlocked, { isLoading, originalArgs }] = useSetBlockedMutation();

  const unblock = async (username: string) => {
    const result = await setBlocked({ username, blocked: false });
    if ("error" in result) {
      toast.add({ type: "error", description: t("somethingWrong") });
      return;
    }
    setList((l) => l.filter((a) => a.username !== username));
  };

  if (!list.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("noBlocked")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {list.map((account) => (
        <li key={account.id} className="flex items-center gap-3 py-2">
          <Avatar size="lg">
            <AvatarImage src={account.profilePicture?.url} alt="" />
            <AvatarFallback>
              {account.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold">{account.username}</span>
            <span className="block truncate text-muted-foreground">
              {getFullName(account.firstName, account.lastName)}
            </span>
          </span>
          <Button
            variant="secondary"
            disabled={isLoading && originalArgs?.username === account.username}
            onClick={() => void unblock(account.username)}
          >
            {t("unblock")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Saved in a cookie; the server renders every page in it. */
export function LanguagePicker() {
  const t = useT();
  const current = useLang();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = LANGUAGES.filter(
    (l) => !q || l.name.toLowerCase().includes(q) || l.code.includes(q),
  );

  const pick = async (code: Lang) => {
    await setLanguage(code);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t("appLanguage")}</h2>
        <p className="text-xs text-muted-foreground">{t("appLanguageNote")}</p>
      </div>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="h-11 rounded-full px-4"
      />
      <ul role="radiogroup" aria-label={t("appLanguage")} className="flex flex-col">
        {shown.map((l) => (
          <li key={l.code}>
            <button
              type="button"
              role="radio"
              aria-checked={l.code === current}
              lang={l.code}
              onClick={() => void pick(l.code)}
              className="flex h-12 w-full items-center justify-between rounded-lg px-4 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
            >
              {l.name}
              {l.code === current ? (
                <TickCircle aria-hidden weight="Filled" className="size-6" />
              ) : (
                <span
                  aria-hidden
                  className="size-6 rounded-full border-2 border-muted-foreground/60"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
