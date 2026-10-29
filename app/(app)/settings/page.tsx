import { changePasswordAction, deleteAccountAction } from "@/app/account-actions";
import { resendVerification } from "@/app/auth/actions";
import { Flash, SettingsHeader } from "@/components/settings-tabs";
import { SubmitButton } from "@/components/start/form-bits";
import { listMembers } from "@/lib/account-admin";
import { getAccountsDb } from "@/lib/accounts";
import { currentAccount } from "@/lib/request-db";

export const dynamic = "force-dynamic";

const field = "h-10 w-full border border-line bg-field px-3 text-sm text-ink";

export default function AccountSettings({ searchParams }: { searchParams: { notice?: string; error?: string } }) {
  const me = currentAccount()!;
  const owner = me.role === "owner";
  const others = listMembers(getAccountsDb(), me.workspace_id).filter((m) => m.id !== me.id).length;

  return (
    <>
      <SettingsHeader active="account" />
      <Flash notice={searchParams.notice} error={searchParams.error} />
      <div className="flex max-w-[720px] flex-col gap-8">
        <section aria-labelledby="who" className="flex flex-col gap-2">
          <h2 id="who" className="text-base font-semibold">
            you
          </h2>
          <dl>
            {[
              ["email", me.email],
              ["status", me.email_verified_at ? "verified" : "not verified yet"],
              ["role", owner ? "owner of this workspace" : "member"],
              ["since", new Date(me.created_at).toISOString().slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 border-t border-dashed border-line-soft py-2 text-sm last:border-b">
                <dt className="font-mono text-xs">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {me.email_verified_at ? null : (
            <form action={resendVerification}>
              <SubmitButton pendingLabel="sending…">send the verification email again</SubmitButton>
            </form>
          )}
        </section>

        <section aria-labelledby="pw" className="flex flex-col gap-3">
          <h2 id="pw" className="text-base font-semibold">
            change password
          </h2>
          <form action={changePasswordAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-ink">current password</span>
              <input name="current" type="password" autoComplete="current-password" required className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-ink">new password</span>
              <input name="next" type="password" autoComplete="new-password" minLength={8} maxLength={200} required className={field} />
            </label>
            <span className="text-xs">signs you out on every other device.</span>
            <div>
              <SubmitButton pendingLabel="saving…">change password</SubmitButton>
            </div>
          </form>
        </section>

        <section aria-labelledby="del" className="flex flex-col gap-3 border border-dashed border-danger/60 p-5">
          <h2 id="del" className="text-base font-semibold text-danger">
            {owner ? "delete this workspace" : "delete my account"}
          </h2>
          <p className="text-sm">
            {owner
              ? `deletes the workspace and everything in it: leads, emails, audits, connections${others ? `, and the ${others} other ${others === 1 ? "person" : "people"} in it` : ""}. this can't be undone. backups are kept for up to 14 days, then they're gone too.`
              : "removes your login from this workspace. the workspace and its data stay with the owner."}
          </p>
          <form action={deleteAccountAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs">type your email ({me.email}) to confirm</span>
              <input name="confirm" autoComplete="off" required className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-xs">password</span>
              <input name="password" type="password" autoComplete="current-password" required className={field} />
            </label>
            <div>
              <button type="submit" className="btn border-danger/60 text-danger hover:bg-danger/10">
                {owner ? "delete the workspace" : "delete my account"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
