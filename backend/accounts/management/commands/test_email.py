from __future__ import annotations

from argparse import ArgumentParser
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    """Send a diagnostic email using the active Django email settings."""

    help = 'Send a diagnostic test email with the current Django email backend settings.'

    def add_arguments(self, parser: ArgumentParser) -> None:
        """
        Register optional command arguments.

        :param parser: Parser used by Django to collect command arguments.
        :return: None.
        """
        parser.add_argument(
            '--to',
            dest='to_email',
            default='',
            help='Recipient address for the test email. Defaults to EMAIL_HOST_USER or DEFAULT_FROM_EMAIL.',
        )

    def handle(self, *args: tuple[str, ...], **options: Any) -> None:
        """
        Send a single test email and print diagnostic output.

        :param args: Positional command arguments.
        :param options: Parsed command options.
        :return: None.
        """
        to_email_option = str(options.get('to_email', '')).strip()
        default_recipient = str(settings.EMAIL_HOST_USER or settings.DEFAULT_FROM_EMAIL or '').strip()
        recipient = to_email_option or default_recipient

        if not recipient:
            raise CommandError('No recipient configured. Provide --to or set EMAIL_HOST_USER/DEFAULT_FROM_EMAIL.')

        subject = 'OpenFarmPlanner SMTP diagnostic test'
        message = (
            'This is a diagnostic email sent by the Django management command test_email.\n\n'
            f'Timestamp (UTC): {timezone.now().isoformat()}\n'
            f'EMAIL_BACKEND: {settings.EMAIL_BACKEND}\n'
            f'EMAIL_HOST: {settings.EMAIL_HOST}\n'
            f'EMAIL_PORT: {settings.EMAIL_PORT}\n'
            f'EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}\n'
        )
        from_email = settings.DEFAULT_FROM_EMAIL

        self.stdout.write('Starting diagnostic email send...')
        self.stdout.write(f'Backend: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'From: {from_email}')
        self.stdout.write(f'To: {recipient}')

        try:
            sent_count = send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[recipient],
                fail_silently=False,
            )
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(self.style.ERROR(f'Email send failed: {exc}'))
            raise CommandError('Diagnostic email failed to send.') from exc

        if sent_count != 1:
            raise CommandError(f'Diagnostic email not sent successfully (sent_count={sent_count}).')

        self.stdout.write(self.style.SUCCESS('Diagnostic email sent successfully.'))
