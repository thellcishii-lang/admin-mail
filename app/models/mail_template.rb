# 送信メールの様式（製品ごとのヘッダーバンドとフッター）。
class MailTemplate < ApplicationRecord
  has_many :sent_emails, dependent: :nullify

  validates :name, presence: true
  validates :brand_name, presence: true
  validates :header_color, format: { with: /\A#[0-9a-fA-F]{6}\z/, message: "は #RRGGBB 形式で入力してください" }
end
