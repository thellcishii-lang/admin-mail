# ログイン中のパスワード変更（運営者本人のみ）。
class PasswordChangesController < ApplicationController
  def edit
  end

  def update
    user = Current.user
    unless user.authenticate(params[:current_password].to_s)
      flash.now[:alert] = "現在のパスワードが違います。"
      return render :edit, status: :unprocessable_entity
    end

    if params[:password].to_s.length < 8
      flash.now[:alert] = "新しいパスワードは8文字以上にしてください。"
      return render :edit, status: :unprocessable_entity
    end

    user.update!(password: params[:password])
    redirect_to emails_path, notice: "パスワードを変更しました。"
  end
end
