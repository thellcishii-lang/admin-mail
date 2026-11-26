import nodemailer from "nodemailer";
import { smtpConfigFor } from "./mailboxes";

export function smtpConfigured(mailbox) {
  return Boolean(smtpConfigFor(mailbox));
}
export function mailFrom() {
  return process.env.MAIL_FROM || process.env.INFOMAIL_USER;
}
function transport(mailbox) {
  const config = smtpConfigFor(mailbox);
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

export function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ロゴの公開URL（メールから参照される）。様式にロゴがあれば /logo/<id> で配信する。
export function logoUrlFor(template) {
  if (!template?.logo_base64) return null;
  const base = process.env.APP_BASE_URL || "https://admin-mail-green.vercel.app";
  return `${base}/logo/${template.id}`;
}

export function brandedHtml(template, body, imageMap = {}, watermarks = [], footerImageUrl = null) {
  // フォーム送信で \r\n に化けることがあるので、段落分割の前に \n へそろえる
  const paragraphs = String(body || "").replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((raw) => {
      const trimmed = raw.trim();
      const only = trimmed.match(/^\[画像:(\d+)(?::(\d+))?(?::(left|center|right))?\]$/);
      if (only && imageMap[only[1]]) {
        const w = [30, 50, 70, 100].includes(Number(only[2])) ? Number(only[2]) : 100;
        const align = only[3] || "left";
        if (w === 100) {
          return `<div style="margin:0 0 1em;"><img src="${imageMap[only[1]]}" alt="" style="width:100%; max-width:600px; height:auto; display:block;"></div>`;
        }
        return `<div style="margin:0 0 1em; text-align:${align};"><img src="${imageMap[only[1]]}" alt="" style="width:${w}%; height:auto; display:inline-block;"></div>`;
      }
      const html = esc(raw)
        .replace(/\[画像:(\d+)[^\]]*\]/g, (m, id) =>
          imageMap[id] ? `<img src="${imageMap[id]}" alt="" style="max-width:100%; height:auto;">` : "")
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 1em;">${html}</p>`;
    })
    .join("");
  const logo = logoUrlFor(template);
  const logoSize = [28, 36, 48, 64, 84].includes(Number(template?.logo_size)) ? Number(template.logo_size) : 36;
  const headerPad = [12, 20, 32, 44].includes(Number(template?.header_padding)) ? Number(template.header_padding) : 20;
  const brandSpan = `<span style="color:#ffffff; font-size:20px; font-weight:bold; vertical-align:middle;">${esc(template?.brand_name || "")}</span>`;
  const taglineSpan = template?.tagline
    ? `<span style="color:#f59e0b; font-size:13px; font-weight:bold;">${esc(template.tagline)}</span>`
    : "";
  let headerInner = "";
  if (logo && template.logo_header && template.logo_layout === "center") {
    headerInner = `<div style="text-align:center;">
        <img src="${logo}" alt="" height="${logoSize}" style="height:${logoSize}px;">
        <div style="margin-top:8px;">${brandSpan}</div>
        ${taglineSpan ? `<div style="margin-top:2px;">${taglineSpan}</div>` : ""}
      </div>`;
  } else if (logo && template.logo_header && template.logo_layout === "logo_only") {
    headerInner = `<div style="text-align:center;">
        <img src="${logo}" alt="${esc(template.brand_name || "")}" height="${logoSize}" style="height:${logoSize}px;">
        ${taglineSpan ? `<div style="margin-top:6px;">${taglineSpan}</div>` : ""}
      </div>`;
  } else {
    const headerLogo = logo && template.logo_header
      ? `<img src="${logo}" alt="" height="${logoSize}" style="height:${logoSize}px; vertical-align:middle; margin-right:12px;">`
      : "";
    headerInner = `${headerLogo}${brandSpan}${taglineSpan ? `<span style="margin-left:10px;">${taglineSpan}</span>` : ""}`;
  }
  const header = template
    ? `<tr><td style="background-color:${template.header_color}; padding:${headerPad}px 28px;">${headerInner}</td></tr>`
    : "";
  // フッター: 色（今まで通り/ヘッダーと同じ/別の色）・会社名とロゴの置き方・高さ・画像
  const footerPad = [12, 20, 32, 44].includes(Number(template?.footer_padding)) ? Number(template.footer_padding) : 20;
  const footerLayout = ["left", "center", "logo_only", "name_only"].includes(template?.footer_layout) ? template.footer_layout : "left";
  const bandColor = template?.footer_style === "header"
    ? template.header_color
    : template?.footer_style === "custom" ? (template.footer_color || "#334155") : null;
  const infoLines = (color) => `
         ${template.footer_company ? `運営会社：${esc(template.footer_company)}<br>` : ""}
         ${template.footer_address ? `${esc(template.footer_address)}<br>` : ""}
         ${template.footer_email ? `${esc(template.footer_email)}<br>` : ""}
         ${template.footer_url ? `<a href="${esc(template.footer_url)}" style="color:${color};">${esc(template.footer_url)}</a>` : ""}`;
  let footerInner = "";
  if (template) {
    const showLogo = Boolean(logo && template.logo_footer && footerLayout !== "name_only");
    const showName = footerLayout !== "logo_only";
    const nameHtml = showName
      ? (bandColor || footerLayout !== "left"
        ? `<span style="font-weight:bold; font-size:13px;">${esc(template.brand_name)}</span><br>`
        : `${esc(template.brand_name)}<br>`)
      : "";
    if (footerLayout === "center" || footerLayout === "logo_only") {
      const fLogoSize = footerLayout === "logo_only" ? Math.max(logoSize, 48) : 40;
      footerInner = `<div style="text-align:center;">
          ${showLogo ? `<div style="margin-bottom:10px;"><img src="${logo}" alt="" height="${fLogoSize}" style="height:${fLogoSize}px;"></div>` : ""}
          ${nameHtml}${infoLines(bandColor ? "#ffffff" : "#666666")}
        </div>`;
    } else {
      footerInner = `${showLogo ? `<div style="margin-bottom:10px;"><img src="${logo}" alt="" height="40" style="height:40px;"></div>` : ""}${nameHtml}${infoLines(bandColor ? "#ffffff" : "#666666")}`;
    }
  }
  const footerImgRow = template && footerImageUrl
    ? `<tr><td style="padding:0; line-height:0;"><img src="${footerImageUrl}" alt="" style="width:100%; max-width:600px; height:auto; display:block;"></td></tr>`
    : "";
  const footer = template
    ? (bandColor
      ? `<tr><td style="padding:${footerPad}px 28px; background-color:${bandColor}; color:#ffffff; font-size:12px; line-height:1.7;">${footerInner}</td></tr>`
      : `<tr><td style="padding:${footerPad}px 28px; border-top:1px solid #e5e0d5; color:#666666; font-size:12px; line-height:1.7;">${footerInner}</td></tr>`)
    : "";
  // 背景の透かし: 本文セルの背景に画像を置く（複数可・位置/大きさ/薄さは送信前に解決済み。
  // 対応するメールソフトでのみ表示される）
  const wm = Array.isArray(watermarks) ? watermarks : [];
  const bgAttr = wm.length > 0
    ? ` background="${wm[0].url}" style="padding:28px; color:#333333; font-size:14px; line-height:1.8; background-image:${wm.map((w) => `url('${w.url}')`).join(", ")}; background-position:${wm.map((w) => w.position).join(", ")}; background-size:${wm.map((w) => `${w.size}%`).join(", ")}; background-repeat:no-repeat;"`
    : ` style="padding:28px; color:#333333; font-size:14px; line-height:1.8;"`;
  return `<!DOCTYPE html><html><body style="margin:0; padding:24px 0; background-color:#f5f0e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
      ${header}
      <tr><td${bgAttr}>${paragraphs}</td></tr>
      ${footerImgRow}
      ${footer}
    </table>
  </td></tr></table></body></html>`;
}

export async function sendMail({ template, to, subject, body, attachments, mailbox }) {
  const fromName = template?.from_name || template?.brand_name || "";
  const fromAddress = template?.from_address || mailbox?.address || mailFrom();
  const { resolveBodyImages, stripImageMarkers, resolveWatermarks, resolveFooterImage } = await import("./images");
  const accountId = template?.account_id || mailbox?.account_id;
  const imageMap = await resolveBodyImages(accountId, body);
  const watermarks = await resolveWatermarks(template, accountId);
  const footerImageUrl = await resolveFooterImage(template, accountId);
  const info = await transport(mailbox).sendMail({
    from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
    to,
    subject,
    text: stripImageMarkers(body),
    html: brandedHtml(template, body, imageMap, watermarks, footerImageUrl),
    attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content })),
  });
  return info;
}
