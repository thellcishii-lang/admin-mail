"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// 本文を「文章ブロック」と「画像ブロック」の並びとして視覚的に編集する。
// 保存形式は従来どおりのテキスト（画像は [画像:ID:幅%:配置] マーカー）なので、
// 送信・プレビューの仕組みはそのまま使える。
export function parseBody(body) {
  const blocks = [];
  for (const chunk of String(body || "").split(/\n{2,}/)) {
    const t = chunk.trim();
    if (!t) continue;
    const m = t.match(/^\[画像:(\d+)(?::(\d+))?(?::(left|center|right))?\]$/);
    if (m) {
      blocks.push({ type: "image", id: Number(m[1]), size: Number(m[2]) || 100, align: m[3] || "left" });
    } else {
      blocks.push({ type: "text", text: chunk });
    }
  }
  if (blocks.length === 0) blocks.push({ type: "text", text: "" });
  return blocks;
}

export function serializeBlocks(blocks) {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      return b.size === 100 && b.align === "left" ? `[画像:${b.id}]` : `[画像:${b.id}:${b.size}:${b.align}]`;
    })
    .join("\n\n");
}

const SIZES = [100, 70, 50, 30];
const ALIGNS = [["left", "左"], ["center", "中央"], ["right", "右"]];

const BodyEditor = forwardRef(function BodyEditor({ initialBody = "", images = [], onChange }, ref) {
  const [blocks, setBlocks] = useState(() => parseBody(initialBody));
  const [selected, setSelected] = useState(-1);
  const [menu, setMenu] = useState(null); // {x, y, index}
  const [dragIndex, setDragIndex] = useState(-1);
  const [dragArmed, setDragArmed] = useState(-1);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onChange?.(serializeBlocks(blocks));
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(index, patch) {
    setBlocks((bs) => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }
  function move(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= blocks.length) return;
    setBlocks((bs) => {
      const next = [...bs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setSelected(to);
  }
  function remove(index) {
    setBlocks((bs) => (bs.length <= 1 ? [{ type: "text", text: "" }] : bs.filter((_, i) => i !== index)));
    setSelected(-1);
  }
  function insertImage(id) {
    setBlocks((bs) => {
      const next = [...bs];
      const at = selected >= 0 ? selected + 1 : next.length;
      next.splice(at, 0, { type: "image", id, size: 100, align: "left" });
      return next;
    });
    setShowImagePicker(false);
  }
  useImperativeHandle(ref, () => ({ insertImage }));

  function onDrop(toIndex) {
    if (dragIndex < 0 || dragIndex === toIndex) return;
    setBlocks((bs) => {
      const next = [...bs];
      const [item] = next.splice(dragIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setDragIndex(-1);
    setSelected(toIndex);
  }

  const menuBlock = menu ? blocks[menu.index] : null;

  return (
    <div>
      <div className="rounded border border-slate-300 bg-[#f5f0e8] p-3">
        <div className="mx-auto max-w-[600px] space-y-2">
          {blocks.map((b, i) => (
            <div key={i}
              draggable={dragArmed === i}
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => { setDragIndex(-1); setDragArmed(-1); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onClick={() => setSelected(i)}
              onContextMenu={(e) => { e.preventDefault(); setSelected(i); setMenu({ x: e.clientX, y: e.clientY, index: i }); }}
              className={`rounded bg-white p-2 shadow-sm ${selected === i ? "ring-2 ring-slate-800" : "ring-1 ring-slate-200"} ${dragIndex === i ? "opacity-50" : ""}`}>
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span
                  title="ドラッグで移動"
                  onMouseDown={() => setDragArmed(i)}
                  onMouseUp={() => setDragArmed(-1)}
                  className="cursor-grab select-none px-1 text-base leading-none active:cursor-grabbing">⠿</span>
                <span>{b.type === "image" ? "画像" : "文章"}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => move(i, -1)} className="hover:text-slate-700">↑ 上へ</button>
                  <button type="button" onClick={() => move(i, 1)} className="hover:text-slate-700">↓ 下へ</button>
                  <button type="button" onClick={() => remove(i)} className="hover:text-red-600">削除</button>
                </span>
              </div>
              {b.type === "text" ? (
                <textarea value={b.text} rows={Math.min(10, Math.max(2, b.text.split("\n").length))}
                  onChange={(e) => update(i, { text: e.target.value })}
                  placeholder="文章を入力"
                  className="w-full resize-y rounded border border-slate-200 px-2 py-1.5 text-sm leading-relaxed" />
              ) : (
                <div>
                  <div style={{ textAlign: b.align }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/img/${b.id}`} alt="" style={{ width: `${b.size}%` }} className="inline-block rounded" />
                  </div>
                  {selected === i && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-slate-400">大きさ</span>
                      {SIZES.map((s) => (
                        <button type="button" key={s} onClick={() => update(i, { size: s })}
                          className={`rounded px-2 py-1 ${b.size === s ? "bg-slate-800 text-white" : "border border-slate-300 hover:bg-slate-50"}`}>{s}%</button>
                      ))}
                      <span className="ml-2 text-slate-400">位置</span>
                      {ALIGNS.map(([v, l]) => (
                        <button type="button" key={v} onClick={() => update(i, { align: v })}
                          className={`rounded px-2 py-1 ${b.align === v ? "bg-slate-800 text-white" : "border border-slate-300 hover:bg-slate-50"}`}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mx-auto mt-3 flex max-w-[600px] gap-2">
          <button type="button" onClick={() => { setBlocks((bs) => [...bs, { type: "text", text: "" }]); }}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">＋ 文章を追加</button>
          <button type="button" onClick={() => setShowImagePicker((v) => !v)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">＋ 画像を追加</button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:block">ドラッグ／右クリックで移動・変更できます</span>
        </div>
        {showImagePicker && (
          <div className="mx-auto mt-2 flex max-w-[600px] flex-wrap gap-2">
            {images.length === 0 && <p className="text-xs text-slate-500">先に下の「本文の画像」から画像を登録してください。</p>}
            {images.map((im) => (
              <button type="button" key={im.id} onClick={() => insertImage(im.id)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/img/${im.id}`} alt={im.name || ""} className="h-14 w-24 rounded border border-slate-300 object-cover hover:ring-2 hover:ring-slate-800" />
              </button>
            ))}
          </div>
        )}
      </div>

      {menu && menuBlock && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={() => setMenu(null)} />
          <div className="fixed z-50 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl" style={{ left: menu.x, top: menu.y }}>
            {menuBlock.type === "image" && (
              <>
                <p className="px-3 py-1 text-xs text-slate-400">大きさ</p>
                {SIZES.map((s) => (
                  <button type="button" key={s} onClick={() => { update(menu.index, { size: s }); setMenu(null); }}
                    className="block w-full px-3 py-1 text-left text-sm hover:bg-slate-50">{s}%{menuBlock.size === s ? " ✓" : ""}</button>
                ))}
                <p className="px-3 py-1 text-xs text-slate-400">位置</p>
                {ALIGNS.map(([v, l]) => (
                  <button type="button" key={v} onClick={() => { update(menu.index, { align: v }); setMenu(null); }}
                    className="block w-full px-3 py-1 text-left text-sm hover:bg-slate-50">{l}{menuBlock.align === v ? " ✓" : ""}</button>
                ))}
                <div className="my-1 border-t border-slate-100" />
              </>
            )}
            <button type="button" onClick={() => { move(menu.index, -1); setMenu(null); }} className="block w-full px-3 py-1 text-left text-sm hover:bg-slate-50">上へ移動</button>
            <button type="button" onClick={() => { move(menu.index, 1); setMenu(null); }} className="block w-full px-3 py-1 text-left text-sm hover:bg-slate-50">下へ移動</button>
            <button type="button" onClick={() => { remove(menu.index); setMenu(null); }} className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-red-50">削除</button>
          </div>
        </>
      )}
    </div>
  );
});

export default BodyEditor;
