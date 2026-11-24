class CreateMailTemplatesAndSentEmails < ActiveRecord::Migration[8.1]
  def change
    create_table :mail_templates do |t|
      t.string :name, null: false
      t.string :brand_name, null: false
      t.string :tagline
      t.string :header_color, null: false, default: "#1e2a3a"
      t.string :from_name
      t.string :footer_company
      t.string :footer_address
      t.string :footer_email
      t.string :footer_url
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    create_table :sent_emails do |t|
      t.references :mail_template, foreign_key: true
      t.references :user, foreign_key: true
      t.string :to_address, null: false
      t.string :subject, null: false
      t.text :body, null: false
      t.text :attachment_names
      t.string :batch_id
      t.timestamps
    end
    add_index :sent_emails, :batch_id
  end
end
