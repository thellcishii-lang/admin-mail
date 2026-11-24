# 運営者（単一ユーザー）と、製品ごとの様式（テンプレート）の初期データ。
# 本番では初回起動時に FirstBootSeeder から読み込まれる。

operator_email = ENV["OPERATOR_EMAIL"].presence || "admin@example.co.jp"
User.find_or_create_by!(email_address: operator_email) do |user|
  user.password = "password"
end

company = "Everyone's合同会社"
address = "〒357-0123 埼玉県飯能市中藤下郷23-21"

templates = [
  { name: "Push-taro（本体）", brand_name: "Push-taro", tagline: "店舗向けプッシュ通知", header_color: "#1e2a3a",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.EVENT", brand_name: "Push-taro.EVENT", tagline: "イベント向けプッシュ通知", header_color: "#7c3aed",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.町おこし", brand_name: "Push-taro.町おこし", tagline: "地域を元気にするプッシュ通知", header_color: "#92400e",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro FES", brand_name: "Push-taro FES", tagline: "フェス・展示会向けプッシュ通知", header_color: "#0f766e",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro 初詣", brand_name: "Push-taro 初詣", tagline: "初詣向けプッシュ通知", header_color: "#b91c1c",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "Push-taro.スタンプラリー", brand_name: "Push-taro.スタンプラリー", tagline: "スタンプラリー", header_color: "#dc2626",
    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com" },
  { name: "代理店管理システム", brand_name: "代理店管理システム", tagline: "代理店管理のSaaS", header_color: "#1e2a3a",
    footer_email: "admin@agent-partners.space", footer_url: "https://代理店管理システム.com" },
  { name: "請求書システム", brand_name: "請求書システム", tagline: "請求書・見積書のクラウド", header_color: "#1e40af",
    footer_email: "admin@agent-partners.space", footer_url: "" },
  { name: "標準", brand_name: "Everyone's合同会社", tagline: "", header_color: "#374151",
    footer_email: "admin@agent-partners.space", footer_url: "" }
]

templates.each_with_index do |attrs, i|
  MailTemplate.find_or_create_by!(name: attrs[:name]) do |template|
    template.assign_attributes(attrs.merge(
      from_name: attrs[:brand_name], footer_company: company, footer_address: address, position: i + 1
    ))
  end
end
