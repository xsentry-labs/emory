import { NextResponse } from "next/server";
import { latestAudit } from "@/lib/seo/audit";
import { getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ audit: latestAudit(getDb()) });
}
