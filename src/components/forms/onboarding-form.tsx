"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";

import { completeProfileSchema } from "@/lib/validations";
import { FEED_PATH } from "@/lib/utils";
import { useCompleteProfileMutation, type ApiError } from "@/store/api";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Button } from "../ui/button";
import { toast } from "../ui/toast";

export default function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const [completeProfile, { isLoading }] = useCompleteProfileMutation();
  const form = useForm<z.infer<typeof completeProfileSchema>>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      username: "",
    },
  });

  // useWatch, not form.watch(): the React Compiler memoizes render-time
  // form.watch() calls and never refreshes them.
  const values = useWatch({ control: form.control });

  const onSubmit = async (data: z.infer<typeof completeProfileSchema>) => {
    const result = await completeProfile(data);

    if ("error" in result) {
      const error = result.error as ApiError;
      const conflict = error.data?.errors?.[0];
      if (conflict) {
        form.setError("username", { message: conflict.message });
      } else {
        toast.add({
          type: "error",
          description: error.data?.message ?? "Something went wrong.",
        });
      }
      return;
    }

    // Refresh the client session so `profileComplete` flips everywhere.
    await update();
    router.push(FEED_PATH);
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex flex-col items-start gap-1 text-start">
          <h2 className="text-2xl font-bold">Complete your profile</h2>
          <p className="text-sm text-muted-foreground">
            Google accounts do not need a password here. Add the remaining
            profile details to finish setup.
          </p>
        </div>
        <Controller
          name="username"
          disabled={isLoading}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
              <FieldLabel htmlFor="username">
                Username <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="username"
                name={field.name}
                placeholder="Enter your username"
                value={field.value}
                onChange={field.onChange}
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

        <Button
          type="submit"
          size="lg"
          disabled={isLoading || !values.username}
        >
          {isLoading ? (
            <>
              <Spinner /> Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
