import { NextResponse } from "next/server";
import { accessCookieNames, COOKIE_NAME, decideAccess } from "@/infrastructure/access/decide-access.js";

export { COOKIE_NAME };
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Token-link access gate: one shared token, kept in a cookie once presented. The cookie is
 * named for the port the browser used, so boards on other ports of the same host keep theirs.
 */
export function proxy(request) {
  const url = request.nextUrl;
  const cookieNames = accessCookieNames(request.headers.get("host") ?? url.host);
  const decision = decideAccess({
    pathname: url.pathname,
    queryToken: url.searchParams.get("token") ?? undefined,
    cookieTokens: cookieNames.map((name) => request.cookies.get(name)?.value),
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
        name: cookieNames[0],
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
