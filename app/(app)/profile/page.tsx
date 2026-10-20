import { redirect } from "next/navigation";

/** "Your business" became Memory. */
export default function ProfilePage() {
  redirect("/memory");
}
