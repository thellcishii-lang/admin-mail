import { Pool } from "pg";

let pool;
export function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

const COMPANY = "Everyone's合同会社";
const ADDRESS = "〒357-0123 埼玉県飯能市中藤下郷23-21";
export const SEED_TEMPLATES = [
  { name: "Push-taro（本体）", brand_name: "Push-taro", tagline: "店舗向けプッシュ通知", header_color: "#1e2a3a", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.EVENT", brand_name: "Push-taro.EVENT", tagline: "イベント向けプッシュ通知", header_color: "#7c3aed", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.町おこし", brand_name: "Push-taro.町おこし", tagline: "地域を元気にするプッシュ通知", header_color: "#92400e", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro FES", brand_name: "Push-taro FES", tagline: "フェス・展示会向けプッシュ通知", header_color: "#0f766e", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro 初詣", brand_name: "Push-taro 初詣", tagline: "初詣向けプッシュ通知", header_color: "#b91c1c", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.スタンプラリー", brand_name: "Push-taro.スタンプラリー", tagline: "スタンプラリー", header_color: "#dc2626", footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "代理店管理システム", brand_name: "代理店管理システム", tagline: "代理店管理のSaaS", header_color: "#1e2a3a", footer_email: "admin@agent-partners.space", footer_url: "https://代理店管理システム.com" },
  { name: "見積・請求書システム", brand_name: "見積・請求書システム", tagline: "請求書・見積書のクラウド", header_color: "#1e40af", footer_email: "admin@agent-partners.space", footer_url: "" },
  { name: "標準", brand_name: "Everyone's合同会社", tagline: "", header_color: "#374151", footer_email: "admin@agent-partners.space", footer_url: "" },
];

let ready;
export function ensureReady() {
  if (!ready) ready = setup();
  return ready;
}

async function setup() {
  const p = db();
  await p.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await p.query(`CREATE TABLE IF NOT EXISTS mail_templates (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, brand_name TEXT NOT NULL DEFAULT '',
    tagline TEXT NOT NULL DEFAULT '', header_color TEXT NOT NULL DEFAULT '#1e2a3a',
    from_name TEXT NOT NULL DEFAULT '', footer_company TEXT NOT NULL DEFAULT '',
    footer_address TEXT NOT NULL DEFAULT '', footer_email TEXT NOT NULL DEFAULT '',
    footer_url TEXT NOT NULL DEFAULT '', from_address TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await p.query(`CREATE TABLE IF NOT EXISTS sent_emails (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
    template_id INTEGER REFERENCES mail_templates(id),
    to_address TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
    attachment_names TEXT NOT NULL DEFAULT '', batch_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  await p.query("ALTER TABLE mail_templates ADD COLUMN IF NOT EXISTS from_address TEXT NOT NULL DEFAULT ''");
  const FROM_BY_NAME = {
    "Push-taro（本体）": "info@push-taro.com", "Push-taro.EVENT": "info@push-taro.com",
    "Push-taro.町おこし": "info@push-taro.com", "Push-taro FES": "info@push-taro.com",
    "Push-taro 初詣": "info@push-taro.com", "Push-taro.スタンプラリー": "info@push-taro.com",
    "代理店管理システム": "admin@agent-partners.space", "見積・請求書システム": "admin@agent-partners.space",
    "標準": "info@push-taro.com",
  };
  for (const [name, addr] of Object.entries(FROM_BY_NAME)) {
    await p.query("UPDATE mail_templates SET from_address = $1 WHERE name = $2 AND from_address = ''", [addr, name]);
  }

  const { rows } = await p.query("SELECT COUNT(*)::int AS c FROM mail_templates");
  if (rows[0].c === 0) {
    for (const [i, t] of SEED_TEMPLATES.entries()) {
      await p.query(
        `INSERT INTO mail_templates (name, brand_name, tagline, header_color, from_name, footer_company, footer_address, footer_email, footer_url, position, from_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [t.name, t.brand_name, t.tagline, t.header_color, t.brand_name, COMPANY, ADDRESS, t.footer_email, t.footer_url, i + 1, FROM_BY_NAME[t.name] || t.footer_email]
      );
    }
  }

  const u = await p.query("SELECT COUNT(*)::int AS c FROM users");
  if (u.rows[0].c === 0) {
    const bcrypt = (await import("bcryptjs")).default;
    const email = process.env.OPERATOR_EMAIL || "admin@example.co.jp";
    const password = process.env.OPERATOR_PASSWORD || "password";
    await p.query("INSERT INTO users (email, password_hash) VALUES ($1,$2)", [email, await bcrypt.hash(password, 10)]);
  }
}
