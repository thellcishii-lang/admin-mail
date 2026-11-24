# ADMINメールから送信したメールの控え。
class SentEmail < ApplicationRecord
  belongs_to :mail_template, optional: true
  belongs_to :user, optional: true

  validates :to_address, presence: true
  validates :subject, presence: true
  validates :body, presence: true

  def attachment_name_list
    (attachment_names || "").split("\n").reject(&:blank?)
  end
end
