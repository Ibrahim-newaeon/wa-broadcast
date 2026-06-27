import { NextResponse } from "next/server";

// Liveness probe used by Docker HEALTHCHECK.
export function GET() {
  return NextResponse.json({ status: "ok", ts: Date.now() });
}
