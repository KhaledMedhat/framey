import Link from "next/link";

/** Text with every `@username` linked to that profile. */
export default function Mentions({ text }: { text: string }) {
  // The capture group keeps the handles in the split: they land on odd indexes.
  return text.split(/(@[a-z0-9_]{1,30})/gi).map((part, i) =>
    i % 2 ? (
      <Link
        key={i}
        href={`/${part.slice(1).toLowerCase()}`}
        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {part}
      </Link>
    ) : (
      part
    ),
  );
}
