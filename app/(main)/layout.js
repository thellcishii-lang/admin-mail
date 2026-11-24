import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { mailFrom } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }) {
  const user = await requireUser();
  const link = "block rounded px-3 py-2 text-sm hover:bg-slate-700";
  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 bg-slate-800 text-slate-100">
        <div className="px-4 py-5">
          <p className="font-bold">ADMINメール</p>
          <p className="mt-1 break-all text-xs text-slate-400">{mailFrom() || user.email}</p>
        </div>
        <nav className="space-y-1 px-2">
          <Link href="/" className={link}>受信トレイ</Link>
          <Link href="/compose" className={link}>個別送信</Link>
          <Link href="/broadcast" className={link}>一斉送信</Link>
          <Link href="/sent" className={link}>送信済み</Link>
          <Link href="/templates" className={link}>様式（テンプレート）</Link>
          <Link href="/password" className={link}>パスワード変更</Link>
        </nav>
        <form action={logoutAction} className="px-2 pt-4">
          <button className="block w-full rounded px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700">ログアウト</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
