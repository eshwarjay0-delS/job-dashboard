import { NextResponse, type NextRequest } from "next/server";

// Auth removed — pass all requests straight through.
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
