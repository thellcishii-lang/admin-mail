import { db, ensureReady } from "@/lib/db";

// 様式のロゴを公開URLで配信する（送信メールの中から参照される）。
// ロゴ自体はメールに載る前提の公開素材なので、ログインなしで返す。
export async function GET(request, { params }) {
  await ensureReady();
  const { id } = await params;
  const { rows } = await db().query(
    "SELECT logo_base64, logo_mime FROM mail_templates WHERE id = $1",
    [Number(id)]
  );
  const t = rows[0];
  if (!t || !t.logo_base64) return new Response("not found", { status: 404 });
  const bytes = Buffer.from(t.logo_base64, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": t.logo_mime || "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
