import Link from "next/link";
import { getMessage } from "@/lib/mailbox";

export const dynamic = "force-dynamic";

export default async function MessagePage({ params }) {
  const { uid } = await params;
  let message = null, error = null;
  try { message = await getMessage(Number(uid)); } catch (e) { error = e; }
  if (error) return <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">メールを開けませんでした: {error.message}</p>;
  if (!message) return <p className="text-sm text-slate-500">メールが見つかりません。</p>;
  const replySubject = /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`;
  const quoted = (message.text || "").split("\n").map((l) => `> ${l}`).join("\n");
  const replyHref = `/compose?to=${encodeURIComponent(message.from.replace(/^.*<([^>]+)>.*$/, "$1"))}&subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent("\n\n" + quoted)}&reply=1`;
  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <Link href="/" className="text-sm text-sky-600 hover:underline">← 受信トレイへ</Link>
      <h1 className="mt-3 text-lg font-bold">{message.subject}</h1>
      <p className="mt-1 text-sm text-slate-500">差出人: {message.from}</p>
      <p className="text-sm text-slate-500">日時: {message.date ? new Date(message.date).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : ""}</p>
      {message.attachments?.length > 0 && <p className="mt-1 text-sm text-slate-500">添付: {message.attachments.join(", ")}</p>}
      <pre className="mt-4 whitespace-pre-wrap break-words border-t border-slate-100 pt-4 font-sans text-sm leading-relaxed">{message.text}</pre>
      <Link href={replyHref} className="mt-6 inline-block rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">返信する</Link>
    </div>
  );
}
