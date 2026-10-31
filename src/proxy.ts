import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Page routes only. /auth/* (desktop handoff, OAuth callback), /api/*
// (self-authenticating) and the static Kompas app at /kompas are untouched.
export const config = {
  matcher: ["/", "/login", "/dashboard", "/dashboard/:path*"],
};
