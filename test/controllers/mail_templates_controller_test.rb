require "test_helper"

class MailTemplatesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email_address: "operator@example.co.jp", password: "password")
    sign_in_as(@user)
  end

  test "create, update and destroy a template" do
    assert_difference "MailTemplate.count", 1 do
      post mail_templates_path, params: { mail_template: {
        name: "新製品", brand_name: "新製品", header_color: "#123456" } }
    end
    template = MailTemplate.last
    assert_redirected_to mail_templates_path

    patch mail_template_path(template), params: { mail_template: { name: "改名" } }
    assert_equal "改名", template.reload.name

    assert_difference "MailTemplate.count", -1 do
      delete mail_template_path(template)
    end
  end

  test "invalid header color is rejected" do
    assert_no_difference "MailTemplate.count" do
      post mail_templates_path, params: { mail_template: {
        name: "x", brand_name: "y", header_color: "red" } }
    end
    assert_response :unprocessable_entity
  end
end
