# ADMINメールから送るメール。様式（MailTemplate）のヘッダーバンドと
# フッターを付け、テキスト版も用意する。
class AdminMailer < ApplicationMailer
  default from: -> { ENV["MAIL_FROM"].presence || ENV["INFOMAIL_USER"].presence || "no-reply@example.com" }

  # attachments: [{ filename:, content: }] の配列（任意）
  def compose(sent_email, attachments: [])
    @sent_email = sent_email
    @template = sent_email.mail_template

    attachments.each do |file|
      self.attachments[file[:filename]] = file[:content]
    end

    from_address = ENV["MAIL_FROM"].presence || ENV["INFOMAIL_USER"].presence || "no-reply@example.com"
    from_name = @template&.from_name.presence || @template&.brand_name
    mail(
      to: sent_email.to_address,
      from: from_name.present? ? email_address_with_name(from_address, from_name) : from_address,
      subject: sent_email.subject
    )
  end
end
