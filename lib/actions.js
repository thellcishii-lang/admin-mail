"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, ensureReady } from "./db";
import { createSession, createMailboxSession, destroySession, requireUser } from "./auth";
import { sendMail, smtpConfigured } from "./mailer";
import { deleteMessage, toggleFlag, bulkDelete, bulkRestore } from "./mailbox";
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

export async function createTemplateFromStyleAction(formData) {
  const user = await requireUser();
  const { styleById } = await import("./styles");
  const style = styleById(String(formData.get("style_id") || ""));
  if (!style) redirect("/templates");
  const { rows: accRows } = await db().query("SELECT name FROM accounts WHERE id = $1", [user.accountId]);
  const company = accRows[0]?.name || "";
  const { rows: boxRows } = await db().query(
    "SELECT address FROM mailboxes WHERE account_id = $1 ORDER BY id LIMIT 1", [user.accountId]
  );
  const firstAddress = boxRows[0]?.address || "";
  const { rows } = await db().query("SELECT COALESCE(MAX(position),0)+1 AS p FROM mail_templates WHERE account_id = $1", [user.accountId]);
  await db().query(
    `INSERT INTO mail_templates (name, brand_name, tagline, header_color, from_name, footer_company, footer_address, footer_email, footer_url, from_address, position, account_id)
     VALUES ($1,$2,$3,$4,$5,$6,'',$7,'',$8,$9,$10)`,
    [`${style.name}スタイル`, company, style.tagline, style.header_color, company, company, firstAddress, firstAddress, rows[0].p, user.accountId]
  );
  revalidatePath("/templates");
  redirect("/templates?done=1");
}

const LOGO_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function saveTemplateAction(formData) {
  const user = await requireUser();
  const id = formData.get("id");
  const values = TEMPLATE_FIELDS.map((f) => String(formData.get(f) || "").trim());
  if (!/^#[0-9a-fA-F]{6}$/.test(values[3])) values[3] = "#1e2a3a";
  let templateId = id ? Number(id) : null;
  if (id) {
    await db().query(
      `UPDATE mail_templates SET ${TEMPLATE_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ")} WHERE id = $${TEMPLATE_FIELDS.length + 1} AND account_id = $${TEMPLATE_FIELDS.length + 2}`,
      [...values, Number(id), user.accountId]
    );
  } else {
    const { rows } = await db().query("SELECT COALESCE(MAX(position),0)+1 AS p FROM mail_templates WHERE account_id = $1", [user.accountId]);
    const ins = await db().query(
      `INSERT INTO mail_templates (${TEMPLATE_FIELDS.join(", ")}, position, account_id) VALUES (${TEMPLATE_FIELDS.map((_, i) => `$${i + 1}`).join(", ")}, $${TEMPLATE_FIELDS.length + 1}, $${TEMPLATE_FIELDS.length + 2}) RETURNING id`,
      [...values, rows[0].p, user.accountId]
    );
    templateId = ins.rows[0].id;
  }
  // ロゴ（配置フラグは常に反映、画像はアップロード/削除のときだけ差し替える）
  if (templateId) {
    const layout = ["left", "center", "logo_only"].includes(formData.get("logo_layout")) ? formData.get("logo_layout") : "left";
    const size = [28, 36, 48, 64, 84].includes(Number(formData.get("logo_size"))) ? Number(formData.get("logo_size")) : 36;
    const pad = [12, 20, 32, 44].includes(Number(formData.get("header_padding"))) ? Number(formData.get("header_padding")) : 20;
    // 透かし（最大3つ）：画像・位置・大きさ・薄さ
    const WM_POS = ["left top", "center top", "right top", "left center", "center", "right center", "left bottom", "center bottom", "right bottom"];
    const watermarks = [];
    for (let i = 0; i < 3; i++) {
      const source = String(formData.get(`wm${i}_source`) || "");
      if (source !== "logo" && !/^img:\d+$/.test(source)) continue;
      watermarks.push({
        source,
        position: WM_POS.includes(formData.get(`wm${i}_position`)) ? formData.get(`wm${i}_position`) : "center",
        size: [25, 40, 55, 75, 100].includes(Number(formData.get(`wm${i}_size`))) ? Number(formData.get(`wm${i}_size`)) : 55,
        opacity: [1, 0.5, 0.35, 0.2, 0.1].includes(Number(formData.get(`wm${i}_opacity`))) ? Number(formData.get(`wm${i}_opacity`)) : 1,
      });
    }
    // フッター（色の決め方・色・高さ・会社名とロゴの置き方・画像）
    const fStyle = ["light", "header", "custom"].includes(formData.get("footer_style")) ? formData.get("footer_style") : "light";
    const fColorRaw = String(formData.get("footer_color") || "").trim();
    const fColor = /^#[0-9a-fA-F]{6}$/.test(fColorRaw) ? fColorRaw : "#334155";
    const fPad = [12, 20, 32, 44].includes(Number(formData.get("footer_padding"))) ? Number(formData.get("footer_padding")) : 20;
    const fLayout = ["left", "center", "logo_only", "name_only"].includes(formData.get("footer_layout")) ? formData.get("footer_layout") : "left";
    let fImageId = Number(formData.get("footer_image_id")) || null;
    if (fImageId) {
      const chk = await db().query(
        "SELECT id FROM mail_images WHERE id = $1 AND account_id = $2 AND source_key IS NULL",
        [fImageId, user.accountId]
      );
      if (!chk.rows[0]) fImageId = null;
    }
    await db().query(
      `UPDATE mail_templates SET logo_header = $1, logo_footer = $2, logo_background = $3,
              logo_layout = $4, logo_size = $5, header_padding = $6, watermark_config = $7,
              footer_style = $8, footer_color = $9, footer_padding = $10, footer_layout = $11, footer_image_id = $12
       WHERE id = $13 AND account_id = $14`,
      [formData.get("logo_header") === "on", formData.get("logo_footer") === "on", formData.get("logo_background") === "on",
       layout, size, pad, JSON.stringify(watermarks),
       fStyle, fColor, fPad, fLayout, fImageId, templateId, user.accountId]
    );
    const file = formData.get("logo");
    if (formData.get("logo_remove") === "1") {
      await db().query("UPDATE mail_templates SET logo_base64 = '', logo_mime = '' WHERE id = $1 AND account_id = $2", [templateId, user.accountId]);
    } else if (file && typeof file === "object" && file.size > 0) {
      if (!LOGO_MIMES.includes(file.type)) redirect(`/templates?error=${encodeURIComponent("ロゴは PNG / JPEG / GIF / WebP の画像にしてください")}&edit=${templateId}#template-${templateId}`);
      if (file.size > 500 * 1024) redirect(`/templates?error=${encodeURIComponent("ロゴは500KBまでの画像にしてください")}&edit=${templateId}#template-${templateId}`);
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      await db().query("UPDATE mail_templates SET logo_base64 = $1, logo_mime = $2 WHERE id = $3 AND account_id = $4",
        [base64, file.type, templateId, user.accountId]);
    }
  }
  revalidatePath("/templates");
  redirect(`/templates?saved=${templateId}#template-${templateId}`);
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

// 一覧画面のまとめて操作（1件削除・旗・一括削除・一括で戻す）
export async function inboxBulkAction(formData) {
  const user = await requireUser();
  const rawFolder = String(formData.get("folder") || "inbox");
  const folder = ["spam", "trash", "flagged"].includes(rawFolder) ? rawFolder : "inbox";
  let back = String(formData.get("back") || "/");
  if (!back.startsWith("/") || back.startsWith("//")) back = "/";
  const mailbox = await pickMailbox(user, formData.get("to"));
  const op = String(formData.get("op") || "");
  try {
    if (op === "bulk_delete") {
      const uids = formData.getAll("uids").map(Number).filter((n) => n > 0);
      if (uids.length) await bulkDelete(uids, folder, mailbox);
    } else if (op === "bulk_restore") {
      const uids = formData.getAll("uids").map(Number).filter((n) => n > 0);
      if (uids.length) await bulkRestore(uids, mailbox);
    } else if (op.startsWith("delete_one:")) {
      await deleteMessage(Number(op.slice(11)), folder, mailbox);
    } else if (op.startsWith("restore_one:")) {
      await bulkRestore([Number(op.slice(12))], mailbox);
    } else if (op.startsWith("flag:")) {
      await toggleFlag(Number(op.slice(5)), folder, mailbox);
    }
  } catch {}
  redirect(back);
}

export async function toggleFlagAction(formData) {
  const user = await requireUser();
  const uid = Number(formData.get("uid"));
  const folder = ["spam", "trash", "flagged"].includes(formData.get("folder")) ? formData.get("folder") : "inbox";
  let back = String(formData.get("back") || "/");
  if (!back.startsWith("/") || back.startsWith("//")) back = "/";
  const mailbox = await pickMailbox(user, formData.get("to"));
  try { await toggleFlag(uid, folder, mailbox); } catch {}
  redirect(back);
}

export async function restoreMessageAction(formData) {
  const user = await requireUser();
  const uid = Number(formData.get("uid"));
  let back = String(formData.get("back") || "/");
  if (!back.startsWith("/") || back.startsWith("//")) back = "/";
  const mailbox = await pickMailbox(user, formData.get("to"));
  try { await bulkRestore([uid], mailbox); } catch {}
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

export async function regenerateLinkKeyAction() {
  const user = await requireUser();
  requireAdmin(user);
  const { regenerateLinkKey } = await import("./link");
  await regenerateLinkKey(user.accountId);
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
