import { db, ensureReady } from "@/lib/db";
import ComposeForm from "@/components/ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage({ searchParams }) {
  await ensureReady();
  const sp = await searchParams;
  const { rows } = await db().query("SELECT * FROM mail_templates ORDER BY position, id");
  return (
    <div>
      <h1 className="text-lg font-bold">個別送信</h1>
      <ComposeForm templates={rows} error={sp?.error || null}
        defaults={{ to: sp?.to || "", subject: sp?.subject || "", body: sp?.body || "", reply: sp?.reply || "" }} />
    </div>
  );
}
