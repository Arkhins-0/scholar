import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_HOME: Record<string, string> = {
  STUDENT: "/student/dashboard",
  STAFF: "/staff/dashboard",
  RND_ADMIN: "/admin/dashboard",
};

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    const path = req.nextUrl.pathname;

    // Staff/admin accounts with temporary passwords must change them before doing anything else.
    if (token.mustChangePassword && path !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    const role = token.role as string;
    if (
      (path.startsWith("/student") && role !== "STUDENT") ||
      (path.startsWith("/staff") && role !== "STAFF") ||
      (path.startsWith("/admin") && role !== "RND_ADMIN")
    ) {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/student/:path*", "/staff/:path*", "/admin/:path*", "/change-password"],
};
