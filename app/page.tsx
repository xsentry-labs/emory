import { redirect } from "next/navigation";
import { getDb } from "@/lib/request-db";
import { getBusiness } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect(getBusiness(getDb()).onboardedAt ? "/leads" : "/start");
}
