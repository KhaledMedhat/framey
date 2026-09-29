"use client";

import { useEffect, useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import type z from "zod";
import { Eye, EyeOff } from "reicon-react";
import { loginSchema } from "@/lib/validations";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Checkbox } from "../ui/checkbox";
import { cn } from "cn";
import { useT } from "../i18n-provider";

const LoginForm: React.FC<{
  form: UseFormReturn<z.infer<typeof loginSchema>>;
  formId: string;
  isLoggingIn: boolean;
}> = ({ form, formId, isLoggingIn }) => {
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  // useWatch, not form.watch(): the React Compiler memoizes render-time
  // form.watch() calls and never refreshes them.
  const values = useWatch({ control: form.control });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <Controller
        name="email"
        disabled={isLoggingIn}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
            <Input
              {...field}
              id="email"
              aria-invalid={fieldState.invalid}
              placeholder="framey@example.com"
              autoComplete="off"
            />
            {fieldState.invalid && (
              <FieldError
                className="animate-in fade-in slide-in-from-top-1 duration-200"
                errors={[fieldState.error]}
              />
            )}
          </Field>
        )}
      />
      <Controller
        name="password"
        disabled={isLoggingIn}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <Button type="button" size="sm" variant="link">
                {t("forgotPassword")}
              </Button>
            </div>
            <div className="relative">
              <Input
                {...field}
                id="password"
                type={showPassword ? "text" : "password"}
                aria-invalid={fieldState.invalid}
                placeholder="****************"
                autoComplete="off"
                className="pe-11"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute inset-y-0 end-1 my-auto hover:bg-transparent! active:translate-y-0"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? (
                  <Eye className="text-muted-foreground" />
                ) : (
                  <EyeOff className="text-muted-foreground" />
                )}
              </Button>
            </div>

            {fieldState.invalid && (
              <FieldError
                className="animate-in fade-in slide-in-from-top-1 duration-200"
                errors={[fieldState.error]}
              />
            )}
          </Field>
        )}
      />

      <Controller
        name="rememberMe"
        disabled={isLoggingIn}
        control={form.control}
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              {...field}
              id="rememberMe"
              value={field.value ? "true" : "false"}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
            <FieldLabel htmlFor="rememberMe">{t("rememberMe")}</FieldLabel>
          </Field>
        )}
      />

      <Button
        disabled={
          isLoggingIn ||
          values.email === "" ||
          values.password === ""
        }
        type="submit"
        size="lg"
        form={formId}
      >
        {isLoggingIn ? (
          <>
            <Spinner /> {t("loggingIn")}
          </>
        ) : (
          t("login")
        )}
      </Button>
    </div>
  );
};

export default LoginForm;
