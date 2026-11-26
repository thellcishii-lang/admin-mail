import crypto from "crypto";

// メールボックスの IMAP/SMTP パスワードを DB に暗号化して保存するための小さなヘルパー。
// 鍵は SESSION_SECRET から導出する（環境変数に平文の鍵を増やさない）。
function key() {
  return crypto.createHash("sha256").update(process.env.SESSION_SECRET || "dev-secret-change-me").digest();
}

export function encryptSecret(plain) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(stored) {
  if (!stored) return "";
  try {
    const [iv, tag, enc] = String(stored).split(".").map((s) => Buffer.from(s, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
