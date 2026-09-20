/** App-wide identity used in emails, titles and links. */
export const APP_NAME = "Scholar Track";
export const APP_TAGLINE = "PhD Scholar Tracking Portal";
export const ORG_NAME = "Research & Development Section";

/** Absolute URL for links in emails. Prefers NEXTAUTH_URL (set per environment). */
export function appUrl(path = "/"): string {
  const base = (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : `/${path}`);
}
