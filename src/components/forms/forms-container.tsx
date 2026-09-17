"use client";

import { useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loginSchema, registerSchema } from "@/lib/validations";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";
import { Field, FieldGroup, FieldSeparator } from "../ui/field";
import { Button } from "../ui/button";
import RegisterForm from "./register-form";
import LoginForm from "./login-form";

const LOGIN_FORM_ID = "login-form";
const SIGNUP_FORM_ID = "signup-form";

const FormsContainer = () => {
  const router = useRouter();
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  //   const { mutate: registerMutation } = api.auth.register.useMutation();

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
      gender: undefined,
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    console.log(data);
    // setIsSubmitting(true);

    // const result = await signIn("credentials", {
    //   email: data.email,
    //   password: data.password,
    //   redirect: false,
    // });

    // if (result?.error) {
    //   setIsSubmitting(false);
    //   toast.add({
    //     type: "error",
    //     description: "Invalid email or password.",
    //   });
    //   return;
    // } else {
    //   const session = await getSession();
    //   setIsSubmitting(false);
    //   loginForm.reset();
    //   router.push(`/${session?.user.slug}`);
    // }
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    console.log(data);
    // setIsSubmitting(true);
    // const uploadedProfilePicture = await resizeAndUploadProfilePicture(data.profilePicture);
    // if (uploadedProfilePicture?.error) {
    //     setIsSubmitting(false);
    //     toast.add({
    //         type: "error",
    //         description: uploadedProfilePicture.error.message,
    //     })
    //     return;
    // }
    // registerMutation({
    //     ...data,
    //     profilePicture: uploadedProfilePicture && uploadedProfilePicture.data?.ufsUrl ? {
    //         url: uploadedProfilePicture?.data?.ufsUrl,
    //         type: uploadedProfilePicture?.data?.type,
    //         size: uploadedProfilePicture?.data?.size,
    //         key: uploadedProfilePicture?.data?.key,
    //     } : undefined,
    // }, {
    //     onSuccess: () => {
    //         setIsLoginView(true);
    //         registerForm.reset()
    //         setIsSubmitting(false);
    //         toast.add({
    //             type: "success",
    //             description: "Account created successfully 🎉.",
    //         })
    //     },
    //     onError: (error) => {
    //         if (error.message === ConflictCause.EMAIL_ADDRESS) {
    //             registerForm.setError("email", { message: error.message });
    //         }
    //         else if (error.message === ConflictCause.USERNAME) {
    //             registerForm.setError("username", { message: error.message });
    //         } else {
    //             toast.add({
    //                 type: "error",
    //                 description: error.message,
    //             })
    //         }
    //         setIsSubmitting(false);

    //     },
    // });
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
