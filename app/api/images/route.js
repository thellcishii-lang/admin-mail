import { db, ensureReady } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { listImages, MAX_IMAGES_PER_ACCOUNT, MAX_IMAGE_BYTES, IMAGE_MIMES } from "@/lib/images";

// 作成画面の画像ライブラリ用API（ログイン中のアカウントの画像だけを扱う）
export async function GET() {
  await ensureReady();
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, images: await listImages(user.accountId) });
}

export async function POST(request) {
  await ensureReady();
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "ログインが必要です" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !file.size) {
    return Response.json({ ok: false, error: "画像ファイルが必要です" }, { status: 400 });
  }
  if (!IMAGE_MIMES.includes(file.type)) {
    return Response.json({ ok: false, error: "PNG / JPEG / GIF / WebP の画像にしてください" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, error: "画像は1MBまでにしてください" }, { status: 400 });
  }
  const { rows } = await db().query("SELECT COUNT(*)::int AS c FROM mail_images WHERE account_id = $1 AND source_key IS NULL", [user.accountId]);
  if (rows[0].c >= MAX_IMAGES_PER_ACCOUNT) {
    return Response.json({ ok: false, error: `画像は${MAX_IMAGES_PER_ACCOUNT}枚までです` }, { status: 400 });
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  await db().query(
    "INSERT INTO mail_images (account_id, name, mime, base64) VALUES ($1,$2,$3,$4)",
    [user.accountId, String(file.name || "").slice(0, 120), file.type, base64]
  );
  return Response.json({ ok: true, images: await listImages(user.accountId) });
}

export async function DELETE(request) {
  await ensureReady();
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (id) {
    await db().query("DELETE FROM mail_images WHERE id = $1 AND account_id = $2", [id, user.accountId]);
  }
  return Response.json({ ok: true, images: await listImages(user.accountId) });
}
