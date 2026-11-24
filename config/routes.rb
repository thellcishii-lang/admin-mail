Rails.application.routes.draw do
  root "emails#index"

  resources :emails, only: %i[ index show new create ] do
    collection do
      get :sent
      get :broadcast
      post :send_broadcast
    end
  end
  resources :mail_templates, except: %i[ show ]
  resource :password_change, only: %i[ edit update ]

  resource :session
  resources :passwords, param: :token

  get "up" => "rails/health#show", as: :rails_health_check
end
