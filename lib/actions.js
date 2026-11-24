"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, ensureReady } from "./db";
import { createSession, destroySession, requireUser } from "./auth";
import { sendMail, smtpConfigured } from "./mailer";
import { deleteMessage } from "./mailbox";

export async function loginAction(formData) {
  await ensureReady();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const { rows } = await db().query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    redirect("/login?error=1");
  }
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

async function readAttachments(formData) {
  const files = formData.getAll("attachments").filter((f) => f && typeof f === "object" && f.size > 0);
  const out = [];
  for (const f of files) out.push({ filename: f.name, content: Buffer.from(await f.arrayBuffer()) });
  return out;
}

async function getTemplate(id) {
  if (!id) return null;
  const { rows } = await db().query("SELECT * FROM mail_templates WHERE id = $1", [Number(id)]);
  return rows[0] || null;
}

async function recordSent(user, template, to, subject, body, attachments, batchId) {
  await db().query(
    `INSERT INTO sent_emails (user_id, template_id, to_address, subject, body, attachment_names, batch_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [user.id, template?.id || null, to, subject, body, attachments.map((a) => a.filename).join(", "), batchId]
  );
}

export async function sendOneAction(formData) {
  const user = await requireUser();
  if (!smtpConfigured()) redirect("/compose?error=" + encodeURIComponent("SMTPが未設定です（INFOMAIL_USER / INFOMAIL_PASS）"));
  const template = await getTemplate(formData.get("template_id"));
  const to = String(formData.get("to") || "").trim();
  let subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "");
  if (formData.get("reply") === "1" && subject && !/^re:/i.test(subject)) subject = `Re: ${subject}`;
  const attachments = await readAttachments(formData);
  try {
    await sendMail({ template, to, subject, body, attachments });
  } catch (e) {
    redirect("/compose?error=" + encodeURIComponent(`送信に失敗しました: ${e.message}`));
  }
  await recordSent(user, template, to, subject, body, attachments, null);
  redirect("/sent?done=1");
}

export async function broadcastAction(formData) {
  const user = await requireUser();
  if (!smtpConfigured()) redirect("/broadcast?error=" + encodeURIComponent("SMTPが未設定です（INFOMAIL_USER / INFOMAIL_PASS）"));
  const template = await getTemplate(formData.get("template_id"));
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "");
  const recipients = String(formData.get("recipients") || "")
    .split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) redirect("/broadcast?error=" + encodeURIComponent("宛先がありません"));
  if (recipients.length > 100) redirect("/broadcast?error=" + encodeURIComponent("一斉送信は100件までです"));
  const batchId = crypto.randomUUID();
  let failed = 0;
  for (const to of recipients) {
    try {
      await sendMail({ template, to, subject, body, attachments: [] });
      await recordSent(user, template, to, subject, body, [], batchId);
    } catch { failed++; }
  }
  redirect(`/sent?done=1${failed ? `&failed=${failed}` : ""}`);
}

const TEMPLATE_FIELDS = ["name", "brand_name", "tagline", "header_color", "from_name", "footer_company", "footer_address", "footer_email", "footer_url", "from_address"];

export async function saveTemplateAction(formData) {
  await requireUser();
  const id = formData.get("id");
  const values = TEMPLATE_FIELDS.map((f) => String(formData.get(f) || "").trim());
  if (!/^#[0-9a-fA-F]{6}$/.test(values[3])) values[3] = "#1e2a3a";
  if (id) {
    await db().query(
      `UPDATE mail_templates SET ${TEMPLATE_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ")} WHERE id = $${TEMPLATE_FIELDS.length + 1}`,
      [...values, Number(id)]
    );
  } else {
    const { rows } = await db().query("SELECT COALESCE(MAX(position),0)+1 AS p FROM mail_templates");
    await db().query(
      `INSERT INTO mail_templates (${TEMPLATE_FIELDS.join(", ")}, position) VALUES (${TEMPLATE_FIELDS.map((_, i) => `$${i + 1}`).join(", ")}, $${TEMPLATE_FIELDS.length + 1})`,
      [...values, rows[0].p]
    );
  }
  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplateAction(formData) {
  await requireUser();
  await db().query("DELETE FROM mail_templates WHERE id = $1", [Number(formData.get("id"))]);
  revalidatePath("/templates");
  redirect("/templates");
}

export async function changePasswordAction(formData) {
  const user = await requireUser();
  const current = String(formData.get("current_password") || "");
  const next = String(formData.get("password") || "");
  const confirm = String(formData.get("password_confirmation") || "");
  const { rows } = await db().query("SELECT * FROM users WHERE id = $1", [user.id]);
  if (!(await bcrypt.compare(current, rows[0].password_hash))) redirect("/password?error=" + encodeURIComponent("現在のパスワードが違います"));
  if (next.length < 8) redirect("/password?error=" + encodeURIComponent("パスワードは8文字以上にしてください"));
  if (next !== confirm) redirect("/password?error=" + encodeURIComponent("確認用パスワードが一致しません"));
  await db().query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), user.id]);
  redirect("/password?done=1");
}

export async function deleteMessageAction(formData) {
  await requireUser();
  const uid = Number(formData.get("uid"));
  const folder = ["spam", "trash"].includes(formData.get("folder")) ? formData.get("folder") : "inbox";
  let back = String(formData.get("back") || "/");
  if (!back.startsWith("/") || back.startsWith("//")) back = "/";
  try { await deleteMessage(uid, folder); } catch {}
  redirect(back);
}
