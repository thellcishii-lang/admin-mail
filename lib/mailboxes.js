import { db } from "./db";
import { decryptSecret } from "./crypto";

// アドレスの上限は「口数 × 10」。基本1口（月額2,500円）で10個、
// 追加1口（+2,500円/月）ごとに+10個。別アカウントにはならず、同じ会社の中で増える。
export const MAILBOXES_PER_UNIT = 10;

export async function mailboxLimitFor(accountId) {
  const { rows } = await db().query("SELECT units FROM accounts WHERE id = $1", [accountId]);
  const units = rows[0]?.units || 1;
  return units * MAILBOXES_PER_UNIT;
}

// アカウント（会社）とメールボックス（アドレス）の取得・接続設定の解決。
// 運営者のメールボックスは use_env_defaults = true で、従来の環境変数
// （IMAP_USER など）をそのまま使う。新規顧客のメールボックスは DB に
// 暗号化して保存した自社の IMAP/SMTP 設定を使う。

export async function listMailboxes(accountId) {
  const { rows } = await db().query(
    "SELECT * FROM mailboxes WHERE account_id = $1 ORDER BY id",
    [accountId]
  );
  return rows;
}

export async function getMailbox(id) {
  if (!id) return null;
  const { rows } = await db().query("SELECT * FROM mailboxes WHERE id = $1", [Number(id)]);
  return rows[0] || null;
}

export async function findMailboxByAddress(address) {
  const { rows } = await db().query(
    "SELECT * FROM mailboxes WHERE lower(address) = lower($1)",
    [String(address || "")]
  );
  return rows[0] || null;
}

// ログイン中ユーザーが操作できるメールボックスを決める。
// - アドレスログイン: 自分のメールボックスのみ
// - 管理者ログイン: アカウントの全メールボックス（selectedId があればそれ、なければ先頭）
export async function visibleMailboxes(user) {
  if (!user) return [];
  if (user.kind === "mailbox") {
    const own = await getMailbox(user.mailboxId);
    return own ? [own] : [];
  }
  return listMailboxes(user.accountId);
}

export async function pickMailbox(user, selectedAddress) {
  const boxes = await visibleMailboxes(user);
  if (boxes.length === 0) return null;
  if (selectedAddress) {
    const hit = boxes.find((b) => b.address.toLowerCase() === String(selectedAddress).toLowerCase());
    if (hit) return hit;
  }
  return boxes[0];
}

export function imapConfigFor(mailbox) {
  if (mailbox && !mailbox.use_env_defaults && mailbox.imap_user) {
    return {
      host: (mailbox.imap_host || "imap.zoho.jp").trim(),
      port: Number(mailbox.imap_port || 993),
      user: mailbox.imap_user.trim(),
      pass: decryptSecret(mailbox.imap_pass_enc),
    };
  }
  const user = process.env.IMAP_USER || process.env.INFOMAIL_USER;
  const pass = process.env.IMAP_PASS || process.env.INFOMAIL_PASS;
  if (!user || !pass) return null;
  return {
    host: (process.env.IMAP_HOST || "imap.zoho.jp").trim(),
    port: Number(process.env.IMAP_PORT || 993),
    user: user.trim(),
    pass: pass.trim(),
  };
}

export function smtpConfigFor(mailbox) {
  if (mailbox && !mailbox.use_env_defaults && mailbox.smtp_user) {
    return {
      host: (mailbox.smtp_host || "smtp.zoho.jp").trim(),
      port: Number(mailbox.smtp_port || 465),
      user: mailbox.smtp_user.trim(),
      pass: decryptSecret(mailbox.smtp_pass_enc),
    };
  }
  if (!process.env.INFOMAIL_USER || !process.env.INFOMAIL_PASS) return null;
  return {
    host: (process.env.SMTP_HOST || "smtp.zoho.jp").trim(),
    port: 465,
    user: process.env.INFOMAIL_USER.trim(),
    pass: process.env.INFOMAIL_PASS.trim(),
  };
}
