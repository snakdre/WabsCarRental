import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Auth routes: redirect authenticated users away
  const authPaths = ["/login", "/register", "/forgot-password"];
  if (authPaths.some((p) => path.startsWith(p)) && user) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  // Account routes: require authentication
  if (path.startsWith("/account") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Checkout: require authentication
  if (path.startsWith("/checkout") && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Management console: require manager or admin role
  if (path.startsWith("/management")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: roleData } = await supabase
      .from("roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role;

    if (role !== "manager" && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Settings page: admin only
    if (path.startsWith("/management/settings") && role !== "admin") {
      return NextResponse.redirect(new URL("/management", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
