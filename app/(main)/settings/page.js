import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMailboxes } from "@/lib/mailboxes";
import { saveMailboxAction, deleteMailboxAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm";
const labelCls = "text-xs font-medium text-slate-500";

function MailboxForm({ box }) {
  return (
    <form action={saveMailboxAction} className="grid grid-cols-2 gap-3">
      {box && <input type="hidden" name="id" value={box.id} />}
      <div>
        <label className={labelCls}>メールアドレス（ログインID）</label>
        <input name="address" type="email" required defaultValue={box?.address || ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>表示名</label>
        <input name="display_name" defaultValue={box?.display_name || ""} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>ログインパスワード{box ? "（空欄なら変更なし）" : ""}</label>
        <input name="login_password" type="password" required={!box} autoComplete="new-password" className={inputCls} />
      </div>
      {box?.use_env_defaults ? (
        <p className="col-span-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
          このアドレスの送受信サーバーは運営側の設定（環境変数）を使っています。
        </p>
      ) : (
        <>
          <div>
            <label className={labelCls}>受信サーバー（IMAP）</label>
            <input name="imap_host" placeholder="imap.zoho.jp" defaultValue={box?.imap_host || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>IMAPポート</label>
            <input name="imap_port" type="number" defaultValue={box?.imap_port || 993} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>IMAPユーザー名</label>
            <input name="imap_user" defaultValue={box?.imap_user || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>IMAPパスワード{box ? "（空欄なら変更なし）" : ""}</label>
            <input name="imap_pass" type="password" autoComplete="new-password" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>送信サーバー（SMTP）</label>
            <input name="smtp_host" placeholder="smtp.zoho.jp" defaultValue={box?.smtp_host || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SMTPポート</label>
            <input name="smtp_port" type="number" defaultValue={box?.smtp_port || 465} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SMTPユーザー名</label>
            <input name="smtp_user" defaultValue={box?.smtp_user || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SMTPパスワード{box ? "（空欄なら変更なし）" : ""}</label>
            <input name="smtp_pass" type="password" autoComplete="new-password" className={inputCls} />
          </div>
        </>
      )}
      <div className="col-span-2">
        <button className="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">{box ? "更新" : "追加"}</button>
      </div>
    </form>
  );
}

export default async function SettingsPage({ searchParams }) {
  const user = await requireUser();
  if (user.kind !== "admin") redirect("/");
  const sp = await searchParams;
  const boxes = await listMailboxes(user.accountId);
  return (
    <div>
      <h1 className="text-lg font-bold">アドレス設定</h1>
      <p className="mt-1 text-sm text-slate-500">会社のメールアドレスを登録します。各アドレスは、そのアドレスとパスワードでログインして送受信できます。</p>
      {sp?.welcome && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">申込が完了しました。アドレスの受信（IMAP）・送信（SMTP）サーバーを登録すると、そのアドレスで送受信できるようになります。</p>}
      {sp?.done && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">保存しました</p>}
      {sp?.error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}
      <div className="mt-4 space-y-4">
        {boxes.map((box) => (
          <details key={box.id} className="rounded-xl bg-white p-5 shadow">
            <summary className="cursor-pointer font-medium">
              {box.address}
              {box.display_name ? <span className="ml-2 text-sm font-normal text-slate-400">{box.display_name}</span> : null}
            </summary>
            <div className="mt-4">
              <MailboxForm box={box} />
              <form action={deleteMailboxAction} className="mt-3">
                <input type="hidden" name="id" value={box.id} />
                <button className="text-sm text-red-600 hover:underline">このアドレスを削除</button>
              </form>
            </div>
          </details>
        ))}
        <details className="rounded-xl bg-white p-5 shadow" open={boxes.length === 0}>
          <summary className="cursor-pointer font-medium">＋ アドレスを追加</summary>
          <div className="mt-4"><MailboxForm box={null} /></div>
        </details>
      </div>
    </div>
  );
}
