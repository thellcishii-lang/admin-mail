"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, ensureReady } from "./db";
import { createSession, createMailboxSession, destroySession, requireUser } from "./auth";
import { sendMail, smtpConfigured } from "./mailer";
import { deleteMessage } from "./mailbox";
import { listMailboxes, getMailbox, findMailboxByAddress, pickMailbox, mailboxLimitFor } from "./mailboxes";
import { encryptSecret } from "./crypto";

export async function loginAction(formData) {
  await ensureReady();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  // まず管理者（users）を探し、なければアドレス（mailboxes）のログインとして試す
  const { rows } = await db().query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (user && (await bcrypt.compare(password, user.password_hash))) {
    await createSession(user.id);
    redirect("/");
  }
  const box = await findMailboxByAddress(email);
  if (box && (await bcrypt.compare(password, box.password_hash))) {
    await createMailboxSession(box.id);
    redirect("/");
  }
  redirect("/login?error=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// 申込（アカウント作成）: 会社＋管理者＋最初のアドレスを作る。課金は別段で扱う。
export async function signupAction(formData) {
  await ensureReady();
  const company = String(formData.get("company_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const address = String(formData.get("address") || "").trim();
  const addressPassword = String(formData.get("address_password") || "");
  const fail = (msg) => redirect("/signup?error=" + encodeURIComponent(msg));
  if (!company || !email || !address) fail("会社名・管理者メール・最初のアドレスを入力してください");
  if (password.length < 8 || addressPassword.length < 8) fail("パスワードは8文字以上にしてください");
  const dupUser = await db().query("SELECT id FROM users WHERE email = $1", [email]);
  if (dupUser.rows[0]) fail("その管理者メールは既に使われています");
  if (await findMailboxByAddress(address)) fail("そのアドレスは既に使われています");

  const acc = await db().query("INSERT INTO accounts (name) VALUES ($1) RETURNING id", [company]);
  const accountId = acc.rows[0].id;
  const userIns = await db().query(
    "INSERT INTO users (email, password_hash, account_id) VALUES ($1,$2,$3) RETURNING id",
    [email, await bcrypt.hash(password, 10), accountId]
  );
  await db().query(
    "INSERT INTO mailboxes (account_id, address, password_hash) VALUES ($1,$2,$3)",
    [accountId, address, await bcrypt.hash(addressPassword, 10)]
  );
  // 最初の様式（自社ブランド）を1つ用意する
  await db().query(
    `INSERT INTO mail_templates (name, brand_name, header_color, from_name, footer_company, from_address, position, account_id)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7)`,
    [company, company, "#374151", company, company, address, accountId]
  );
  await createSession(userIns.rows[0].id);
  redirect("/settings?welcome=1");
}

async function readAttachments(formData) {
  const files = formData.getAll("attachments").filter((f) => f && typeof f === "object" && f.size > 0);
  const out = [];
  for (const f of files) out.push({ filename: f.name, content: Buffer.from(await f.arrayBuffer()) });
  return out;
}

async function getTemplate(id, accountId) {
  if (!id) return null;
  const { rows } = await db().query(
    "SELECT * FROM mail_templates WHERE id = $1 AND account_id = $2",
    [Number(id), accountId]
  );
  return rows[0] || null;
}

// 送信に使うメールボックスを決める。
// アドレスログインなら自分、管理者なら様式の差出人アドレスに一致するもの（なければ先頭）。
async function resolveSendMailbox(user, template) {
  if (user.kind === "mailbox") return getMailbox(user.mailboxId);
  const boxes = await listMailboxes(user.accountId);
  if (boxes.length === 0) return null;
  if (template?.from_address) {
    const hit = boxes.find((b) => b.address.toLowerCase() === template.from_address.toLowerCase());
    if (hit) return hit;
  }
  return boxes[0];
}

async function recordSent(user, mailbox, template, to, subject, body, attachments, batchId) {
  await db().query(
    `INSERT INTO sent_emails (user_id, template_id, to_address, subject, body, attachment_names, batch_id, account_id, mailbox_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [user.kind === "admin" ? user.id : null, template?.id || null, to, subject, body,
     attachments.map((a) => a.filename).join(", "), batchId, user.accountId, mailbox?.id || null]
  );
}

export async function sendOneAction(formData) {
  const user = await requireUser();
  const template = await getTemplate(formData.get("template_id"), user.accountId);
  const mailbox = await resolveSendMailbox(user, template);
  if (!smtpConfigured(mailbox)) redirect("/compose?error=" + encodeURIComponent("SMTPが未設定です（アドレス設定で自社SMTPを登録してください）"));
  const to = String(formData.get("to") || "").trim();
  let subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "");
  if (formData.get("reply") === "1" && subject && !/^re:/i.test(subject)) subject = `Re: ${subject}`;
  const attachments = await readAttachments(formData);
  try {
    await sendMail({ template, to, subject, body, attachments, mailbox });
  } catch (e) {
    redirect("/compose?error=" + encodeURIComponent(`送信に失敗しました: ${e.message}`));
  }
  await recordSent(user, mailbox, template, to, subject, body, attachments, null);
  redirect("/sent?done=1");
}

export async function broadcastAction(formData) {
  const user = await requireUser();
  const template = await getTemplate(formData.get("template_id"), user.accountId);
  const mailbox = await resolveSendMailbox(user, template);
  if (!smtpConfigured(mailbox)) redirect("/broadcast?error=" + encodeURIComponent("SMTPが未設定です（アドレス設定で自社SMTPを登録してください）"));
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
      await sendMail({ template, to, subject, body, attachments: [], mailbox });
      await recordSent(user, mailbox, template, to, subject, body, [], batchId);
    } catch { failed++; }
  }
  redirect(`/sent?done=1${failed ? `&failed=${failed}` : ""}`);
}

const TEMPLATE_FIELDS = ["name", "brand_name", "tagline", "header_color", "from_name", "footer_company", "footer_address", "footer_email", "footer_url", "from_address"];

export async function saveTemplateAction(formData) {
  const user = await requireUser();
  const id = formData.get("id");
  const values = TEMPLATE_FIELDS.map((f) => String(formData.get(f) || "").trim());
  if (!/^#[0-9a-fA-F]{6}$/.test(values[3])) values[3] = "#1e2a3a";
  if (id) {
    await db().query(
      `UPDATE mail_templates SET ${TEMPLATE_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ")} WHERE id = $${TEMPLATE_FIELDS.length + 1} AND account_id = $${TEMPLATE_FIELDS.length + 2}`,
      [...values, Number(id), user.accountId]
    );
  } else {
    const { rows } = await db().query("SELECT COALESCE(MAX(position),0)+1 AS p FROM mail_templates WHERE account_id = $1", [user.accountId]);
    await db().query(
      `INSERT INTO mail_templates (${TEMPLATE_FIELDS.join(", ")}, position, account_id) VALUES (${TEMPLATE_FIELDS.map((_, i) => `$${i + 1}`).join(", ")}, $${TEMPLATE_FIELDS.length + 1}, $${TEMPLATE_FIELDS.length + 2})`,
      [...values, rows[0].p, user.accountId]
    );
  }
  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplateAction(formData) {
  const user = await requireUser();
  await db().query("DELETE FROM mail_templates WHERE id = $1 AND account_id = $2", [Number(formData.get("id")), user.accountId]);
  revalidatePath("/templates");
  redirect("/templates");
}

export async function changePasswordAction(formData) {
  const user = await requireUser();
  const current = String(formData.get("current_password") || "");
  const next = String(formData.get("password") || "");
  const confirm = String(formData.get("password_confirmation") || "");
  const table = user.kind === "mailbox" ? "mailboxes" : "users";
  const { rows } = await db().query(`SELECT * FROM ${table} WHERE id = $1`, [user.id]);
  if (!(await bcrypt.compare(current, rows[0].password_hash))) redirect("/password?error=" + encodeURIComponent("現在のパスワードが違います"));
  if (next.length < 8) redirect("/password?error=" + encodeURIComponent("パスワードは8文字以上にしてください"));
  if (next !== confirm) redirect("/password?error=" + encodeURIComponent("確認用パスワードが一致しません"));
  await db().query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [await bcrypt.hash(next, 10), user.id]);
  redirect("/password?done=1");
}

export async function deleteMessageAction(formData) {
  const user = await requireUser();
  const uid = Number(formData.get("uid"));
  const folder = ["spam", "trash"].includes(formData.get("folder")) ? formData.get("folder") : "inbox";
  let back = String(formData.get("back") || "/");
  if (!back.startsWith("/") || back.startsWith("//")) back = "/";
  const mailbox = await pickMailbox(user, formData.get("to"));
  try { await deleteMessage(uid, folder, mailbox); } catch {}
  redirect(back);
}

// --- アドレス（メールボックス）管理：管理者のみ ---
function requireAdmin(user) {
  if (user.kind !== "admin") redirect("/");
}

export async function saveMailboxAction(formData) {
  const user = await requireUser();
  requireAdmin(user);
  const id = formData.get("id");
  const address = String(formData.get("address") || "").trim();
  const displayName = String(formData.get("display_name") || "").trim();
  const loginPassword = String(formData.get("login_password") || "");
  const fields = {
    imap_host: String(formData.get("imap_host") || "").trim(),
    imap_port: Number(formData.get("imap_port") || 993),
    imap_user: String(formData.get("imap_user") || "").trim(),
    smtp_host: String(formData.get("smtp_host") || "").trim(),
    smtp_port: Number(formData.get("smtp_port") || 465),
    smtp_user: String(formData.get("smtp_user") || "").trim(),
  };
  const imapPass = String(formData.get("imap_pass") || "");
  const smtpPass = String(formData.get("smtp_pass") || "");
  if (!address) redirect("/settings?error=" + encodeURIComponent("アドレスを入力してください"));

  if (id) {
    const box = await getMailbox(id);
    if (!box || box.account_id !== user.accountId) redirect("/settings");
    const sets = ["address = $1", "display_name = $2", "imap_host = $3", "imap_port = $4", "imap_user = $5",
      "smtp_host = $6", "smtp_port = $7", "smtp_user = $8"];
    const vals = [address, displayName, fields.imap_host, fields.imap_port, fields.imap_user,
      fields.smtp_host, fields.smtp_port, fields.smtp_user];
    if (imapPass) { sets.push(`imap_pass_enc = $${vals.length + 1}`); vals.push(encryptSecret(imapPass)); }
    if (smtpPass) { sets.push(`smtp_pass_enc = $${vals.length + 1}`); vals.push(encryptSecret(smtpPass)); }
    if (loginPassword) {
      if (loginPassword.length < 8) redirect("/settings?error=" + encodeURIComponent("ログインパスワードは8文字以上にしてください"));
      sets.push(`password_hash = $${vals.length + 1}`); vals.push(await bcrypt.hash(loginPassword, 10));
    }
    vals.push(box.id);
    await db().query(`UPDATE mailboxes SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
  } else {
    if (await findMailboxByAddress(address)) redirect("/settings?error=" + encodeURIComponent("そのアドレスは既に使われています"));
    if (loginPassword.length < 8) redirect("/settings?error=" + encodeURIComponent("ログインパスワードは8文字以上にしてください"));
    const limit = await mailboxLimitFor(user.accountId);
    const { rows: cnt } = await db().query("SELECT COUNT(*)::int AS c FROM mailboxes WHERE account_id = $1", [user.accountId]);
    if (cnt[0].c >= limit) redirect("/settings?error=" + encodeURIComponent(`アドレスは${limit}個までです（追加は1口2,500円/月で+10個）`));
    await db().query(
      `INSERT INTO mailboxes (account_id, address, display_name, password_hash,
        imap_host, imap_port, imap_user, imap_pass_enc, smtp_host, smtp_port, smtp_user, smtp_pass_enc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [user.accountId, address, displayName, await bcrypt.hash(loginPassword, 10),
       fields.imap_host, fields.imap_port, fields.imap_user, encryptSecret(imapPass),
       fields.smtp_host, fields.smtp_port, fields.smtp_user, encryptSecret(smtpPass)]
    );
  }
  revalidatePath("/settings");
  redirect("/settings?done=1");
}

export async function deleteMailboxAction(formData) {
  const user = await requireUser();
  requireAdmin(user);
  await db().query("DELETE FROM mailboxes WHERE id = $1 AND account_id = $2", [Number(formData.get("id")), user.accountId]);
  revalidatePath("/settings");
  redirect("/settings?done=1");
}
