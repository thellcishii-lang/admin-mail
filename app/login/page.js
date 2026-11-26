import Link from "next/link";
import { loginAction } from "@/lib/actions";

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <div className="rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold">HTMLメール</h1>
        <p className="mt-1 text-sm text-slate-500">会社のメールを、HTMLで送受信</p>
        {sp?.error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">メールアドレスまたはパスワードが違います</p>}
        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">メールアドレス</label>
            <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">パスワード</label>
            <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
          </div>
          <button className="w-full rounded bg-slate-800 py-2 font-medium text-white hover:bg-slate-700">ログイン</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          アカウントがない場合は <Link href="/signup" className="text-sky-600 hover:underline">新規申込</Link>
        </p>
      </div>
    </main>
  );
}
