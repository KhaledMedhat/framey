export const LANG_COOKIE = "lang";

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية", rtl: true },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "tr", name: "Türkçe" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const isLang = (value: unknown): value is Lang =>
  LANGUAGES.some((l) => l.code === value);

export const isRtl = (lang: Lang) =>
  LANGUAGES.some((l) => l.code === lang && "rtl" in l);

import ar from "./ar";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import tr from "./tr";

export type Dict = typeof en;
export type DictKey = keyof Dict;

const DICTS: Record<Lang, Dict> = { en, ar, de, es, fr, tr };

export type Translate = (key: DictKey, vars?: Record<string, string>) => string;

const BY_ENGLISH = new Map(
  Object.entries(en).map(([key, value]) => [value, key as DictKey]),
);

/**
 * A message that arrives in English (a server error, a zod error) in the
 * reader's language when the dictionary has it; as it came otherwise.
 */
export const translateMessage = (lang: Lang, message: string) => {
  const key = BY_ENGLISH.get(message);
  return key ? (DICTS[lang][key] ?? en[key]) : message;
};

export const translator =
  (lang: Lang): Translate =>
  (key, vars) =>
    // A key missing from a language falls back to English, then to itself.
    (DICTS[lang][key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => vars?.[name] ?? "");
