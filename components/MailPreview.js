"use client";

import { useState } from "react";

// メールプレビューのモーダル（iframeでメールHTMLをそのまま表示）
export function PreviewModal({ html, onClose }) {
  if (!html) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-[680px] rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">プレビュー（実際に送られる見た目）</p>
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">閉じる</button>
        </div>
        <iframe title="メールプレビュー" srcDoc={html} className="h-[70vh] w-full rounded border border-slate-200" />
        <p className="mt-2 text-xs text-slate-400">透かしなどの背景は、受信側のメールソフトによっては表示されないことがあります。</p>
      </div>
    </div>
  );
}

export async function fetchPreviewHtml(templateId, body) {
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId, body }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.html) throw new Error(data?.error || "プレビューを作れませんでした");
  return data.html;
}

// 様式ページ用ボタン（サンプル本文でプレビュー）
export function TemplatePreviewButton({ templateId, sampleImageId }) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const sample = "いつもお世話になっております。\n\nこれはプレビュー用のサンプル文章です。ヘッダー・透かし・フッターの見た目を確認できます。"
        + (sampleImageId ? `\n\n[画像:${sampleImageId}]` : "")
        + "\n\nよろしくお願いいたします。";
      setHtml(await fetchPreviewHtml(templateId, sample));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={open} disabled={busy}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
        {busy ? "作成中…" : "プレビュー"}
      </button>
      <PreviewModal html={html} onClose={() => setHtml("")} />
    </>
  );
}
