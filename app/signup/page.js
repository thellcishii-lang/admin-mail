import Link from "next/link";
import { signupAction } from "@/lib/actions";

export default async function SignupPage({ searchParams }) {
  const sp = await searchParams;
  const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-2";
  return (
    <main className="mx-auto mt-16 w-full max-w-md px-4">
      <div className="rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold">HTMLメール 申込</h1>
        <p className="mt-1 text-sm text-slate-500">会社のメールアドレスを登録して、アドレスごとにログイン・送受信できます。</p>
        {sp?.error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}
        <form action={signupAction} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">会社名</label>
            <input name="company_name" required className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium">管理者のメールアドレス</label>
            <input name="email" type="email" required autoComplete="username" className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium">管理者のパスワード（8文字以上）</label>
            <input name="password" type="password" required autoComplete="new-password" className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium">最初に使うメールアドレス</label>
            <input name="address" type="email" required className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium">そのアドレスのログインパスワード（8文字以上）</label>
            <input name="address_password" type="password" required autoComplete="new-password" className={inputCls} />
          </div>
          <button className="w-full rounded bg-slate-800 py-2 font-medium text-white hover:bg-slate-700">申し込む</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          既にアカウントがある場合は <Link href="/login" className="text-sky-600 hover:underline">ログイン</Link>
        </p>
      </div>
    </main>
  );
}
