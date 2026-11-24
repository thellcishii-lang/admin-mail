# ADMINメール: 共用メールボックスの受信トレイと、様式を選んでの送信。
class EmailsController < ApplicationController
  MAX_BROADCAST_RECIPIENTS = 100

  def index
    @messages = MailboxClient.inbox
  rescue MailboxClient::NotConfiguredError
    @not_configured = true
  rescue MailboxClient::ConnectionError => e
    @error = e.message
  end

  def show
    @message = MailboxClient.message(params[:id])
  rescue MailboxClient::NotConfiguredError, MailboxClient::ConnectionError => e
    redirect_to emails_path, alert: e.message
  end

  def new
    @email = SentEmail.new(
      mail_template_id: params[:mail_template_id] || MailTemplate.order(:position).first&.id,
      to_address: params[:to],
      subject: params[:subject],
      body: params[:body]
    )
    @templates = MailTemplate.order(:position, :id)
  end

  def create
    @email = build_email(email_params)
    @email.subject = apply_reply_prefix(@email.subject) if params[:reply_mode] == "1"

    return render_new_with_errors unless @email.save

    AdminMailer.compose(@email, attachments: read_attachments).deliver_now
    redirect_to sent_emails_path, notice: "メールを送信しました。"
  rescue StandardError => e
    @email.destroy if @email&.persisted?
    flash.now[:alert] = "送信に失敗しました：#{e.message}"
    render_new_with_errors(status: :unprocessable_entity)
  end

  def broadcast
    @email = SentEmail.new(mail_template_id: MailTemplate.order(:position).first&.id)
    @templates = MailTemplate.order(:position, :id)
  end

  def send_broadcast
    recipients = parse_recipients(params[:recipients])
    @email = build_email(email_params)
    @templates = MailTemplate.order(:position, :id)

    if recipients.empty?
      flash.now[:alert] = "宛先を入力してください。"
      return render :broadcast, status: :unprocessable_entity
    end
    if recipients.size > MAX_BROADCAST_RECIPIENTS
      flash.now[:alert] = "一斉送信は一度に#{MAX_BROADCAST_RECIPIENTS}件までです。"
      return render :broadcast, status: :unprocessable_entity
    end

    batch_id = SecureRandom.uuid
    files = read_attachments
    sent_count = 0
    recipients.each_with_index do |address, index|
      copy = SentEmail.new(@email.attributes.except("id", "created_at", "updated_at"))
      copy.to_address = address
      copy.batch_id = batch_id
      copy.attachment_names = @email.attachment_names
      if index.zero? && !copy.valid?
        @email = copy
        return render :broadcast, status: :unprocessable_entity
      end
      copy.save!
      AdminMailer.compose(copy, attachments: files).deliver_now
      sent_count += 1
    end
    redirect_to sent_emails_path, notice: "#{sent_count}件に一斉送信しました。"
  rescue StandardError => e
    flash.now[:alert] = "送信に失敗しました：#{e.message}"
    render :broadcast, status: :unprocessable_entity
  end

  def sent
    @emails = SentEmail.includes(:mail_template, :user).order(id: :desc).limit(200)
  end

  private
    def email_params
      params.expect(sent_email: %i[ mail_template_id to_address subject body ])
    end

    def build_email(permitted)
      email = SentEmail.new(permitted)
      email.user = Current.user
      email.attachment_names = attachment_names
      email
    end

    def uploaded_files
      Array(params[:attachments]).select { |file| file.respond_to?(:original_filename) }
    end

    def attachment_names
      uploaded_files.map(&:original_filename).join("\n")
    end

    def read_attachments
      uploaded_files.map { |file| { filename: file.original_filename, content: file.read } }
    end

    def apply_reply_prefix(subject)
      text = subject.to_s
      text.match?(/\A\s*Re:/i) ? text : "Re: #{text}"
    end

    def parse_recipients(text)
      text.to_s.split(/[\n,;]/).map(&:strip).reject(&:blank?).uniq
    end

    def render_new_with_errors(status: :unprocessable_entity)
      @templates = MailTemplate.order(:position, :id)
      render :new, status: status
    end
end
