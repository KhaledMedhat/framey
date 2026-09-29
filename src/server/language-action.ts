"use server";

import { cookies } from "next/headers";

import { isLang, LANG_COOKIE } from "@/lib/i18n";

/** Remembers the picked language for a year; every page renders in it. */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
