import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200";

export async function middleware(request: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") || "" },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    const session = await res.json();
    if (!session?.session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!auth|_next/static|_next/image|favicon.ico|icon.svg|api).*)",
  ],
};
