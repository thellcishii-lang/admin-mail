import { db, ensureReady } from "@/lib/db";
import ComposeForm from "@/components/ComposeForm";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComposePage({ searchParams }) {
  await ensureReady();
  const user = await requireUser();
  const sp = await searchParams;
  const { rows } = await db().query("SELECT * FROM mail_templates WHERE account_id = $1 ORDER BY position, id", [user.accountId]);
  return (
    <div>
      <h1 className="text-lg font-bold">個別送信</h1>
      <ComposeForm templates={rows} error={sp?.error || null}
        defaults={{ to: sp?.to || "", subject: sp?.subject || "", body: sp?.body || "", reply: sp?.reply || "" }} />
    </div>
  );
}
