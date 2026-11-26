import { db, ensureReady } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { brandedHtml } from "@/lib/mailer";
import { resolveBodyImages, resolveWatermarks, resolveFooterImage } from "@/lib/images";

// 送信前プレビュー：様式＋本文から、実際に送られるHTMLを組み立てて返す
export async function POST(request) {
  await ensureReady();
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const data = await request.json().catch(() => ({}));
  const templateId = Number(data.template_id);
  const body = String(data.body || "");
  if (!templateId) return Response.json({ ok: false, error: "様式が選ばれていません" }, { status: 400 });
  const { rows } = await db().query(
    "SELECT * FROM mail_templates WHERE id = $1 AND account_id = $2",
    [templateId, user.accountId]
  );
  const template = rows[0];
  if (!template) return Response.json({ ok: false, error: "様式が見つかりません" }, { status: 404 });
  const imageMap = await resolveBodyImages(user.accountId, body);
  const watermarks = await resolveWatermarks(template, user.accountId);
  const footerImageUrl = await resolveFooterImage(template, user.accountId);
  return Response.json({ ok: true, html: brandedHtml(template, body, imageMap, watermarks, footerImageUrl) });
}
