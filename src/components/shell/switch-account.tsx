"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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
import { type IconComponent } from "reicon-react";

const FORM_ID = "switch-account-form";

/**
 * Logs into another account. Sessions are JWTs, so a successful sign-in
 * overwrites the session cookie: the old session is gone, the new one in place.
 * A failed attempt leaves the current session untouched.
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
      </DialogContent>
    </Dialog>
  );
}
