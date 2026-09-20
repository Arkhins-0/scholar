import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import Alert from "@/components/Alert";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick a strong password you have not used here before."
      image="reading"
      footer={
        <>
          Link expired?{" "}
          <Link href="/forgot-password" className="link font-medium">
            Request a new one
          </Link>
        </>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-3">
          <Alert tone="error" title="Invalid reset link">
            This link is missing its token. Open the link from your email again, or request a new one.
          </Alert>
          <Link href="/forgot-password" className="btn-default w-full">
            Request a new link
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
