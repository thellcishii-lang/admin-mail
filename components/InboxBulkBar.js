"use client";

import { useEffect, useRef, useState } from "react";

// 一覧のまとめて操作バー：全て選択・選択件数の表示（削除/戻すボタンはフォーム送信）
export default function InboxBulkBar({ folder }) {
  const ref = useRef(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setCount(form.querySelectorAll('input[name="uids"]:checked').length);
    form.addEventListener("change", update);
    update();
    return () => form.removeEventListener("change", update);
  }, []);

  function toggleAll(e) {
    const form = ref.current?.closest("form");
    if (!form) return;
    form.querySelectorAll('input[name="uids"]').forEach((c) => { c.checked = e.target.checked; });
    setCount(e.target.checked ? form.querySelectorAll('input[name="uids"]').length : 0);
  }

  const btn = "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40";
  return (
    <div ref={ref} className="mt-4 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" onChange={toggleAll} className="h-4 w-4" /> 全て選択
      </label>
      <span className="text-sm text-slate-400">{count}件選択中</span>
      {folder === "trash" && (
        <button type="submit" name="op" value="bulk_restore" disabled={count === 0} className={btn}>選択したメールを受信トレイに戻す</button>
      )}
      <button type="submit" name="op" value="bulk_delete" disabled={count === 0}
        className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
        {folder === "trash" ? "選択したメールを完全に削除" : "選択したメールを削除"}
      </button>
    </div>
  );
}
