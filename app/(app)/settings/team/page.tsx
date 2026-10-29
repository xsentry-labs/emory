import { inviteAction, removeMemberAction, revokeInviteAction } from "@/app/account-actions";
import { Flash, SettingsHeader } from "@/components/settings-tabs";
import { SubmitButton } from "@/components/start/form-bits";
import { listInvites, listMembers } from "@/lib/account-admin";
import { getAccountsDb } from "@/lib/accounts";
import { currentAccount } from "@/lib/request-db";
import { systemMailConfigured } from "@/lib/system-mail";

export const dynamic = "force-dynamic";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export default function TeamSettings({ searchParams }: { searchParams: { notice?: string; error?: string } }) {
  const me = currentAccount()!;
  const db = getAccountsDb();
  const owner = me.role === "owner";
  const members = listMembers(db, me.workspace_id);
  const invites = owner ? listInvites(db, me.workspace_id) : [];

  return (
    <>
      <SettingsHeader active="team" />
      <Flash notice={searchParams.notice} error={searchParams.error} />
      <div className="flex max-w-[720px] flex-col gap-8">
        <section aria-labelledby="people" className="flex flex-col gap-2">
          <h2 id="people" className="text-base font-semibold">
            people in this workspace
          </h2>
          <ul>
            {members.map((m) => (
              <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-dashed border-line py-3 last:border-b">
                <span className="flex flex-col">
                  <span className="font-mono text-sm text-ink">
                    {m.email}
                    {m.id === me.id ? " · you" : ""}
                  </span>
                  <span className="text-xs">
                    {m.role} · joined {day(m.createdAt)}
                    {m.verified ? "" : " · email not verified"}
                  </span>
                </span>
                {owner && m.id !== me.id ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="member" value={m.id} />
                    <button type="submit" className="btn btn-quiet btn-sm">
                      remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <span className="text-xs">everyone here sees and approves the same leads, fixes and drafts. removing someone signs them out at once.</span>
        </section>

        {owner ? (
          <section aria-labelledby="invite" className="flex flex-col gap-3">
            <h2 id="invite" className="text-base font-semibold">
              invite someone
            </h2>
            {!me.email_verified_at ? (
              <p className="text-sm">verify your own email first (see account).</p>
            ) : !systemMailConfigured() && process.env.NODE_ENV === "production" ? (
              <p className="text-sm">account email isn&apos;t set up on this server yet (MAIL_URL, MAIL_FROM), so invites can&apos;t be sent.</p>
            ) : (
              <form action={inviteAction} className="flex flex-wrap gap-2">
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input id="email" name="email" type="email" required maxLength={320} placeholder="teammate@company.com" className="h-10 min-w-0 flex-[1_1_260px] border border-line bg-field px-3 text-sm text-ink placeholder:text-mute" />
                <SubmitButton pendingLabel="sending…">send invite</SubmitButton>
              </form>
            )}
            {invites.length ? (
              <ul>
                {invites.map((i) => (
                  <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-dashed border-line-soft py-2.5 last:border-b">
                    <span className="flex flex-col">
                      <span className="font-mono text-sm">{i.email}</span>
                      <span className="text-xs">invited {day(i.createdAt)} · link works until {day(i.expiresAt)}</span>
                    </span>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="invite" value={i.id} />
                      <button type="submit" className="btn btn-quiet btn-sm">
                        cancel
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
