import crypto from "crypto";
import { db } from "./db";

// 見積・請求書システムとの連動キー。アカウント単位で1つ発行し、
// 相手側は Authorization: Bearer <key> でこのアカウントとして送信APIを叩く。
export function newLinkKey() {
  return "hm_" + crypto.randomBytes(24).toString("base64url");
}

export async function accountByLinkKey(key) {
  if (!key) return null;
  const { rows } = await db().query("SELECT * FROM accounts WHERE link_key = $1", [String(key)]);
  return rows[0] || null;
}

export async function ensureLinkKey(accountId) {
  const { rows } = await db().query("SELECT link_key FROM accounts WHERE id = $1", [accountId]);
  if (rows[0]?.link_key) return rows[0].link_key;
  const key = newLinkKey();
  await db().query("UPDATE accounts SET link_key = $1 WHERE id = $2", [key, accountId]);
  return key;
}

export async function regenerateLinkKey(accountId) {
  const key = newLinkKey();
  await db().query("UPDATE accounts SET link_key = $1 WHERE id = $2", [key, accountId]);
  return key;
}

export function bearerKey(request) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
