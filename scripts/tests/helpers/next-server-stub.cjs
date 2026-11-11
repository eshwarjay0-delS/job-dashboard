// Minimal next/server stand-in for isolated node --test runs without installing
// the Next package. NextRequest is the platform Request; NextResponse.json
// matches the App Router helper used by Kompas API routes.
class NextRequest extends Request {}
class NextResponse extends Response {
  static json(body, init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body ?? null), {
      status: init.status ?? 200,
      statusText: init.statusText,
      headers,
    });
  }
}
module.exports = { NextRequest, NextResponse };
