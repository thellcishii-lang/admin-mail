import { db, ensureReady } from "@/lib/db";

// 本文画像の公開配信（送信メールから参照される）
export async function GET(request, { params }) {
  await ensureReady();
  const { id } = await params;
  const { rows } = await db().query(
    "SELECT base64, mime FROM mail_images WHERE id = $1",
    [Number(id)]
  );
  const img = rows[0];
  if (!img || !img.base64) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(img.base64, "base64"), {
    headers: { "Content-Type": img.mime || "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
