import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/login")) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/auth/")) return NextResponse.next();

  const res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (
          toSet: { name: string; value: string; options: CookieOptions }[],
        ) => {
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Allowlist check happens server-side on every API call too; this is UX only.
  const allow = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length && !allow.includes(data.user.id)) {
    return NextResponse.redirect(new URL("/login?error=not-admin", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
