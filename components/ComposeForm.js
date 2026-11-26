"use client";

import { useRef, useState } from "react";
import { sendOneAction, broadcastAction } from "@/lib/actions";

export default function ComposeForm({ templates, defaults = {}, broadcast = false, error = null, initialImages = [] }) {
  const [templateId, setTemplateId] = useState(defaults.templateId || templates[0]?.id || "");
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const bodyRef = useRef(null);
  const imageInputRef = useRef(null);
  const [images, setImages] = useState(initialImages);
  const [imageError, setImageError] = useState("");

  function insertMarker(id) {
    const ta = bodyRef.current;
    const marker = `[画像:${id}]`;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    ta.value = before + prefix + marker + "\n" + ta.value.slice(end);
    ta.focus();
    const pos = (before + prefix + marker).length;
    ta.setSelectionRange(pos, pos);
  }

  async function uploadImages(fileList) {
    setImageError("");
    let last = null;
    for (const file of fileList) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/images", { method: "POST", body: fd });
      last = await res.json().catch(() => null);
      if (!res.ok) {
        setImageError(last?.error || "画像の登録に失敗しました");
        break;
      }
    }
    if (last?.images) setImages(last.images);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function deleteImage(id) {
    const res = await fetch(`/api/images?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (data?.images) setImages(data.images);
  }

  function addFiles(list) {
    const input = fileRef.current;
    const dt = new DataTransfer();
    [...(input.files || []), ...list].forEach((f) => dt.items.add(f));
    input.files = dt.files;
    setFiles([...dt.files].map((f) => f.name));
  }

  const inputCls = "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm";
  return (
    <form action={broadcast ? broadcastAction : sendOneAction} className="mt-4 space-y-5 rounded-xl bg-white p-6 shadow">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <p className="text-sm font-medium">どの製品の様式で送るか</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {templates.map((t) => (
            <button type="button" key={t.id} onClick={() => setTemplateId(t.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${String(templateId) === String(t.id) ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 hover:bg-slate-50"}`}>
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: t.header_color }} />
              {t.name}
            </button>
          ))}
        </div>
        <input type="hidden" name="template_id" value={templateId} />
      </div>

      {broadcast ? (
        <div>
          <label className="text-sm font-medium">宛先（1行に1件、カンマ区切りも可・最大100件）</label>
          <textarea name="recipients" required rows={6} className={inputCls} placeholder={"a@example.com\nb@example.com"} />
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium">宛先</label>
          <input name="to" type="email" required defaultValue={defaults.to || ""} className={inputCls} />
        </div>
      )}

      <div>
        <label className="text-sm font-medium">件名</label>
        <input name="subject" required defaultValue={defaults.subject || ""} className={inputCls} />
        {!broadcast && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="reply" value="1" defaultChecked={defaults.reply === "1"} className="h-4 w-4" />
            返信として送る（件名に Re: を付ける）
          </label>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">本文</label>
        <textarea ref={bodyRef} name="body" required rows={12} defaultValue={defaults.body || ""} className={inputCls} />
      </div>

      <div>
        <p className="text-sm font-medium">本文の画像（デザイン用）</p>
        <p className="mt-1 text-xs text-slate-500">画像を登録して「挿入」を押すと、本文のカーソル位置に差し込まれます。バナーや区切り画像を何枚でも組み合わせられます（1枚1MBまで・30枚まで）。</p>
        {imageError && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{imageError}</p>}
        <div className="mt-2 flex flex-wrap gap-3">
          {images.map((im) => (
            <div key={im.id} className="w-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/img/${im.id}`} alt={im.name || ""} className="h-16 w-28 rounded border border-slate-200 object-cover" />
              <div className="mt-1 flex gap-1">
                <button type="button" onClick={() => insertMarker(im.id)} className="flex-1 rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700">挿入</button>
                <button type="button" onClick={() => deleteImage(im.id)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">削除</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => imageInputRef.current?.click()}
            className="flex h-16 w-28 items-center justify-center rounded border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:bg-slate-50">
            ＋ 画像を追加
          </button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) uploadImages([...e.target.files]); }} />
      </div>

      {!broadcast && (
        <div>
          <p className="text-sm font-medium">添付ファイル</p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="mt-1 cursor-pointer rounded border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 hover:bg-slate-50">
            ここにファイルをドラッグ＆ドロップ（クリックで選択）
            {files.length > 0 && <span className="mt-2 block text-slate-700">{files.join(", ")}</span>}
          </div>
          <input ref={fileRef} type="file" name="attachments" multiple className="hidden" onChange={(e) => setFiles([...e.target.files].map((f) => f.name))} />
        </div>
      )}

      <button className="rounded bg-slate-800 px-6 py-2 font-medium text-white hover:bg-slate-700">{broadcast ? "一斉送信する" : "送信する"}</button>
    </form>
  );
}
