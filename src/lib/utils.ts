// One class-merging implementation: the `cn` package (clsx + tailwind-merge in
// one). Re-exported so shadcn-generated components importing it from here work.
export { cn } from "cn";

/** Signed-in home: `/[slug]` renders the current user's feed for this value. */
export const FEED_SLUG = "@me";
export const FEED_PATH = `/${FEED_SLUG}`;

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
