/** Square monogram: an open book. Inherits `currentColor` for the tile. */
export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={className}
      style={{ color: "rgb(var(--fg))" }}
    >
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <path fill="rgb(var(--bg))" d="M6 9.5c3.2-1.6 6.3-1.6 9.2 0v13.2c-2.9-1.6-6-1.6-9.2 0z" />
      <path fill="rgb(var(--bg))" d="M16.8 9.5c2.9-1.6 6-1.6 9.2 0v13.2c-3.2-1.6-6.3-1.6-9.2 0z" />
    </svg>
  );
}
