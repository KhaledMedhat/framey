"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loginSchema, registerSchema } from "@/lib/validations";
import { FEED_PATH } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";
import { Field, FieldGroup, FieldSeparator } from "../ui/field";
import { Button } from "../ui/button";
import RegisterForm from "./register-form";
import LoginForm from "./login-form";
import { toast } from "../ui/toast";
import { useRegisterMutation, type ApiError } from "@/store/api";

const LOGIN_FORM_ID = "login-form";
const SIGNUP_FORM_ID = "signup-form";

/** `?error=` values NextAuth (or our signIn callback) redirects back with. */
const AUTH_ERRORS: Record<string, string> = {
  "use-password":
    "An account with this email already exists. Log in with your email and password.",
};

const FormsContainer = ({ authError }: { authError?: string }) => {
  const router = useRouter();
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [register, { isLoading: isRegistering }] = useRegisterMutation();
  const isSubmitting = isLoggingIn || isRegistering;

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      profilePicture: undefined,
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoggingIn(true);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      rememberMe: String(data.rememberMe),
      redirect: false,
    });

    if (result?.error) {
      setIsLoggingIn(false);
      toast.add({
        type: "error",
        description:
          result.code === "rate_limited"
            ? "Too many attempts. Please try again later."
            : "Invalid email or password.",
      });
      return;
    }

    loginForm.reset();
    router.push(FEED_PATH);
    router.refresh();
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    const result = await register({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      username: data.username,
      password: data.password,
      profilePicture: data.profilePicture,
    });

    if ("error" in result) {
      const error = result.error as ApiError;
      if (error.data?.errors?.length) {
        for (const { field, message } of error.data.errors) {
          registerForm.setError(field, { message });
        }
      } else {
        toast.add({
          type: "error",
          description: error.data?.message ?? "Something went wrong.",
        });
      }
      return;
    }

    registerForm.reset();
    setIsLoginView(true);
    toast.add({ type: "success", description: "Account created successfully 🎉." });
  };

  const onGoogleSignIn = async () => {
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <form
      id={isLoginView ? LOGIN_FORM_ID : SIGNUP_FORM_ID}
      onSubmit={
        isLoginView
          ? loginForm.handleSubmit(onLoginSubmit)
          : registerForm.handleSubmit(onRegisterSubmit)
      }
    >
      <FieldGroup>
        <div className="flex flex-col items-start gap-1 text-start">
          <h2 className="text-2xl font-bold">
            {isLoginView ? "Login to Framey" : "Sign up to Framey"}
          </h2>
        </div>
        {authError && (
          <p role="alert" className="text-sm text-destructive">
            {AUTH_ERRORS[authError] ?? "Sign-in failed. Please try again."}
          </p>
        )}
        {isLoginView ? (
          <LoginForm
            form={loginForm}
            formId={LOGIN_FORM_ID}
            isLoggingIn={isSubmitting}
          />
        ) : (
          <RegisterForm
            form={registerForm}
            formId={SIGNUP_FORM_ID}
            isRegistering={isSubmitting}
          />
        )}
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            size="lg"
            variant="outline"
            type="button"
            disabled={isSubmitting}
            onClick={() => void onGoogleSignIn()}
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
          <div className="text-center text-sm text-muted-foreground">
            {isLoginView
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <Button
              variant="link"
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsLoginView(!isLoginView)}
              className="h-auto p-0"
            >
              {isLoginView ? "Sign up" : "Login"}
            </Button>
          </div>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default FormsContainer;
