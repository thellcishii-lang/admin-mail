require "test_helper"

class EmailsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email_address: "operator@example.co.jp", password: "password")
    @template = MailTemplate.create!(name: "Push-taro（本体）", brand_name: "Push-taro",
                                     tagline: "店舗向けプッシュ通知", header_color: "#1e2a3a",
                                     footer_company: "Everyone's合同会社", footer_email: "info@push-taro.com")
    sign_in_as(@user)
    ActionMailer::Base.deliveries.clear
  end

  test "inbox lists messages from the mailbox" do
    with_stubbed_inbox([ { uid: 42, subject: "問い合わせです", from: "客 <guest@example.com>", date: Time.zone.now, seen: false } ]) do
      get emails_path
    end
    assert_response :success
    assert_includes response.body, "問い合わせです"
  end

  test "inbox shows guidance when the mailbox is not configured" do
    original = MailboxClient.method(:inbox)
    MailboxClient.define_singleton_method(:inbox) { |limit: 50| raise MailboxClient::NotConfiguredError }
    get emails_path
    assert_response :success
    assert_includes response.body, "未設定です"
  ensure
    MailboxClient.define_singleton_method(:inbox) { |limit: 50| original.call(limit: limit) }
  end

  test "individual send delivers with the template and records it" do
    assert_difference "SentEmail.count", 1 do
      assert_difference -> { ActionMailer::Base.deliveries.size }, 1 do
        post emails_path, params: { sent_email: {
          mail_template_id: @template.id, to_address: "guest@example.com",
          subject: "ご連絡", body: "本文です" } }
      end
    end
    assert_redirected_to sent_emails_path

    sent = SentEmail.last
    assert_equal @template, sent.mail_template
    mail = ActionMailer::Base.deliveries.last
    assert_equal [ "guest@example.com" ], mail.to
    assert_includes mail.html_part.body.decoded, "Push-taro"
    assert_includes mail.text_part.body.decoded, "本文です"
  end

  test "reply mode prefixes the subject with Re:" do
    post emails_path, params: { reply_mode: "1", sent_email: {
      mail_template_id: @template.id, to_address: "guest@example.com",
      subject: "質問です", body: "回答です" } }
    assert_equal "Re: 質問です", SentEmail.last.subject
  end

  test "broadcast sends one mail per recipient under a shared batch" do
    assert_difference "SentEmail.count", 3 do
      assert_difference -> { ActionMailer::Base.deliveries.size }, 3 do
        post send_broadcast_emails_path, params: {
          recipients: "a@example.com\nb@example.com, c@example.com",
          sent_email: { mail_template_id: @template.id, subject: "お知らせ", body: "一斉本文" } }
      end
    end
    assert_equal 1, SentEmail.last(3).map(&:batch_id).uniq.size
  end

  test "sent page lists sent mails" do
    SentEmail.create!(mail_template: @template, user: @user, to_address: "x@example.com",
                      subject: "履歴の件名", body: "履歴本文")
    get sent_emails_path
    assert_response :success
    assert_includes response.body, "履歴の件名"
  end

  private
    def with_stubbed_inbox(messages)
      original = MailboxClient.method(:inbox)
      MailboxClient.define_singleton_method(:inbox) { |limit: 50| messages }
      yield
    ensure
      MailboxClient.define_singleton_method(:inbox) { |limit: 50| original.call(limit: limit) }
    end
end
