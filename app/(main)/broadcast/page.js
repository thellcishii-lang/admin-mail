import { db, ensureReady } from "@/lib/db";
import ComposeForm from "@/components/ComposeForm";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ searchParams }) {
  await ensureReady();
  const user = await requireUser();
  const sp = await searchParams;
  const { rows } = await db().query("SELECT id, name, header_color FROM mail_templates WHERE account_id = $1 ORDER BY position, id", [user.accountId]);
  return (
    <div>
      <h1 className="text-lg font-bold">一斉送信</h1>
      <ComposeForm templates={rows} broadcast error={sp?.error || null} />
    </div>
  );
}
