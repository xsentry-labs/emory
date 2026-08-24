import { Suspense } from "react";
import { AuditView } from "@/components/audit/audit-view";

export const metadata = { title: "Your analysis · Emory" };

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="p-8 text-caption text-mute">Reading your site…</p>}>
      <AuditView />
    </Suspense>
  );
}
