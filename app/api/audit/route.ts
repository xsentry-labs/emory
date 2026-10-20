import { eventsCsv, listEvents } from "@/lib/audit";
import { getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

/** The whole audit log as CSV. Signed-in only (middleware). */
export function GET() {
  const csv = eventsCsv(listEvents(getDb()));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="emory-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
