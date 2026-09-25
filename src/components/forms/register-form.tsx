"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import type z from "zod";
import { Eye, EyeOff, X } from "reicon-react";
import { registerSchema } from "@/lib/validations";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Dialog, DialogContent } from "../ui/dialog";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { cn } from "cn";
import { ImageEditor } from "../editors/image-editor";

function ProfilePicturePreview({
  file,
  form,
}: {
  file: File | undefined;
  form: UseFormReturn<z.infer<typeof registerSchema>>;
}) {
  // Derived from `file`, so no state; the effect only frees the old URL.
  const src = useMemo(
    () => (file instanceof File ? URL.createObjectURL(file) : undefined),
    [file],
  );
  useEffect(() => {
    if (src) return () => URL.revokeObjectURL(src);
  }, [src]);

  return (
    <div className="relative w-full flex justify-center">
      <Avatar size="xl">
        <AvatarImage
          src={src ? src : "/male_vector_placeholder.jpg"}
          alt={file?.name ?? "Avatar"}
        />
        <AvatarFallback>{file?.name || "Avatar"}</AvatarFallback>
        {file && (
          <AvatarBadge
            onClick={() => {
              form.resetField("profilePicture");
            }}
            className="top-1 right-2 bg-destructive"
          >
            <X />
          </AvatarBadge>
        )}
      </Avatar>
    </div>
  );
}

const RegisterForm: React.FC<{
  form: UseFormReturn<z.infer<typeof registerSchema>>;
  formId: string;
  isRegistering: boolean;
}> = ({ form, formId, isRegistering }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [editorStage, setEditorStage] = useState<"crop" | "edit">("crop");
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);
  const [openProfilePictureEditor, setOpenProfilePictureEditor] =
    useState<boolean>(false);
  // useWatch, not form.watch(): the React Compiler memoizes render-time
  // form.watch() calls and never refreshes them.
  const values = useWatch({ control: form.control });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Dialog
      open={openProfilePictureEditor}
      onOpenChange={(open) => {
        if (!open) {
          form.setValue("profilePicture", undefined);
          setEditorStage("crop");
          setOpenProfilePictureEditor(false);
        }
      }}
    >
      <DialogContent
        className={cn(
          "max-h-screen w-full min-w-0 overflow-hidden",
          "gap-2 px-0 duration-300 ease-out motion-reduce:transition-none",
          "transition-[max-width] max-[50rem]:-translate-x-1/2 min-[44rem]:-translate-x-84",
          editorStage === "edit"
            ? "max-w-[min(60rem,calc(100%-2rem))]!"
            : "max-w-2xl!",
        )}
      >
        <ImageEditor
          onStageChange={setEditorStage}
          showPrimaryButtons={true}
          file={values.profilePicture}
          onCancel={() => {
            form.setValue("profilePicture", undefined);
            setEditorStage("crop");
            setOpenProfilePictureEditor(false);
          }}
          onDone={(media) => {
            form.setValue("profilePicture", media[0]?.file);
            setEditorStage("crop");
            setOpenProfilePictureEditor(false);
          }}
        />
      </DialogContent>
      <div
        className={cn(
          "flex flex-col gap-4 transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <Controller
          name="profilePicture"
          control={form.control}
          // Not `disabled` here: RHF drops disabled fields from the submitted
          // values, so the picture would never reach the server. The <Input>
          // below disables itself instead.
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="w-full">
              <FieldLabel htmlFor="profilePicture">Profile Picture</FieldLabel>
              <div className="relative">
                <ProfilePicturePreview file={field.value} form={form} />
                <Input
                  id="profilePicture"
                  disabled={
                    isRegistering || values.profilePicture !== undefined
                  }
                  name={field.name}
                  className="rounded-full size-37.5! absolute inset-0 mx-auto opacity-0 disabled:opacity-0"
                  ref={field.ref}
                  type="file"
                  accept="image/*"
                  aria-invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange(event.target.files?.[0]);
                    setEditorStage("crop");
                    setOpenProfilePictureEditor(true);
                  }}
                />
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
        <div className="flex items-start gap-3">
          <Controller
            name="firstName"
            control={form.control}
            disabled={isRegistering}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="min-w-0 flex-1"
              >
                <FieldLabel htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="firstName"
                  aria-invalid={fieldState.invalid}
                  placeholder="John"
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
            name="lastName"
            control={form.control}
            disabled={isRegistering}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="min-w-0 flex-1"
              >
                <FieldLabel htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="lastName"
                  aria-invalid={fieldState.invalid}
                  placeholder="Doe"
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
        </div>
        <Controller
          name="username"
          control={form.control}
          disabled={isRegistering}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="username">
                Username <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="username"
                aria-invalid={fieldState.invalid}
                placeholder="Enter your username"
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
          name="email"
          control={form.control}
          disabled={isRegistering}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">
                Email <span className="text-destructive">*</span>
              </FieldLabel>
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
          control={form.control}
          disabled={isRegistering}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </FieldLabel>
                <Button type="button" size="sm" variant="link">
                  Forgot password?
                </Button>
              </div>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  aria-invalid={fieldState.invalid}
                  placeholder="****************"
                  autoComplete="off"
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <Eye className="text-muted-foreground" />
                    ) : (
                      <EyeOff className="text-muted-foreground" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
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
          name="confirmPassword"
          control={form.control}
          disabled={isRegistering}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirmPassword">
                Confirm Password <span className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  aria-invalid={fieldState.invalid}
                  placeholder="****************"
                  autoComplete="off"
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <Eye className="text-muted-foreground" />
                    ) : (
                      <EyeOff className="text-muted-foreground" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && (
                <FieldError
                  className="animate-in fade-in slide-in-from-top-1 duration-200"
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />

        <Button
          disabled={
            isRegistering ||
            values.firstName === "" ||
            values.lastName === "" ||
            values.email === "" ||
            values.password === "" ||
            values.confirmPassword === ""
          }
          type="submit"
          size="lg"
          form={formId}
        >
          {isRegistering ? (
            <>
              {" "}
              <Spinner /> Signing up{" "}
            </>
          ) : values.profilePicture === undefined ? (
            "Skip without a profile picture"
          ) : (
            "Sign up"
          )}
        </Button>
      </div>
    </Dialog>
  );
};

export default RegisterForm;
