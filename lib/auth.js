import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureReady } from "./db";

const COOKIE = "admin_mail_session";
function secret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}
function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

async function setSessionCookie(data) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  (await cookies()).set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function createSession(userId) {
  await setSessionCookie({ uid: userId });
}

// アドレス単位のログイン（メールボックスのパスワードで入る）
export async function createMailboxSession(mailboxId) {
  await setSessionCookie({ mid: mailboxId });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

// ログイン中ユーザーを返す。2形式ある:
// - 管理者ログイン: { kind: "admin", id, email, accountId }（users テーブル）
// - アドレスログイン: { kind: "mailbox", id, email, accountId, mailboxId }（mailboxes テーブル）
export async function currentUser() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  await ensureReady();
  if (data.mid) {
    const { rows } = await db().query("SELECT id, address, account_id FROM mailboxes WHERE id = $1", [data.mid]);
    const box = rows[0];
    if (!box) return null;
    return { kind: "mailbox", id: box.id, email: box.address, accountId: box.account_id, mailboxId: box.id };
  }
  const { rows } = await db().query("SELECT id, email, account_id FROM users WHERE id = $1", [data.uid]);
  const user = rows[0];
  if (!user) return null;
  return { kind: "admin", id: user.id, email: user.email, accountId: user.account_id };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
