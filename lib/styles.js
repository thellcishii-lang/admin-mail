// 選べる様式スタイル（プリセット）。色とタグラインの組み合わせで会社の印象が変わる。
// 自社製品ファミリーの色（ネイビー/チャコール/ワイン/ブラウン）を中心に、業種で選べる6種。
export const PRESET_STYLES = [
  { id: "navy", name: "ネイビー", mood: "信頼・堅実", header_color: "#0f2740", tagline: "確かな仕事で、地域に貢献する。" },
  { id: "charcoal", name: "チャコール", mood: "モダン・汎用", header_color: "#374151", tagline: "確かな品質を、すべてのお客様へ。" },
  { id: "wine", name: "ワイン", mood: "上質・落ち着き", header_color: "#9f1239", tagline: "丁寧な仕事と、誠実な対応を。" },
  { id: "brown", name: "ブラウン", mood: "職人・温かみ", header_color: "#7c4a1e", tagline: "職人の技と誠実な対応を。" },
  { id: "green", name: "グリーン", mood: "安心・地域密着", header_color: "#1d8a5f", tagline: "安心をお届けするパートナー。" },
  { id: "blue", name: "ブルー", mood: "爽やか・スピード", header_color: "#1f8fd1", tagline: "スピードと丁寧さでお応えします。" },
];

export function styleById(id) {
  return PRESET_STYLES.find((s) => s.id === id) || null;
}
