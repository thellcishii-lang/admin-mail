"use client";

import { useRef, useState } from "react";

// 画像のドラッグ＆ドロップ／クリック選択エリア（ロゴ・フッター画像で共用）。
// 実体の <input type="file"> は隠して持ち、落としたファイルをそのままフォーム送信に乗せる。
export default function ImageDropInput({ name, label = "画像", chosenNote = "この画像を使います（「更新」を押すと反映）" }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");

  const takeFile = (file) => {
    if (!file) return;
    setFileName(file.name || "");
    if (file.type && file.type.startsWith("image/")) {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    } else {
      setPreview("");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !inputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    inputRef.current.files = dt.files;
    takeFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}を選択`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`mt-2 flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${dragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50 hover:border-slate-400"}`}
    >
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="選択した画像" className="h-12 border border-slate-200 bg-white object-contain px-2" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-400">IMAGE</span>
      )}
      <span className="text-sm text-slate-600">
        {fileName ? (
          <><span className="font-medium text-slate-800">{fileName}</span><br /><span className="text-xs text-slate-400">{chosenNote}</span></>
        ) : (
          <>ここに{label}をドラッグ＆ドロップ<br /><span className="text-xs text-slate-400">またはクリックしてファイルを選択</span></>
        )}
      </span>
    </div>
  );
}
