require "net/imap"

# 運営の共用メールボックス（IMAP）を読むための境界。
# 接続情報は環境変数（IMAP_HOST / IMAP_PORT / IMAP_USER / IMAP_PASS、
# 未設定なら INFOMAIL_USER / INFOMAIL_PASS）から読む。
# テストでは define_singleton_method で差し替える。
class MailboxClient
  class NotConfiguredError < StandardError; end
  class ConnectionError < StandardError; end

  class << self
    def configured?
      username.present? && password.present?
    end

    def inbox(limit: 50)
      with_imap do |imap|
        imap.select("INBOX")
        uids = imap.uid_search([ "ALL" ]).last(limit).reverse
        return [] if uids.empty?

        imap.uid_fetch(uids, %w[UID ENVELOPE FLAGS]).map do |data|
          envelope = data.attr["ENVELOPE"]
          {
            uid: data.attr["UID"],
            subject: envelope&.subject || "（件名なし）",
            from: format_address(envelope&.from&.first),
            date: envelope&.date ? Time.parse(envelope.date) : nil,
            seen: data.attr["FLAGS"].include?(:Seen)
          }
        end
      end
    rescue NotConfiguredError
      raise
    rescue StandardError => e
      raise ConnectionError, "メールサーバーに接続できませんでした（#{e.class}）"
    end

    def message(uid)
      with_imap do |imap|
        imap.select("INBOX")
        data = imap.uid_fetch(uid.to_i, "BODY[]").first
        raise ConnectionError, "メールが見つかりませんでした" unless data

        imap.uid_store(uid.to_i, "+FLAGS", [ :Seen ])
        mail = Mail.new(data.attr["BODY[]"])
        {
          uid: uid.to_i,
          subject: mail.subject || "（件名なし）",
          from: mail.from&.first || "",
          from_display: mail[:from]&.formatted&.first || mail.from&.first || "",
          to: Array(mail.to).join(", "),
          date: mail.date,
          body: extract_text(mail)
        }
      end
    rescue NotConfiguredError
      raise
    rescue ConnectionError
      raise
    rescue StandardError => e
      raise ConnectionError, "メールサーバーに接続できませんでした（#{e.class}）"
    end

    private
      def host
        ENV["IMAP_HOST"].presence || "imap.zoho.jp"
      end

      def port
        (ENV["IMAP_PORT"].presence || 993).to_i
      end

      def username
        ENV["IMAP_USER"].presence || ENV["INFOMAIL_USER"]
      end

      def password
        ENV["IMAP_PASS"].presence || ENV["INFOMAIL_PASS"]
      end

      def with_imap
        raise NotConfiguredError, "IMAPの接続情報（環境変数）が未設定です" unless configured?

        imap = Net::IMAP.new(host, port: port, ssl: port != 143)
        begin
          imap.login(username, password)
          yield imap
        ensure
          imap.disconnect rescue nil
        end
      end

      def format_address(address)
        return "" unless address

        name = address.name
        mailbox = [ address.mailbox, address.host ].compact.join("@")
        name.present? ? "#{name} <#{mailbox}>" : mailbox
      end

      def extract_text(mail)
        if mail.multipart?
          text_part = mail.text_part
          return text_part.decoded if text_part

          html_part = mail.html_part
          return strip_html(html_part.decoded) if html_part

          ""
        elsif mail.content_type&.include?("text/html")
          strip_html(mail.decoded)
        else
          mail.decoded
        end
      rescue StandardError
        mail.decoded.to_s
      end

      def strip_html(html)
        html.gsub(/<br\s*\/?>/i, "\n").gsub(/<[^>]+>/, "").gsub(/&nbsp;/, " ").strip
      end
  end
end
