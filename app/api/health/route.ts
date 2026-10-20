import { NextResponse } from "next/server";
import { getAccountsDb } from "@/lib/accounts";
import { backupHealthy } from "@/lib/backup";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getAccountsDb().prepare("SELECT 1").get();
    // Reported, not failed on: a stale backup shouldn't make Railway restart a healthy app.
    // Open endpoint, so only a yes/no; details are on /admin.
    return NextResponse.json({ ok: true, backups: backupHealthy() ? "ok" : "stale" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
