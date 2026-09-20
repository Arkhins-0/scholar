import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { APP_NAME, APP_TAGLINE, ORG_NAME } from "@/lib/site";

export type AuthImage = "library" | "shelves" | "reading";

const QUOTES: Record<AuthImage, { text: string; by: string }> = {
  library: {
    text: "Research is formalized curiosity. It is poking and prying with a purpose.",
    by: "Zora Neale Hurston",
  },
  shelves: {
    text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.",
    by: "Albert Einstein",
  },
  reading: {
    text: "If I have seen further, it is by standing on the shoulders of giants.",
    by: "Isaac Newton",
  },
};

/**
 * Split-screen frame for the public pages: photograph with a quotation on the
 * left, the form on the right. Collapses to the form alone on small screens.
 */
export default function AuthLayout({
  title,
  subtitle,
  image = "library",
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  image?: AuthImage;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const quote = QUOTES[image];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="relative hidden lg:block">
        <Image src={`/images/${image}.jpg`} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center bg-white text-black">
              <Logo size={36} className="[&_rect]:fill-white [&_path]:fill-black" />
            </span>
            <div>
              <div className="display text-lg leading-none">{APP_NAME}</div>
              <div className="mt-1 text-xs text-white/70">{APP_TAGLINE}</div>
            </div>
          </div>
          <figure className="max-w-md">
            <blockquote className="display text-3xl leading-snug">“{quote.text}”</blockquote>
            <figcaption className="mt-4 text-sm text-white/80">— {quote.by}</figcaption>
            <p className="mt-8 text-[11px] text-white/50">Photograph via Unsplash</p>
          </figure>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-header px-4 lg:border-0 lg:bg-transparent">
          <Link href="/login" className="flex items-center gap-2.5 lg:invisible">
            <Logo size={28} />
            <span className="display text-base leading-none">{APP_NAME}</span>
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[420px] animate-fade-in">
            <h1 className="display text-2xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-6 box p-5">{children}</div>
            {footer && <div className="mt-4 box bg-elevated px-5 py-3 text-center text-sm text-muted">{footer}</div>}
          </div>
        </main>

        <footer className="px-4 py-5 text-center text-xs text-muted">
          {APP_NAME} · {ORG_NAME}
        </footer>
      </div>
    </div>
  );
}
