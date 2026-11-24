import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export class NotConfiguredError extends Error {}
export class ConnectionError extends Error {}

export const ADDRESSES = [
  "info@push-taro.com",
  "admin@agent-partners.space",
  "info@agent-partners.space",
  "info@mottecogoods.com",
];

export function imapConfigured() {
  return Boolean((process.env.IMAP_USER || process.env.INFOMAIL_USER) && (process.env.IMAP_PASS || process.env.INFOMAIL_PASS));
}

async function withClient(fn) {
  if (!imapConfigured()) throw new NotConfiguredError("IMAPが未設定です");
  const client = new ImapFlow({
    host: (process.env.IMAP_HOST || "imap.zoho.jp").trim(),
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: {
      user: (process.env.IMAP_USER || process.env.INFOMAIL_USER || "").trim(),
      pass: (process.env.IMAP_PASS || process.env.INFOMAIL_PASS || "").trim(),
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

// ImapFlow envelopes carry arrays of {name, address}; mailparser uses {value:[...]}.
function addrList(a) {
  if (!a) return [];
  const list = Array.isArray(a) ? a : a.value || [];
  return list.map((v) => ({ name: v.name || "", address: (v.address || "").toLowerCase() }));
}
function addrText(a) {
  const v = addrList(a)[0];
  if (!v) return "";
  return v.name ? `${v.name} <${v.address}>` : v.address;
}

async function resolveFolder(client, folder) {
  if (folder === "spam") {
    const boxes = await client.list();
    const junk = boxes.find((b) => b.specialUse === "\\Junk") || boxes.find((b) => /spam|junk/i.test(b.path));
    return junk ? junk.path : "Spam";
  }
  if (folder === "trash") {
    const boxes = await client.list();
    const trash = boxes.find((b) => b.specialUse === "\\Trash") || boxes.find((b) => /trash|deleted/i.test(b.path));
    return trash ? trash.path : "Trash";
  }
  return "INBOX";
}

export async function deleteMessage(uid, folder = "inbox") {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      if (folder === "trash") {
        await client.messageDelete(String(uid), { uid: true });
      } else {
        const trashPath = await resolveFolder(client, "trash");
        await client.messageMove(String(uid), trashPath, { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}

export async function listInbox({ limit = 100, folder = "inbox", address = null } = {}) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const total = client.mailbox.exists;
      const out = [];
      if (total > 0) {
        const from = Math.max(1, total - limit + 1);
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, flags: true, uid: true })) {
          const recipients = [...addrList(msg.envelope?.to), ...addrList(msg.envelope?.cc)].map((r) => r.address);
          if (address && !recipients.includes(address.toLowerCase())) continue;
          out.push({
            uid: msg.uid,
            subject: msg.envelope?.subject || "(件名なし)",
            from: addrText(msg.envelope?.from),
            to: addrText(msg.envelope?.to),
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

export async function getMessage(uid, folder = "inbox") {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(String(uid), { source: true, envelope: true, flags: true }, { uid: true });
      if (!msg) return null;
      const parsed = await simpleParser(msg.source);
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return {
        uid,
        subject: parsed.subject || msg.envelope?.subject || "(件名なし)",
        from: parsed.from?.text || addrText(msg.envelope?.from),
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
