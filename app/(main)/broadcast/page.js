import { db, ensureReady } from "@/lib/db";
import ComposeForm from "@/components/ComposeForm";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ searchParams }) {
  await ensureReady();
  const sp = await searchParams;
  const { rows } = await db().query("SELECT * FROM mail_templates ORDER BY position, id");
  return (
    <div>
      <h1 className="text-lg font-bold">一斉送信</h1>
      <ComposeForm templates={rows} broadcast error={sp?.error || null} />
    </div>
  );
}
