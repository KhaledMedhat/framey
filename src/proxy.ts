import { NextResponse } from "next/server";

import { FEED_PATH } from "@/lib/utils";
import { auth } from "@/server/auth";

// `/` hosts login, register and (for new Google users) onboarding.
export const proxy = auth((request) => {
  const user = request.auth?.user;
  const isAuthPage = request.nextUrl.pathname === "/";

  // Logged out, or signed in but still onboarding: `/` is the only page.
  if (!user?.id || !user.profileComplete) {
    return isAuthPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/", request.nextUrl));
  }

  // Fully signed in: keep them off the auth page.
  if (isAuthPage) {
    return NextResponse.redirect(new URL(FEED_PATH, request.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // Skip API routes (they check the session themselves), Next internals and
  // any path with a file extension (public/ assets like /framey_white.png).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
