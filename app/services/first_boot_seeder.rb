# 初回起動時に seed を投入する（db:prepare は seed を実行しないため）。
# ユーザーが既にいれば何もしない。
class FirstBootSeeder
  def self.call
    new.call
  end

  def call
    return false if User.exists?

    Rails.application.load_seed
    true
  end
end
