from django.urls import path

from .views import CsrfTokenView, DeleteAccountView, LoginView, LogoutView, MeView, RegisterView

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='auth-csrf'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('account/', DeleteAccountView.as_view(), name='auth-delete-account'),
    path('me/', MeView.as_view(), name='auth-me'),
]
