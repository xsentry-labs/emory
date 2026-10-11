import { NextResponse } from "next/server";
import { getDb } from "@/lib/request-db";
import { leadsPayload } from "@/lib/leads-view";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(leadsPayload(getDb()));
}
