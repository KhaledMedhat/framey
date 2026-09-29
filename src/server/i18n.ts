import { cookies } from "next/headers";

import { isLang, LANG_COOKIE, translator, type Lang } from "@/lib/i18n";

/** The language picked in Settings; English until then. */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : "en";
}

export const getT = async () => translator(await getLang());
