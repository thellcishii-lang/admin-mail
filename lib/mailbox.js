import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { imapConfigFor } from "./mailboxes";

export class NotConfiguredError extends Error {}
export class ConnectionError extends Error {}

// 運営者のアドレス（移行シード用。新規顧客のアドレスは mailboxes テーブルで管理する）
export const ADDRESSES = [
  "info@push-taro.com",
  "admin@agent-partners.space",
  "info@agent-partners.space",
  "info@mottecogoods.com",
];

export function imapConfigured(mailbox) {
  return Boolean(imapConfigFor(mailbox));
}

async function withClient(fn, mailbox) {
  const config = imapConfigFor(mailbox);
  if (!config) throw new NotConfiguredError("IMAPが未設定です");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
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

// MOVE が使えないサーバーでは コピー＋削除 に切り替える（messageMove は失敗時に false を返す）
async function moveMessage(client, uid, destPath) {
  const moved = await client.messageMove(String(uid), destPath, { uid: true });
  if (moved) return;
  await client.messageCopy(String(uid), destPath, { uid: true });
  await client.messageDelete(String(uid), { uid: true });
}

export async function deleteMessage(uid, folder = "inbox", mailbox = null) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      if (folder === "trash") {
        await client.messageDelete(String(uid), { uid: true });
      } else {
        const trashPath = await resolveFolder(client, "trash");
        await moveMessage(client, uid, trashPath);
      }
    } finally {
      lock.release();
    }
  }, mailbox);
}

function hasFlag(flags, name) {
  return flags?.has?.(name) ?? flags?.includes?.(name) ?? false;
}

export async function listInbox({ limit = 100, folder = "inbox", address = null, mailbox = null } = {}) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const total = client.mailbox.exists;
      const out = [];
      if (total > 0) {
        const from = Math.max(1, total - limit + 1);
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, flags: true, uid: true })) {
          if (hasFlag(msg.flags, "\\Deleted")) continue; // 削除マーク済みは一般のメールソフト同様に表示しない
          const recipients = [...addrList(msg.envelope?.to), ...addrList(msg.envelope?.cc)].map((r) => r.address);
          if (address && !recipients.includes(address.toLowerCase())) continue;
          const flagged = hasFlag(msg.flags, "\\Flagged");
          if (folder === "flagged" && !flagged) continue;
          out.push({
            uid: msg.uid,
            subject: msg.envelope?.subject || "(件名なし)",
            from: addrText(msg.envelope?.from),
            to: addrText(msg.envelope?.to),
            date: msg.envelope?.date || null,
            seen: hasFlag(msg.flags, "\\Seen"),
            flagged,
          });
        }
      }
      return out.reverse();
    } finally {
      lock.release();
    }
  }, mailbox);
}

// 旗（\Flagged）の付け外し。現在の状態を見て反転させる
export async function toggleFlag(uid, folder = "inbox", mailbox = null) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(String(uid), { flags: true }, { uid: true });
      if (!msg) return;
      if (hasFlag(msg.flags, "\\Flagged")) {
        await client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
      } else {
        await client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
      }
    } finally {
      lock.release();
    }
  }, mailbox);
}

// まとめて削除（削除済みフォルダでは完全削除、それ以外は削除済みへ移動）
export async function bulkDelete(uids, folder = "inbox", mailbox = null) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      if (folder === "trash") {
        for (const uid of uids) await client.messageDelete(String(uid), { uid: true });
      } else {
        const trashPath = await resolveFolder(client, "trash");
        for (const uid of uids) await moveMessage(client, uid, trashPath);
      }
    } finally {
      lock.release();
    }
  }, mailbox);
}

// 削除済みから受信トレイへ戻す（1件でも複数でも）
export async function bulkRestore(uids, mailbox = null) {
  return withClient(async (client) => {
    const path = await resolveFolder(client, "trash");
    const lock = await client.getMailboxLock(path);
    try {
      for (const uid of uids) await moveMessage(client, uid, "INBOX");
    } finally {
      lock.release();
    }
  }, mailbox);
}

export async function getMessage(uid, folder = "inbox", mailbox = null) {
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
        flagged: hasFlag(msg.flags, "\\Flagged"),
      };
    } finally {
      lock.release();
    }
  }, mailbox);
}
