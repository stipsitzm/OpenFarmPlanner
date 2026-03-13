from django.urls import path

from .views import (
    ActivateView,
    CsrfTokenView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResendActivationView,
)

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='auth-csrf'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('activate/', ActivateView.as_view(), name='auth-activate'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('resend-activation/', ResendActivationView.as_view(), name='auth-resend-activation'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
]
