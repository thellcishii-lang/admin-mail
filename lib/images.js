import { db } from "./db";

// 本文デザイン用の画像ライブラリ。ロゴと同じくDBに保存し、公開URLで配信する
// （送信したメールから参照されるため）。本文には [画像:ID] のマーカーで差し込む。
export const MAX_IMAGES_PER_ACCOUNT = 30;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function imageUrlFor(id) {
  const base = process.env.APP_BASE_URL || "https://admin-mail-green.vercel.app";
  return `${base}/img/${id}`;
}

export async function listImages(accountId) {
  const { rows } = await db().query(
    "SELECT id, name, mime, created_at FROM mail_images WHERE account_id = $1 AND source_key IS NULL ORDER BY id",
    [accountId]
  );
  return rows;
}

// 本文中の [画像:ID] を、このアカウントの画像だけ解決して URL の対応表を返す
export async function resolveBodyImages(accountId, body) {
  const ids = [...new Set([...String(body || "").matchAll(/\[画像:(\d+)\]/g)].map((m) => Number(m[1])))];
  const map = {};
  if (!accountId || ids.length === 0) return map;
  const { rows } = await db().query(
    "SELECT id FROM mail_images WHERE account_id = $1 AND id = ANY($2)",
    [accountId, ids]
  );
  for (const r of rows) map[r.id] = imageUrlFor(r.id);
  return map;
}

export function stripImageMarkers(body) {
  return String(body || "").replace(/[ \t]*\[画像:\d+\][ \t]*\n?/g, "");
}

// ---- 透かし（背景） ----
// 位置はCSSの background-position キーワード、そのまま style に入れる
export const WATERMARK_POSITIONS = [
  "left top", "center top", "right top",
  "left center", "center", "right center",
  "left bottom", "center bottom", "right bottom",
];
export const WATERMARK_SIZES = [25, 40, 55, 75, 100];
export const WATERMARK_OPACITIES = [1, 0.5, 0.35, 0.2, 0.1];

export function parseWatermarkConfig(template) {
  try {
    const arr = JSON.parse(template?.watermark_config || "[]");
    return Array.isArray(arr) ? arr.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// sharp でアルファを薄くした PNG を作る（透かし具合の調整）
async function fadePng(base64, opacity) {
  const sharp = (await import("sharp")).default;
  const input = Buffer.from(base64, "base64");
  const meta = await sharp(input).metadata();
  const width = meta.width || 600;
  const height = meta.height || 600;
  const out = await sharp(input)
    .composite([{
      input: { create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: opacity } } },
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
  return out.toString("base64");
}

// 透かし用のURLを返す。opacity<1 のときは薄くした複製を mail_images に作って使い回す。
// source: {kind:'logo', template} | {kind:'image', id}
export async function watermarkUrl(accountId, source, opacity) {
  if (!source) return null;
  if (source.kind === "image") {
    const { rows } = await db().query(
      "SELECT id FROM mail_images WHERE id = $1 AND account_id = $2 AND source_key IS NULL",
      [source.id, accountId]
    );
    if (!rows[0]) return null;
    if (!(opacity < 1)) return imageUrlFor(source.id);
    return fadedUrl(accountId, `img:${source.id}`, opacity, async () => {
      const { rows: src } = await db().query("SELECT base64 FROM mail_images WHERE id = $1", [source.id]);
      return src[0]?.base64 || null;
    });
  }
  // ロゴ（様式に保存されたもの）
  const t = source.template;
  if (!t?.logo_base64) return null;
  if (!(opacity < 1)) {
    const base = process.env.APP_BASE_URL || "https://admin-mail-green.vercel.app";
    return `${base}/logo/${t.id}`;
  }
  return fadedUrl(accountId, `logo:${t.id}`, opacity, async () => t.logo_base64);
}

async function fadedUrl(accountId, sourceKey, opacity, loadBase64) {
  const { rows } = await db().query(
    "SELECT id FROM mail_images WHERE account_id = $1 AND source_key = $2 AND opacity = $3",
    [accountId, sourceKey, opacity]
  );
  if (rows[0]) return imageUrlFor(rows[0].id);
  try {
    const base64 = await loadBase64();
    if (!base64) return null;
    const faded = await fadePng(base64, opacity);
    const ins = await db().query(
      "INSERT INTO mail_images (account_id, name, mime, base64, source_key, opacity) VALUES ($1,'透かし','image/png',$2,$3,$4) RETURNING id",
      [accountId, faded, sourceKey, opacity]
    );
    return imageUrlFor(ins.rows[0].id);
  } catch {
    return null;
  }
}

// フッター画像（様式に指定されたライブラリ画像）のURLを解決する
export async function resolveFooterImage(template, accountId) {
  const id = Number(template?.footer_image_id);
  if (!id || !accountId) return null;
  const { rows } = await db().query(
    "SELECT id FROM mail_images WHERE id = $1 AND account_id = $2 AND source_key IS NULL",
    [id, accountId]
  );
  return rows[0] ? imageUrlFor(id) : null;
}

// 様式の透かし設定を、送信に使える {url, position, size} の配列に解決する
export async function resolveWatermarks(template, accountId) {
  const config = parseWatermarkConfig(template);
  const out = [];
  if (config.length === 0) {
    // 旧設定（ロゴを背景に薄く入れる）との互換
    if (template?.logo_background && template?.logo_base64) {
      const base = process.env.APP_BASE_URL || "https://admin-mail-green.vercel.app";
      out.push({ url: `${base}/logo/${template.id}`, position: "center", size: 55 });
    }
    return out;
  }
  for (const w of config) {
    const source = w.source === "logo"
      ? { kind: "logo", template }
      : w.source?.startsWith("img:") ? { kind: "image", id: Number(w.source.slice(4)) } : null;
    if (!source) continue;
    const url = await watermarkUrl(accountId, source, WATERMARK_OPACITIES.includes(w.opacity) ? w.opacity : 1);
    if (!url) continue;
    out.push({
      url,
      position: WATERMARK_POSITIONS.includes(w.position) ? w.position : "center",
      size: WATERMARK_SIZES.includes(w.size) ? w.size : 55,
    });
  }
  return out;
}
