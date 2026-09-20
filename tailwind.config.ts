import type { Config } from "tailwindcss";

const withVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

/**
 * Design tokens are CSS variables (see app/globals.css) so every utility works
 * identically in light and dark. The visual language is GitHub-like: hairline
 * borders, square corners, quiet surfaces, one accent, semantic state colours.
 */
const config: Config = {
  darkMode: "class",
  content: ["./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    // No rounded corners anywhere except `rounded-full` (avatars, dots).
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "9999px",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: withVar("--bg"),
        header: withVar("--header"),
        surface: withVar("--surface"),
        elevated: withVar("--elevated"),
        line: withVar("--line"),
        fg: withVar("--fg"),
        muted: withVar("--muted"),
        faint: withVar("--faint"),
        accent: { DEFAULT: withVar("--accent"), fg: withVar("--accent-fg") },
        primary: { DEFAULT: withVar("--primary"), fg: withVar("--primary-fg") },
        success: withVar("--success"),
        danger: withVar("--danger"),
        attention: withVar("--attention"),
        done: withVar("--done"),
        underline: withVar("--nav-underline"),
        // legacy aliases still used by a few utilities
        brand: { DEFAULT: withVar("--accent"), fg: withVar("--accent-fg") },
      },
      boxShadow: {
        menu: "0 8px 24px rgb(0 0 0 / 0.18)",
      },
      maxWidth: {
        page: "1280px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(3px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
