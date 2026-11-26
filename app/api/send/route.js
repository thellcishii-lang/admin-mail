import { db, ensureReady } from "@/lib/db";
import { accountByLinkKey, bearerKey } from "@/lib/link";
import { listMailboxes } from "@/lib/mailboxes";
import { sendMail, smtpConfigured } from "@/lib/mailer";

// 見積・請求書システムからの連動送信。連動キーでアカウントを特定し、
// そのアカウントの様式とアドレスで会社のメールとして送る。
// 送信履歴は HTMLメール側の sent_emails にも残る。
// ※契約状態による停止（402）は第3段の課金実装でここに入れる。
export async function POST(request) {
  await ensureReady();
  const account = await accountByLinkKey(bearerKey(request));
  if (!account) return Response.json({ ok: false, error: "連動キーが正しくありません" }, { status: 401 });

  let payload;
  try { payload = await request.json(); } catch {
    return Response.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "");
  if (!to || !subject || !body) {
    return Response.json({ ok: false, error: "宛先・件名・本文が必要です" }, { status: 400 });
  }

  // 様式: 指定があればそれ、なければ「見積・請求書システム」様式、それもなければ先頭
  let template = null;
  if (payload.template_id) {
    const { rows } = await db().query(
      "SELECT * FROM mail_templates WHERE id = $1 AND account_id = $2",
      [Number(payload.template_id), account.id]
    );
    template = rows[0] || null;
  }
  if (!template) {
    const { rows } = await db().query(
      "SELECT * FROM mail_templates WHERE account_id = $1 ORDER BY (name = '見積・請求書システム') DESC, position, id LIMIT 1",
      [account.id]
    );
    template = rows[0] || null;
  }

  // 送信アドレス: 指定があればそれ、なければ様式の差出人に一致するもの、それもなければ先頭
  const boxes = await listMailboxes(account.id);
  let mailbox = null;
  if (payload.mailbox_address) {
    mailbox = boxes.find((b) => b.address.toLowerCase() === String(payload.mailbox_address).toLowerCase()) || null;
  }
  if (!mailbox && template?.from_address) {
    mailbox = boxes.find((b) => b.address.toLowerCase() === template.from_address.toLowerCase()) || null;
  }
  if (!mailbox) mailbox = boxes[0] || null;
  if (!mailbox) return Response.json({ ok: false, error: "送信できるアドレスが登録されていません" }, { status: 400 });
  if (!smtpConfigured(mailbox)) {
    return Response.json({ ok: false, error: "SMTPが未設定です（HTMLメール側のアドレス設定で登録してください）" }, { status: 400 });
  }

  try {
    await sendMail({ template, to, subject, body, attachments: [], mailbox });
  } catch (e) {
    return Response.json({ ok: false, error: `送信に失敗しました: ${e.message}` }, { status: 502 });
  }
  await db().query(
    `INSERT INTO sent_emails (user_id, template_id, to_address, subject, body, attachment_names, batch_id, account_id, mailbox_id)
     VALUES (NULL,$1,$2,$3,$4,'',NULL,$5,$6)`,
    [template?.id || null, to, subject, body, account.id, mailbox.id]
  );
  return Response.json({ ok: true, from: mailbox.address, template: template?.name || null });
}
