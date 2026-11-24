import Link from "next/link";
import { listInbox, imapConfigured, NotConfiguredError, ConnectionError } from "@/lib/mailbox";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function InboxPage() {
  let messages = null, error = null;
  try {
    messages = await listInbox(50);
  } catch (e) {
    error = e;
  }
  return (
    <div>
      <h1 className="text-lg font-bold">受信トレイ</h1>
      {!imapConfigured() || error instanceof NotConfiguredError ? (
        <div className="mt-4 rounded bg-amber-50 px-4 py-3 text-sm text-amber-800">
          受信（IMAP）が未設定です。Vercel の環境変数に IMAP_USER / IMAP_PASS（未設定の場合は INFOMAIL_USER / INFOMAIL_PASS を使います）を設定してください。送信はこのまま使えます。
        </div>
      ) : error ? (
        <div className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-red-700">受信トレイを開けませんでした: {error.message}（Zoho 側で IMAP が有効か確認してください）</div>
      ) : messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">メールはありません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl bg-white shadow">
          {messages.map((m) => (
            <li key={m.uid}>
              <Link href={`/inbox/${m.uid}`} className="flex items-baseline gap-3 px-4 py-3 hover:bg-slate-50">
                <span className={m.seen ? "text-transparent" : "text-sky-500"}>●</span>
                <span className={`w-56 shrink-0 truncate text-sm ${m.seen ? "text-slate-500" : "font-medium"}`}>{m.from}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${m.seen ? "text-slate-500" : "font-medium"}`}>{m.subject}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtDate(m.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
