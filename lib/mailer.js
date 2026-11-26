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

export function brandedHtml(template, body) {
  const paragraphs = String(body || "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const logo = logoUrlFor(template);
  const headerLogo = logo && template.logo_header
    ? `<img src="${logo}" alt="" height="36" style="height:36px; vertical-align:middle; margin-right:12px;">`
    : "";
  const header = template
    ? `<tr><td style="background-color:${template.header_color}; padding:20px 28px;">
         ${headerLogo}<span style="color:#ffffff; font-size:20px; font-weight:bold; vertical-align:middle;">${esc(template.brand_name)}</span>
         ${template.tagline ? `<span style="color:#f59e0b; font-size:13px; font-weight:bold; margin-left:10px;">${esc(template.tagline)}</span>` : ""}
       </td></tr>`
    : "";
  const footerLogo = logo && template.logo_footer
    ? `<div style="margin-bottom:10px;"><img src="${logo}" alt="" height="40" style="height:40px;"></div>`
    : "";
  const footer = template
    ? `<tr><td style="padding:20px 28px; border-top:1px solid #e5e0d5; color:#666666; font-size:12px; line-height:1.7;">
         ${footerLogo}${esc(template.brand_name)}<br>
         ${template.footer_company ? `運営会社：${esc(template.footer_company)}<br>` : ""}
         ${template.footer_address ? `${esc(template.footer_address)}<br>` : ""}
         ${template.footer_email ? `${esc(template.footer_email)}<br>` : ""}
         ${template.footer_url ? `<a href="${esc(template.footer_url)}" style="color:#666666;">${esc(template.footer_url)}</a>` : ""}
       </td></tr>`
    : "";
  // 背景の透かし: 本文セルの背景にロゴを大きく薄く置く（対応するメールソフトでのみ表示される）
  const bgAttr = logo && template.logo_background
    ? ` background="${logo}" style="padding:28px; color:#333333; font-size:14px; line-height:1.8; background-repeat:no-repeat; background-position:center; background-size:55%;"`
    : ` style="padding:28px; color:#333333; font-size:14px; line-height:1.8;"`;
  return `<!DOCTYPE html><html><body style="margin:0; padding:24px 0; background-color:#f5f0e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
      ${header}
      <tr><td${bgAttr}>${paragraphs}</td></tr>
      ${footer}
    </table>
  </td></tr></table></body></html>`;
}

export async function sendMail({ template, to, subject, body, attachments, mailbox }) {
  const fromName = template?.from_name || template?.brand_name || "";
  const fromAddress = template?.from_address || mailbox?.address || mailFrom();
  const info = await transport(mailbox).sendMail({
    from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
    to,
    subject,
    text: body,
    html: brandedHtml(template, body),
    attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content })),
  });
  return info;
}
