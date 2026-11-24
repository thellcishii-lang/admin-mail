class MailTemplatesController < ApplicationController
  before_action :set_mail_template, only: %i[ edit update destroy ]

  def index
    @mail_templates = MailTemplate.order(:position, :id)
  end

  def new
    @mail_template = MailTemplate.new(header_color: "#1e2a3a")
  end

  def create
    @mail_template = MailTemplate.new(mail_template_params)

    if @mail_template.save
      redirect_to mail_templates_path, notice: "様式を作成しました。"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @mail_template.update(mail_template_params)
      redirect_to mail_templates_path, notice: "様式を更新しました。"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @mail_template.destroy!
    redirect_to mail_templates_path, notice: "様式を削除しました。"
  end

  private
    def set_mail_template
      @mail_template = MailTemplate.find(params[:id])
    end

    def mail_template_params
      params.expect(mail_template: %i[ name brand_name tagline header_color from_name
                                       footer_company footer_address footer_email footer_url position ])
    end
end
