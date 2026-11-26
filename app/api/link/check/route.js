import { ensureReady } from "@/lib/db";
import { accountByLinkKey, bearerKey } from "@/lib/link";

// 連動の疎通確認（見積側の「接続テスト」用）。メールは送らず、キー認証だけを行う。
export async function GET(request) {
  await ensureReady();
  const account = await accountByLinkKey(bearerKey(request));
  if (!account) return Response.json({ ok: false, error: "連動キーが正しくありません" }, { status: 401 });
  return Response.json({ ok: true, account: account.name });
}
