import { updateProfile } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/lib/request-db";
import { getProfile } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const profile = getProfile(getDb());
  return (
    <>
      <PageHead
        title="Offer & ideal customer"
        standfirst="What you sell and who it is for. Lead research, scoring and outreach drafts are built from this."
      />
      <form action={updateProfile} className="card max-w-measure space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="offer">What you offer</Label>
          <Textarea
            id="offer"
            name="offer"
            rows={5}
            defaultValue={profile.offer}
            maxLength={3000}
            placeholder="The service you provide and the outcome it delivers."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="icp">Ideal customer (ICP)</Label>
          <Textarea
            id="icp"
            name="icp"
            rows={5}
            defaultValue={profile.icp}
            maxLength={3000}
            placeholder="Who needs this: industry, size, role, trigger events, disqualifiers."
          />
        </div>
        <Button type="submit">Save</Button>
      </form>
    </>
  );
}
