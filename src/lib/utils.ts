// One class-merging implementation: the `cn` package (clsx + tailwind-merge in
// one). Re-exported so shadcn-generated components importing it from here work.
export { cn } from "cn";

/** Signed-in home: `/[slug]` renders the current user's feed for this value. */
export const FEED_SLUG = "@me";
export const FEED_PATH = `/${FEED_SLUG}`;

/** How long a story stays live before it drops to the archive. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * "now", "12m", "5h", "3d", "2w", then a date: the feed's time scale, in
 * the reader's language ("٥ س" in Arabic, "5 Std." in German).
 */
export function timeAgo(iso: string, lang = "en", now = "now") {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return now;
  const steps: [number, "minute" | "hour" | "day" | "week"][] = [
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [5, "week"],
  ];
  let value = seconds / 60;
  for (const [size, unit] of steps) {
    if (value < size) {
      return new Intl.NumberFormat(lang, {
        style: "unit",
        unit,
        unitDisplay: "narrow",
      })
        .format(Math.floor(value))
        .replace(" ", "");
    }
    value /= size;
  }
  return new Date(iso).toLocaleDateString(lang, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Checks if a date is valid
 * @param date - The date to check
 * @returns True if the date is valid, false otherwise
 */
export function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !isNaN(date.getTime());
}

/**
 * Checks if a date is at least 18 years old
 * @param date - The date to check
 * @returns True if the date is at least 18 years old, false otherwise
 */
export function isAtLeast18YearsOld(date: Date | undefined) {
  if (!date || !isValidDate(date)) {
    return false;
  }

  const today = new Date();
  const minimumBirthDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );

  return date <= minimumBirthDate;
}

/**
 * Formats a date to a string
 * @param date - The date to format
 * @returns The formatted date string
 */
export function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Gets the initials of a name
 * @param firstName - The first name
 * @param lastName - The last name
 * @returns The initials of the name
 */
export function getInitials(firstName: string, lastName: string) {
  const fullName = getFullName(firstName, lastName);
  return `${fullName
    .split(" ")
    .map((name) => name.charAt(0))
    .join("")}`.toUpperCase();
}

/**
 * Gets the full name of a person
 * @param firstName - The first name
 * @param lastName - The last name
 * @returns The full name of the person
 */
export function getFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}
