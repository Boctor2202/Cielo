import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const CANONICAL = "geardown.app";
/** Old and default hosts that must send visitors to the real domain (a sign-in started there would return there). */
const OLD_HOSTS = new Set(["cielo-ecru.vercel.app", "stratologbook.com", "www.stratologbook.com", "www.geardown.app"]);

export default function proxy(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  if (OLD_HOSTS.has(host)) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL}`);
    return NextResponse.redirect(url, 308);
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|data|.*\\..*).*)"],
};
