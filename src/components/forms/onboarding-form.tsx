"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";

import { CalendarSearch3 } from "reicon-react";
import { Gender } from "@/interfaces/form.interface";
import { completeProfileSchema } from "@/lib/validations";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { formatDate } from "@/lib/utils";
import { Spinner } from "../ui/spinner";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";

const genderItems = [
  { label: "Male", value: Gender.MALE },
  { label: "Female", value: Gender.FEMALE },
];

export default function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const completeProfile = {
    isPending: false,
  };
  const form = useForm<z.infer<typeof completeProfileSchema>>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      gender: undefined,
      dateOfBirth: "",
      username: "",
    },
  });

  // useWatch, not form.watch(): the React Compiler memoizes render-time
  // form.watch() calls and never refreshes them.
  const values = useWatch({ control: form.control });

  // const completeProfile = api.auth.completeProfile.useMutation({
  //     onSuccess: async (data) => {
  //         await update();
  //         router.push(`/${data?.slug}`);
  //         router.refresh();
  //     },
  //     onError: (error) => {
  //         if (error.data?.code === "UNAUTHORIZED") {
  //             toast.add({
  //                 type: "error",
  //                 description: "Your session expired. Sign in with Google again to continue.",
  //             })
  //             return;
  //         } else if (error.message === ConflictCause.USERNAME) {
  //             form.setError("username", { message: error.message });
  //         } else {
  //             toast.add({
  //                 type: "error",
  //                 description: error.message,
  //             })
  //         }

  //     },
  // });

  const onSubmit = (data: z.infer<typeof completeProfileSchema>) => {
    console.log(data);
    // completeProfile.mutate(data);
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
          disabled={completeProfile.isPending}
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
        <div className="flex items-start gap-3">
          <Controller
            name="gender"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="min-w-0 flex-1"
              >
                <FieldLabel htmlFor="gender">
                  Gender <span className="text-destructive">*</span>
                </FieldLabel>
                <Select
                  items={genderItems}
                  disabled={completeProfile.isPending}
                  name={field.name}
                  value={field.value ?? null}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-11!">
                    <SelectValue placeholder="Select a gender" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger>
                    <SelectGroup>
                      {genderItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
            name="dateOfBirth"
            control={form.control}
            disabled={completeProfile.isPending}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="min-w-0 flex-1"
              >
                <FieldLabel htmlFor="dateOfBirth">
                  Date of Birth <span className="text-destructive">*</span>
                </FieldLabel>
                <InputGroup className="h-11!">
                  <InputGroupInput
                    id="onboarding-date-of-birth"
                    {...field}
                    value={field.value?.toString()}
                    placeholder={formatDate(new Date())}
                    onChange={(event) => field.onChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(true);
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger
                        render={
                          <InputGroupButton
                            disabled={completeProfile.isPending}
                            id="onboarding-date-picker"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Select date"
                          >
                            <CalendarSearch3 />
                            <span className="sr-only">Select date</span>
                          </InputGroupButton>
                        }
                      />
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                        alignOffset={-8}
                        sideOffset={10}
                      >
                        <Calendar
                          captionLayout="dropdown"
                          mode="single"
                          onSelect={(date) => {
                            field.onChange(formatDate(date));
                            setOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
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
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={
            completeProfile.isPending ||
            form.watch("username") === "" ||
            form.watch("gender") === null ||
            form.watch("dateOfBirth") === ""
          }
        >
          {completeProfile.isPending ? (
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
