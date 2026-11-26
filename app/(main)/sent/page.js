import { db, ensureReady } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SentPage({ searchParams }) {
  await ensureReady();
  const user = await requireUser();
  const sp = await searchParams;
  const scope = user.kind === "mailbox" ? "s.mailbox_id = $1" : "s.account_id = $1";
  const scopeId = user.kind === "mailbox" ? user.mailboxId : user.accountId;
  const { rows } = await db().query(
    `SELECT s.*, t.name AS template_name FROM sent_emails s LEFT JOIN mail_templates t ON t.id = s.template_id WHERE ${scope} ORDER BY s.id DESC LIMIT 100`,
    [scopeId]
  );
  return (
    <div>
      <h1 className="text-lg font-bold">送信済み</h1>
      {sp?.done && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">送信しました{sp?.failed ? `（${sp.failed}件失敗）` : ""}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">まだ送信履歴がありません。</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-2 font-medium">日時</th><th className="px-4 py-2 font-medium">様式</th>
              <th className="px-4 py-2 font-medium">宛先</th><th className="px-4 py-2 font-medium">件名</th><th className="px-4 py-2 font-medium">添付</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{new Date(r.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.template_name || "―"}{r.batch_id ? "（一斉）" : ""}</td>
                  <td className="px-4 py-2">{r.to_address}</td>
                  <td className="px-4 py-2">{r.subject}</td>
                  <td className="px-4 py-2 text-slate-500">{r.attachment_names || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
