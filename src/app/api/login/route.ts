import { NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, normalizePassword } from "@/lib/auth";
import { lockedFor, recordFailure, recordSuccess } from "@/lib/loginLimit";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = process.env.APP_PASSWORD;
  const input = form.get("password");
  const who = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (lockedFor(who)) return NextResponse.redirect(new URL("/login?error=locked", req.url), 303);
  // 比雜湊值（長度固定），不直接比明文
  const ok = !!password && typeof input === "string" && (await authToken(input)) === (await authToken(password));
  if (!ok) {
    recordFailure(who);
    // 答錯慢一點回，連續亂試不划算
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL(`/login?error=${lockedFor(who) ? "locked" : "1"}`, req.url), 303);
  }
  recordSuccess(who);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
