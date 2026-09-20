import SessionProvider from "./SessionProvider";

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
