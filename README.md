# ADMINメール（Next.js / Vercel版）

運営者専用のメール送受信アプリ。送信時に製品ごとの「様式（テンプレート）」を選んで送る。

## 構成
- Next.js（App Router）/ Vercel
- DB: Postgres（Neon想定）— テーブルは初回アクセス時に自動作成され、様式9種と運営者ユーザーが自動投入される
- 送信: Zoho SMTP（smtp.zoho.jp:465）/ 受信: Zoho IMAP（imap.zoho.jp:993）

## 環境変数（Vercel）
- `DATABASE_URL` — Neon の接続文字列（Vercel の Storage から Neon を接続すると自動設定）
- `INFOMAIL_USER` / `INFOMAIL_PASS` — Zoho のアカウント（SMTP送信・IMAP受信の既定）
- `IMAP_USER` / `IMAP_PASS` — 受信だけ別アカウントにする場合のみ（任意）
- `MAIL_FROM` — 送信元アドレス（任意、既定は INFOMAIL_USER）
- `OPERATOR_EMAIL` — 初回ログイン用メールアドレス
- `OPERATOR_PASSWORD` — 初回ログイン用パスワード（未設定時は "password"。ログイン後に必ず変更）
- `SESSION_SECRET` — セッション署名用ランダム文字列

## ローカル実行
`DATABASE_URL` を設定して `npm run dev`（http://localhost:3000）。
