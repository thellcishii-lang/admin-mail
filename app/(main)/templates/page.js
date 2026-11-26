import { db, ensureReady } from "@/lib/db";
import { saveTemplateAction, deleteTemplateAction, createTemplateFromStyleAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { PRESET_STYLES } from "@/lib/styles";
import { listImages, parseWatermarkConfig } from "@/lib/images";
import { TemplatePreviewButton } from "@/components/MailPreview";

function StyleGallery({ company }) {
  return (
    <div className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-bold">スタイルから作る</h2>
      <p className="mt-1 text-sm text-slate-500">会社の印象に合うスタイルを選ぶと、その色とタグラインで様式が作られます。あとから文言やロゴは自由に変えられます。</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_STYLES.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-lg border border-slate-200">
            <div className="px-4 py-3 text-white" style={{ backgroundColor: s.header_color }}>
              <p className="text-sm font-bold">{company || "御社ブランド名"}</p>
              <p className="text-xs opacity-80">{s.tagline}</p>
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="h-2 w-11/12 rounded bg-slate-200" />
              <div className="h-2 w-4/5 rounded bg-slate-200" />
              <div className="h-2 w-3/5 rounded bg-slate-200" />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
              <p className="text-sm"><span className="font-bold">{s.name}</span> <span className="text-xs text-slate-500">{s.mood}</span></p>
              <form action={createTemplateFromStyleAction}>
                <input type="hidden" name="style_id" value={s.id} />
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">このスタイルで作る</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

const FIELDS = [
  ["name", "様式名"], ["brand_name", "ブランド名（ヘッダー表示）"], ["tagline", "タグライン"],
  ["header_color", "ヘッダー色（#RRGGBB）"], ["from_name", "送信者名"], ["footer_company", "フッター会社名"],
  ["footer_address", "フッター住所"], ["footer_email", "フッターメール"], ["footer_url", "フッターURL"],
  ["from_address", "送信元アドレス"],
];

const WM_POSITION_LABELS = [
  ["left top", "左上"], ["center top", "上"], ["right top", "右上"],
  ["left center", "左"], ["center", "中央"], ["right center", "右"],
  ["left bottom", "左下"], ["center bottom", "下"], ["right bottom", "右下"],
];

function TemplateForm({ template, images = [], watermarks = [] }) {
  const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm";
  const checkCls = "flex items-center gap-2 text-sm text-slate-600";
  return (
    <form action={saveTemplateAction} className="grid grid-cols-2 gap-3">
      {template && <input type="hidden" name="id" value={template.id} />}
      {FIELDS.map(([name, label]) => (
        <div key={name}>
          <label className="text-xs font-medium text-slate-500">{label}</label>
          {name === "header_color" ? (
            <div className="mt-1 flex items-center gap-2">
              <input type="color" data-sync-color={template?.id || "new"} defaultValue={/^#[0-9a-fA-F]{6}$/.test(template?.header_color || "") ? template.header_color : "#374151"}
                className="h-9 w-14 shrink-0 cursor-pointer rounded-full border border-slate-300 bg-white p-1" title="色を選ぶ" />
              <input name={name} data-sync-text={template?.id || "new"} defaultValue={template?.[name] || ""} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm" placeholder="#374151" />
            </div>
          ) : (
            <input name={name} defaultValue={template?.[name] || ""} required={name === "name"} className={inputCls} />
          )}
        </div>
      ))}
      <div className="col-span-2 border-t border-slate-100 pt-3">
        <label className="text-xs font-medium text-slate-500">会社ロゴ（PNG / JPEG / GIF / WebP、500KBまで）</label>
        {template?.has_logo && (
          <div className="mt-2 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/logo/${template.id}`} alt="ロゴ" className="h-10 border border-slate-200 bg-white object-contain px-2" />
            <label className={checkCls}><input type="checkbox" name="logo_remove" value="1" /> ロゴを削除</label>
          </div>
        )}
        <input name="logo" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="mt-2 block text-sm" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <label className={checkCls}><input type="checkbox" name="logo_header" defaultChecked={template?.logo_header} /> ヘッダーに入れる</label>
          <label className={checkCls}><input type="checkbox" name="logo_footer" defaultChecked={template?.logo_footer} /> 一番下（フッター）に入れる</label>
        </div>
        <div className="mt-4 rounded border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">本文の背景の透かし（最大3つまで。位置・大きさ・薄さを選べます）</p>
          {[0, 1, 2].map((i) => {
            const w = watermarks[i] || {};
            return (
              <div key={i} className="mt-2 grid grid-cols-4 gap-2">
                <select name={`wm${i}_source`} defaultValue={w.source || ""} className={inputCls}>
                  <option value="">透かし{i + 1}：なし</option>
                  <option value="logo">会社ロゴ</option>
                  {images.map((im) => (
                    <option key={im.id} value={`img:${im.id}`}>{im.name || `画像${im.id}`}</option>
                  ))}
                </select>
                <div className="mt-1">
                  <div className="grid w-[74px] grid-cols-3 gap-0.5" title="透かしの位置">
                    {WM_POSITION_LABELS.map(([v, l]) => (
                      <label key={v} title={l} className="cursor-pointer">
                        <input type="radio" name={`wm${i}_position`} value={v} defaultChecked={(w.position || "center") === v} className="peer sr-only" />
                        <span className="block h-[22px] rounded border border-slate-300 bg-white peer-checked:border-slate-800 peer-checked:bg-slate-800"></span>
                      </label>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">位置（マス目）</span>
                </div>
                <select name={`wm${i}_size`} defaultValue={String(w.size || 55)} className={inputCls}>
                  {[25, 40, 55, 75, 100].map((s) => <option key={s} value={s}>大きさ {s}%</option>)}
                </select>
                <select name={`wm${i}_opacity`} defaultValue={String(w.opacity ?? 1)} className={inputCls}>
                  <option value="1">そのまま（100%）</option>
                  <option value="0.5">薄さ 50%</option>
                  <option value="0.35">薄さ 35%</option>
                  <option value="0.2">薄さ 20%</option>
                  <option value="0.1">薄さ 10%</option>
                </select>
              </div>
            );
          })}
          <p className="mt-1 text-xs text-slate-400">透かしの画像は、作成画面の「本文の画像」から先に登録しておくと選べます。</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">ヘッダーでのロゴの位置</label>
            <select name="logo_layout" defaultValue={template?.logo_layout || "left"} className={inputCls}>
              <option value="left">左（ブランド名の横）</option>
              <option value="center">中央（ブランド名の上）</option>
              <option value="logo_only">ロゴだけを中央に大きく</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">ロゴの大きさ</label>
            <select name="logo_size" defaultValue={String(template?.logo_size || 36)} className={inputCls}>
              <option value="28">小（28px）</option>
              <option value="36">標準（36px）</option>
              <option value="48">大（48px）</option>
              <option value="64">特大（64px）</option>
              <option value="84">最大（84px）</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">ヘッダーの高さ（余白）</label>
            <select name="header_padding" defaultValue={String(template?.header_padding || 20)} className={inputCls}>
              <option value="12">低め</option>
              <option value="20">標準</option>
              <option value="32">高め</option>
              <option value="44">たっぷり</option>
            </select>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">背景の透かしは、対応するメールソフトでのみ表示されます。</p>
        <div className="mt-4 rounded border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">フッターのデザイン</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">フッターの色</label>
              <select name="footer_style" defaultValue={template?.footer_style || "light"} className={inputCls}>
                <option value="light">今まで通り（白地）</option>
                <option value="header">ヘッダーと同じ色</option>
                <option value="custom">色を選ぶ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">フッターの色（色を選ぶ場合）</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" data-sync-color={`f${template?.id || "new"}`} defaultValue={/^#[0-9a-fA-F]{6}$/.test(template?.footer_color || "") ? template.footer_color : "#334155"}
                  className="h-9 w-14 shrink-0 cursor-pointer rounded-full border border-slate-300 bg-white p-1" title="色を選ぶ" />
                <input name="footer_color" data-sync-text={`f${template?.id || "new"}`} defaultValue={template?.footer_color || "#334155"} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm" placeholder="#334155" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">フッター画像（本文の下に大きく表示）</label>
              <select name="footer_image_id" defaultValue={String(template?.footer_image_id || "")} className={inputCls}>
                <option value="">なし</option>
                {images.map((im) => (
                  <option key={im.id} value={im.id}>{im.name || `画像${im.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">会社名・ロゴの置き方</label>
              <select name="footer_layout" defaultValue={template?.footer_layout || "left"} className={inputCls}>
                <option value="left">左寄せ</option>
                <option value="center">中央</option>
                <option value="logo_only">ロゴだけを中央に大きく</option>
                <option value="name_only">会社名だけ（ロゴなし）</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">フッターの高さ（余白）</label>
              <select name="footer_padding" defaultValue={String(template?.footer_padding || 20)} className={inputCls}>
                <option value="12">低め</option>
                <option value="20">標準</option>
                <option value="32">高め</option>
                <option value="44">たっぷり</option>
              </select>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">フッター画像は、作成画面の「本文の画像」から先に登録しておくと選べます。</p>
        </div>
      </div>
      <div className="col-span-2">
        <button className="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">{template ? "更新" : "追加"}</button>
      </div>
    </form>
  );
}

export default async function TemplatesPage({ searchParams }) {
  await ensureReady();
  const user = await requireUser();
  const sp = await searchParams;
  const { rows } = await db().query(
    `SELECT id, name, brand_name, tagline, header_color, from_name, footer_company, footer_address,
            footer_email, footer_url, from_address, logo_header, logo_footer, logo_background,
            logo_layout, logo_size, header_padding, watermark_config,
            footer_style, footer_color, footer_padding, footer_layout, footer_image_id,
            (logo_base64 <> '') AS has_logo
     FROM mail_templates WHERE account_id = $1 ORDER BY position, id`, [user.accountId]);
  const libraryImages = await listImages(user.accountId);
  const effectiveWatermarks = (t) => {
    const cfg = parseWatermarkConfig(t);
    if (cfg.length === 0 && t.logo_background) {
      return [{ source: "logo", position: "center", size: 55, opacity: 1 }];
    }
    return cfg;
  };
  const { rows: accRows } = await db().query("SELECT name FROM accounts WHERE id = $1", [user.accountId]);
  return (
    <div>
      <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('input',function(e){var t=e.target;if(t.matches('input[type=color][data-sync-color]')){var x=document.querySelector('input[data-sync-text="'+t.getAttribute('data-sync-color')+'"]');if(x)x.value=t.value;}if(t.matches('input[data-sync-text]')&&/^#[0-9a-fA-F]{6}$/.test(t.value)){var c=document.querySelector('input[type=color][data-sync-color="'+t.getAttribute('data-sync-text')+'"]');if(c)c.value=t.value;}});` }} />
      <h1 className="text-lg font-bold">様式（テンプレート）</h1>
      {sp?.error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}
      {sp?.done && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">様式を追加しました。下の一覧から文言やロゴを調整できます。</p>}
      <StyleGallery company={accRows[0]?.name || ""} />
      <div className="mt-4 space-y-4">
        {rows.map((t) => (
          <details key={t.id} className="rounded-xl bg-white p-5 shadow">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: t.header_color }} />
              {t.name}
              <span className="text-sm font-normal text-slate-400">{t.brand_name}{t.tagline ? ` / ${t.tagline}` : ""}</span>
            </summary>
            <div className="mt-4">
              <TemplateForm template={t} images={libraryImages} watermarks={effectiveWatermarks(t)} />
              <div className="mt-3 flex items-center gap-4">
                <TemplatePreviewButton templateId={t.id} sampleImageId={libraryImages[0]?.id || null} />
                <form action={deleteTemplateAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-sm text-red-600 hover:underline">この様式を削除</button>
                </form>
              </div>
              <p className="mt-1 text-xs text-slate-400">プレビューは保存済みの設定で表示されます。変更したら先に「更新」を押してください。</p>
            </div>
          </details>
        ))}
        <details className="rounded-xl bg-white p-5 shadow">
          <summary className="cursor-pointer font-medium">＋ 新しい様式を追加</summary>
          <div className="mt-4"><TemplateForm template={null} images={libraryImages} /></div>
        </details>
      </div>
    </div>
  );
}
