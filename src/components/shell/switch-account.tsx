"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";

import { FEED_PATH } from "@/lib/utils";
import { loginSchema } from "@/lib/validations";
import { api } from "@/store/api";
import LoginForm from "../forms/login-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useT } from "../i18n-provider";
import { toast } from "../ui/toast";
import { Button } from "../ui/button";
import { FieldSeparator } from "../ui/field";
import { type IconComponent } from "reicon-react";

const FORM_ID = "switch-account-form";

/**
 * Logs into another account. Sessions are JWTs, so a successful sign-in
 * overwrites the session cookie: the old session is gone, the new one in place.
 * A failed password attempt leaves the current session untouched; Google has
 * to sign out first (see `onGoogleSwitch`).
 */
export function SwitchAccountDialog({
  switchAccountButtonVariant,
  switchAccountButtonLabel,
  switchAccountButtonIcon: SwitchAccountButtonIcon,
  className,
}: {
  switchAccountButtonVariant:
    | "link"
    | "ghost"
    | "outline"
    | "secondary"
    | "destructive"
    | "default";
  switchAccountButtonLabel: string;
  switchAccountButtonIcon?: IconComponent;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const dispatch = useDispatch();
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoggingIn(true);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      rememberMe: String(data.rememberMe),
      redirect: false,
    });
    setIsLoggingIn(false);

    if (result?.error) {
      toast.add({
        type: "error",
        description:
          result.code === "rate_limited"
            ? t("tooManyAttempts")
            : t("invalidCredentials"),
      });
      return;
    }

    form.reset();
    setOpen(false);
    // Cached feed/likes belong to the previous account.
    dispatch(api.util.resetApiState());
    router.push(FEED_PATH);
    router.refresh();
  };

  const onGoogleSwitch = async () => {
    setIsLoggingIn(true);
    // Signed in, Auth.js treats a Google sign-in as "link this Google account
    // to me": a new one would be attached to the current account, someone
    // else's is refused. Signed out, it's a plain sign-in: the same Google
    // account lands back on the feed, another one switches (or onboards).
    await signOut({ redirect: false });
    // select_account: otherwise Google silently reuses the account it has.
    await signIn("google", { redirectTo: FEED_PATH }, { prompt: "select_account" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={switchAccountButtonVariant} className={className}>
            {SwitchAccountButtonIcon && (
              <SwitchAccountButtonIcon aria-hidden size={20} />
            )}
            {switchAccountButtonLabel}
          </Button>
        }
      />
      <DialogContent className="max-w-md! p-10">
        <DialogHeader>
          <DialogTitle>{t("switchAccounts")}</DialogTitle>
          <DialogDescription>
            {t("switchAccountsBody")}
          </DialogDescription>
        </DialogHeader>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
          <LoginForm form={form} formId={FORM_ID} isLoggingIn={isLoggingIn} />
        </form>
        <FieldSeparator>{t("orContinueWith")}</FieldSeparator>
        <Button
          size="lg"
          variant="outline"
          type="button"
          disabled={isLoggingIn}
          onClick={() => void onGoogleSwitch()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            width="18px"
            height="18px"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.66 1.22 9.14 3.26l6.84-6.84C35.64 2.36 30.14 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          Google
        </Button>
      </DialogContent>
    </Dialog>
  );
}
