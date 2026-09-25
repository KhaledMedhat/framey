/**
 * The Framey mark without its wordmark: the frame and the dot from
 * public/framey_white.png, redrawn as vector so it stays crisp at icon size,
 * where the word would be about 6px tall.
 */
export default function FrameyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect x="1" y="1" width="30" height="30" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="25.4" cy="6.6" r="2.7" fill="currentColor" />
    </svg>
  );
}
