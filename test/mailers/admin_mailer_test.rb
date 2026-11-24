require "test_helper"

class AdminMailerTest < ActionMailer::TestCase
  test "compose applies the template branding and footer" do
    template = MailTemplate.create!(name: "Push-taro（本体）", brand_name: "Push-taro",
                                    tagline: "店舗向けプッシュ通知", header_color: "#1e2a3a",
                                    from_name: "Push-taro", footer_company: "Everyone's合同会社",
                                    footer_address: "〒357-0123 埼玉県飯能市中藤下郷23-21",
                                    footer_email: "info@push-taro.com", footer_url: "https://push-taro.com")
    sent = SentEmail.create!(mail_template: template, to_address: "guest@example.com",
                             subject: "件名です", body: "本文です")

    mail = AdminMailer.compose(sent)

    assert_equal [ "guest@example.com" ], mail.to
    assert_equal "件名です", mail.subject
    html = mail.html_part.body.decoded
    assert_includes html, "#1e2a3a"
    assert_includes html, "Push-taro"
    assert_includes html, "info@push-taro.com"
    text = mail.text_part.body.decoded
    assert_includes text, "本文です"
    assert_includes text, "Everyone's合同会社"
  end

  test "compose attaches files" do
    sent = SentEmail.create!(to_address: "guest@example.com", subject: "添付", body: "見てね")
    mail = AdminMailer.compose(sent, attachments: [ { filename: "price.pdf", content: "PDFDATA" } ])
    assert_equal 1, mail.attachments.size
    assert_equal "price.pdf", mail.attachments.first.filename
  end
end
