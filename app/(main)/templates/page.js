import { db, ensureReady } from "@/lib/db";
import { saveTemplateAction, deleteTemplateAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const FIELDS = [
  ["name", "様式名"], ["brand_name", "ブランド名（ヘッダー表示）"], ["tagline", "タグライン"],
  ["header_color", "ヘッダー色（#RRGGBB）"], ["from_name", "送信者名"], ["footer_company", "フッター会社名"],
  ["footer_address", "フッター住所"], ["footer_email", "フッターメール"], ["footer_url", "フッターURL"],
  ["from_address", "送信元アドレス"],
];

function TemplateForm({ template }) {
  const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm";
  return (
    <form action={saveTemplateAction} className="grid grid-cols-2 gap-3">
      {template && <input type="hidden" name="id" value={template.id} />}
      {FIELDS.map(([name, label]) => (
        <div key={name}>
          <label className="text-xs font-medium text-slate-500">{label}</label>
          <input name={name} defaultValue={template?.[name] || ""} required={name === "name"} className={inputCls} />
        </div>
      ))}
      <div className="col-span-2">
        <button className="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">{template ? "更新" : "追加"}</button>
      </div>
    </form>
  );
}

export default async function TemplatesPage() {
  await ensureReady();
  const { rows } = await db().query("SELECT * FROM mail_templates ORDER BY position, id");
  return (
    <div>
      <h1 className="text-lg font-bold">様式（テンプレート）</h1>
      <div className="mt-4 space-y-4">
        {rows.map((t) => (
          <details key={t.id} className="rounded-xl bg-white p-5 shadow">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: t.header_color }} />
              {t.name}
              <span className="text-sm font-normal text-slate-400">{t.brand_name}{t.tagline ? ` / ${t.tagline}` : ""}</span>
            </summary>
            <div className="mt-4">
              <TemplateForm template={t} />
              <form action={deleteTemplateAction} className="mt-3">
                <input type="hidden" name="id" value={t.id} />
                <button className="text-sm text-red-600 hover:underline">この様式を削除</button>
              </form>
            </div>
          </details>
        ))}
        <details className="rounded-xl bg-white p-5 shadow">
          <summary className="cursor-pointer font-medium">＋ 新しい様式を追加</summary>
          <div className="mt-4"><TemplateForm template={null} /></div>
        </details>
      </div>
    </div>
  );
}
