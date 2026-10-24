import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Guards /admin/*. Being signed in is NOT enough: the user must exist in public.admin_users.
// (Public sign-ups are possible on Supabase Auth, so a session alone proves nothing.)
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // keep refreshed/cleared auth cookies
    return redirect;
  };

  const isLoginPage = request.nextUrl.pathname === "/admin/login";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return isLoginPage ? response : redirectTo("/admin/login");

  const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();

  if (!admin) {
    // Authenticated but not an administrator: drop the session and explain.
    await supabase.auth.signOut();
    return isLoginPage ? response : redirectTo("/admin/login", "?error=forbidden");
  }
  if (isLoginPage) return redirectTo("/admin");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
