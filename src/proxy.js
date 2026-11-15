import { NextResponse } from "next/server";
import { decideAccess } from "@/infrastructure/access/decide-access.js";

export const COOKIE_NAME = "k-spec-token";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Token-link access gate. See docs: one shared token, cookie once presented. */
export function proxy(request) {
  const url = request.nextUrl;
  const decision = decideAccess({
    pathname: url.pathname,
    queryToken: url.searchParams.get("token") ?? undefined,
    cookieToken: request.cookies.get(COOKIE_NAME)?.value,
    expected: process.env.K_SPEC_TOKEN ?? "",
  });

  switch (decision.action) {
    case "pass":
      return NextResponse.next();
    case "set-cookie-and-redirect": {
      const clean = url.clone();
      clean.searchParams.delete("token");
      const response = NextResponse.redirect(clean);
      response.cookies.set({
        name: COOKIE_NAME,
        value: decision.token,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: THIRTY_DAYS,
      });
      return response;
    }
    default: {
      const target = url.clone();
      target.pathname = "/access";
      target.search = decision.error ? "?error=1" : "";
      return NextResponse.redirect(target);
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
