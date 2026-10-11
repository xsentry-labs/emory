import { NextResponse } from "next/server";
import { getAccountsDb } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getAccountsDb().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
