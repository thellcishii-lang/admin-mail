import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export class NotConfiguredError extends Error {}
export class ConnectionError extends Error {}

export function imapConfigured() {
  return Boolean((process.env.IMAP_USER || process.env.INFOMAIL_USER) && (process.env.IMAP_PASS || process.env.INFOMAIL_PASS));
}

async function withClient(fn) {
  if (!imapConfigured()) throw new NotConfiguredError("IMAPが未設定です");
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.zoho.jp",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER || process.env.INFOMAIL_USER,
      pass: process.env.IMAP_PASS || process.env.INFOMAIL_PASS,
    },
    logger: false,
  });
  try {
    await client.connect();
    return await fn(client);
  } catch (e) {
    if (e instanceof NotConfiguredError) throw e;
    throw new ConnectionError(e.responseText || e.message || "IMAP接続に失敗しました");
  } finally {
    try { await client.logout(); } catch {}
  }
}

function addr(a) {
  if (!a) return "";
  const v = a.value?.[0];
  if (!v) return "";
  return v.name ? `${v.name} <${v.address}>` : v.address || "";
}

export async function listInbox(limit = 50) {
  return withClient(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = client.mailbox.exists;
      const out = [];
      if (total > 0) {
        const from = Math.max(1, total - limit + 1);
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, flags: true, uid: true })) {
          out.push({
            uid: msg.uid,
            subject: msg.envelope?.subject || "(件名なし)",
            from: addr(msg.envelope?.from),
            to: addr(msg.envelope?.to),
            date: msg.envelope?.date || null,
            seen: msg.flags?.has("\\Seen") ?? msg.flags?.includes?.("\\Seen") ?? false,
          });
        }
      }
      return out.reverse();
    } finally {
      lock.release();
    }
  });
}

export async function getMessage(uid) {
  return withClient(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(String(uid), { source: true, envelope: true, flags: true }, { uid: true });
      if (!msg) return null;
      const parsed = await simpleParser(msg.source);
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return {
        uid,
        subject: parsed.subject || msg.envelope?.subject || "(件名なし)",
        from: parsed.from?.text || addr(msg.envelope?.from),
        to: parsed.to?.text || "",
        date: parsed.date || msg.envelope?.date || null,
        text: parsed.text || "",
        attachments: (parsed.attachments || []).map((a) => a.filename),
      };
    } finally {
      lock.release();
    }
  });
}
