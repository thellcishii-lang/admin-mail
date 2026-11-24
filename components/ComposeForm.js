"use client";

import { useRef, useState } from "react";
import { sendOneAction, broadcastAction } from "@/lib/actions";

export default function ComposeForm({ templates, defaults = {}, broadcast = false, error = null }) {
  const [templateId, setTemplateId] = useState(defaults.templateId || templates[0]?.id || "");
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

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
        <textarea name="body" required rows={12} defaultValue={defaults.body || ""} className={inputCls} />
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
