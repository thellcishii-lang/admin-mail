import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMailboxes, mailboxLimitFor } from "@/lib/mailboxes";
import { saveMailboxAction, deleteMailboxAction, regenerateLinkKeyAction } from "@/lib/actions";
import { ensureLinkKey } from "@/lib/link";

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
  const limit = await mailboxLimitFor(user.accountId);
  const linkKey = await ensureLinkKey(user.accountId);
  return (
    <div>
      <h1 className="text-lg font-bold">アドレス設定（{boxes.length}/{limit}）</h1>
      <p className="mt-1 text-sm text-slate-500">会社のメールアドレスを登録します。各アドレスは、そのアドレスとパスワードでログインして送受信できます。アドレスは{limit}個まで追加できます（追加は1口2,500円/月で+10個、同じアカウントの中で増えます）。</p>
      {sp?.welcome && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">申込が完了しました。アドレスの受信（IMAP）・送信（SMTP）サーバーを登録すると、そのアドレスで送受信できるようになります。</p>}
      <div className="mt-4 rounded-xl bg-white p-5 shadow">
        <h2 className="font-bold">見積・請求書システムとの連動</h2>
        <p className="mt-1 text-sm text-slate-500">この連動キーを、見積・請求書システムの設定画面「HTMLメールと連動」に入力すると、見積側から送るメールがこのアカウント経由（会社のメール）になります。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input readOnly value={linkKey} className="w-full max-w-md rounded border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-sm" />
          <form action={regenerateLinkKeyAction}>
            <button className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">再発行</button>
          </form>
        </div>
        <p className="mt-1 text-xs text-slate-400">再発行すると、以前のキーは使えなくなります。</p>
      </div>
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
        {boxes.length < limit ? (
          <details className="rounded-xl bg-white p-5 shadow" open={boxes.length === 0}>
            <summary className="cursor-pointer font-medium">＋ アドレスを追加</summary>
            <div className="mt-4"><MailboxForm box={null} /></div>
          </details>
        ) : (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow">アドレスは{limit}個までです。追加は1口2,500円/月で+10個できます。</p>
        )}
      </div>
    </div>
  );
}
