import Link from "next/link";
import { getMessage } from "@/lib/mailbox";
import { deleteMessageAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { pickMailbox } from "@/lib/mailboxes";

export const dynamic = "force-dynamic";

export default async function MessagePage({ params, searchParams }) {
  const user = await requireUser();
  const { uid } = await params;
  const sp = await searchParams;
  const folder = ["spam", "trash"].includes(sp?.folder) ? sp.folder : "inbox";
  const mailbox = await pickMailbox(user, sp?.to);
  let message = null, error = null;
  try { message = await getMessage(Number(uid), folder, mailbox); } catch (e) { error = e; }
  if (error) return <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">メールを開けませんでした: {error.message}</p>;
  if (!message) return <p className="text-sm text-slate-500">メールが見つかりません。</p>;
  const replySubject = /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`;
  const quoted = (message.text || "").split("\n").map((l) => `> ${l}`).join("\n");
  const replyHref = `/compose?to=${encodeURIComponent(message.from.replace(/^.*<([^>]+)>.*$/, "$1"))}&subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent("\n\n" + quoted)}&reply=1`;
  const backQs = new URLSearchParams();
  if (folder !== "inbox") backQs.set("folder", folder);
  if (sp?.to) backQs.set("to", sp.to);
  const backHref = backQs.toString() ? `/?${backQs}` : "/";
  const folderLabel = { inbox: "受信トレイ", spam: "迷惑メール", trash: "削除済み" }[folder];
  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <Link href={backHref} className="text-sm text-sky-600 hover:underline">← {folderLabel}へ</Link>
      <h1 className="mt-3 text-lg font-bold">{message.subject}</h1>
      <p className="mt-1 text-sm text-slate-500">差出人: {message.from}</p>
      <p className="text-sm text-slate-500">宛先: {message.to}</p>
      <p className="text-sm text-slate-500">日時: {message.date ? new Date(message.date).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : ""}</p>
      {message.attachments?.length > 0 && <p className="mt-1 text-sm text-slate-500">添付: {message.attachments.join(", ")}</p>}
      <pre className="mt-4 whitespace-pre-wrap break-words border-t border-slate-100 pt-4 font-sans text-sm leading-relaxed">{message.text}</pre>
      <div className="mt-6 flex items-center gap-3">
        <Link href={replyHref} className="inline-block rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">返信する</Link>
        <form action={deleteMessageAction}>
          <input type="hidden" name="uid" value={message.uid} />
          <input type="hidden" name="folder" value={folder} />
          <input type="hidden" name="to" value={sp?.to || mailbox?.address || ""} />
          <input type="hidden" name="back" value={backHref} />
          <button className="rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">{folder === "trash" ? "完全に削除" : "削除する"}</button>
        </form>
      </div>
    </div>
  );
}
