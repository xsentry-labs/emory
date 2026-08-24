import { Suspense } from "react";
import { BrainView } from "@/components/brain/brain-view";

export const metadata = { title: "Brain · Emory" };

export default function BrainPage() {
  return (
    <Suspense fallback={null}>
      <BrainView />
    </Suspense>
  );
}
