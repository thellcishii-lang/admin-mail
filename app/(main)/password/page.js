import { changePasswordAction } from "@/lib/actions";

export default async function PasswordPage({ searchParams }) {
  const sp = await searchParams;
  const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="max-w-md">
      <h1 className="text-lg font-bold">パスワード変更</h1>
      {sp?.error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}
      {sp?.done && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">パスワードを変更しました</p>}
      <form action={changePasswordAction} className="mt-4 space-y-4 rounded-xl bg-white p-6 shadow">
        <div><label className="text-sm font-medium">現在のパスワード</label><input name="current_password" type="password" required className={inputCls} /></div>
        <div><label className="text-sm font-medium">新しいパスワード（8文字以上）</label><input name="password" type="password" required className={inputCls} /></div>
        <div><label className="text-sm font-medium">新しいパスワード（確認）</label><input name="password_confirmation" type="password" required className={inputCls} /></div>
        <button className="rounded bg-slate-800 px-6 py-2 font-medium text-white hover:bg-slate-700">変更する</button>
      </form>
    </div>
  );
}
