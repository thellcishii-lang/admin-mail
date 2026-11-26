import Link from "next/link";
import { listInbox, imapConfigured, NotConfiguredError } from "@/lib/mailbox";
import { deleteMessageAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { visibleMailboxes, pickMailbox } from "@/lib/mailboxes";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const FOLDERS = [
  ["inbox", "受信トレイ"],
  ["spam", "迷惑メール"],
  ["trash", "削除済み"],
];

const pill = (active) =>
  `rounded-full border px-3 py-1.5 text-sm ${active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`;

export default async function InboxPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const folder = FOLDERS.some(([k]) => k === sp?.folder) ? sp.folder : "inbox";
  const boxes = await visibleMailboxes(user);
  const addresses = boxes.map((b) => b.address);
  const address = addresses.includes(sp?.to) ? sp.to : null;
  const mailbox = await pickMailbox(user, address);

  let messages = null, error = null;
  try {
    messages = await listInbox({ folder, address, limit: 100, mailbox });
  } catch (e) {
    error = e;
  }

  const qs = (f, a) => {
    const q = new URLSearchParams();
    if (f !== "inbox") q.set("folder", f);
    if (a) q.set("to", a);
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };
  const backUrl = qs(folder, address);
  const detailQs = (uid) => {
    const q = new URLSearchParams();
    if (folder !== "inbox") q.set("folder", folder);
    if (address) q.set("to", address);
    const s = q.toString();
    return `/inbox/${uid}${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-lg font-bold">{FOLDERS.find(([k]) => k === folder)[1]}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FOLDERS.map(([key, label]) => (
          <Link key={key} href={qs(key, address)} className={pill(folder === key)}>{label}</Link>
        ))}
      </div>
      {user.kind === "admin" && addresses.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link href={qs(folder, null)} className={pill(!address)}>すべて</Link>
          {addresses.map((a) => (
            <Link key={a} href={qs(folder, a)} className={pill(address === a)}>{a}</Link>
          ))}
        </div>
      )}

      {!imapConfigured(mailbox) || error instanceof NotConfiguredError ? (
        <div className="mt-4 rounded bg-amber-50 px-4 py-3 text-sm text-amber-800">
          受信（IMAP）が未設定です。アドレス設定で IMAP を登録してください。送信はこのまま使えます。
        </div>
      ) : error ? (
        <div className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-red-700">フォルダを開けませんでした: {error.message}（メールサーバー側で IMAP が有効か確認してください）</div>
      ) : messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">メールはありません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl bg-white shadow">
          {messages.map((m) => (
            <li key={m.uid} className="flex items-stretch hover:bg-slate-50">
              <Link href={detailQs(m.uid)} className="flex min-w-0 flex-1 items-baseline gap-3 px-4 py-3">
                <span className={m.seen ? "text-transparent" : "text-sky-500"}>●</span>
                <span className={`w-56 shrink-0 truncate text-sm ${m.seen ? "text-slate-500" : "font-medium"}`}>{m.from}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${m.seen ? "text-slate-500" : "font-medium"}`}>{m.subject}</span>
                <span className="hidden w-48 shrink-0 truncate text-xs text-slate-400 lg:block">宛先: {m.to}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtDate(m.date)}</span>
              </Link>
              <form action={deleteMessageAction} className="flex items-center pr-3">
                <input type="hidden" name="uid" value={m.uid} />
                <input type="hidden" name="folder" value={folder} />
                <input type="hidden" name="to" value={address || mailbox?.address || ""} />
                <input type="hidden" name="back" value={backUrl} />
                <button title={folder === "trash" ? "完全に削除" : "削除（削除済みへ）"} className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600">削除</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
