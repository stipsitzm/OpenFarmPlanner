"""Account lifecycle email delivery (activation, password reset, email change).

Extracted from accounts/views.py so the views only parse requests and map
responses; tests patch ``accounts.emails.send_mail`` to simulate delivery
failures.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import translation
from django.utils.http import urlsafe_base64_encode
from django.utils.translation import gettext as _

from config.frontend_urls import build_public_frontend_url

from .models import AccountEmailChangeRequest

User = get_user_model()


def _uses_local_non_delivery_email_backend() -> bool:
    return settings.EMAIL_BACKEND in {
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend',
        'django.core.mail.backends.dummy.EmailBackend',
    }


def _build_frontend_link(path_with_query: str) -> str:
    return build_public_frontend_url(path_with_query)


def _build_frontend_token_link(path: str, user: User) -> str:
    uid = urlsafe_base64_encode(str(user.pk).encode('utf-8'))
    token = default_token_generator.make_token(user)
    return _build_frontend_link(f'{path}?uid={uid}&token={token}')


def _send_activation_email(user: User) -> None:
    """
    Send multipart activation email with explicit sender metadata.

    Deliverability note: multipart (text + HTML) improves compatibility across clients
    and avoids HTML-only spam signals. We intentionally avoid no-reply senders so
    recipients can contact support via a monitored sender mailbox and mailbox providers
    see a trustworthy identity.
    """
    activation_link = _build_frontend_token_link('/activate', user)
    with translation.override('de'):
        subject = 'OpenFarmPlanner – Registrierung bestätigen'
        text_body = render_to_string('accounts/emails/activation_email.txt', {
            'activation_link': activation_link,
            'contact_email': settings.SUPPORT_CONTACT_EMAIL,
            'project_website': 'https://openfarmplanner.org',
            'project_name': 'OpenFarmPlanner',
            'user': user,
        })
        html_body = render_to_string('accounts/emails/activation_email.html', {
            'activation_link': activation_link,
            'contact_email': settings.SUPPORT_CONTACT_EMAIL,
            'project_website': 'https://openfarmplanner.org',
            'project_name': 'OpenFarmPlanner',
            'user': user,
        })
    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_body,
        fail_silently=False,
    )


def _send_password_reset_email(user: User) -> None:
    reset_link = _build_frontend_token_link('/reset-password', user)
    with translation.override('de'):
        subject = _('Reset your OpenFarmPlanner password')
        body = render_to_string('accounts/emails/password_reset_email.txt', {
            'reset_link': reset_link,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])


def _send_email_change_confirmation_email(user: User, request_obj: AccountEmailChangeRequest) -> None:
    confirmation_link = _build_frontend_link(
        f'/confirm-email-change?uid={urlsafe_base64_encode(str(user.pk).encode("utf-8"))}'
        f'&token={default_token_generator.make_token(user)}'
        f'&request_id={request_obj.id}'
    )
    with translation.override('de'):
        subject = _('Confirm your OpenFarmPlanner email change')
        body = render_to_string('accounts/emails/email_change_confirmation_email.txt', {
            'confirmation_link': confirmation_link,
            'new_email': request_obj.new_email,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [request_obj.new_email])
