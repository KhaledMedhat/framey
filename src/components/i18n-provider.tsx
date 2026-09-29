"use client";

import { createContext, useContext } from "react";

import { translator, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("en");

export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => useContext(LangContext);

export const useT = () => translator(useLang());
