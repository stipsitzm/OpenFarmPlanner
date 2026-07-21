from django.core.management.base import BaseCommand

from farm.services.hint_test_project import (
    HINT_TEST_MEMBER_EMAIL,
    HINT_TEST_MEMBER_PASSWORD,
    HINT_TEST_MEMBER_USERNAME,
    HINT_TEST_PASSWORD,
    HINT_TEST_PROJECT_NAME,
    HINT_TEST_PROJECT_SLUG,
    HINT_TEST_USER_EMAIL,
    HINT_TEST_USERNAME,
    create_or_reset_hint_test_project,
)


class Command(BaseCommand):
    help = 'Create or reset the reproducible hint and edge-case test project.'

    def add_arguments(self, parser):
        parser.add_argument('--user-email', default=HINT_TEST_USER_EMAIL)
        parser.add_argument('--username', default=HINT_TEST_USERNAME)
        parser.add_argument('--password', default=HINT_TEST_PASSWORD)
        parser.add_argument('--member-email', default=HINT_TEST_MEMBER_EMAIL)
        parser.add_argument('--member-username', default=HINT_TEST_MEMBER_USERNAME)
        parser.add_argument('--member-password', default=HINT_TEST_MEMBER_PASSWORD)
        parser.add_argument('--project-name', default=HINT_TEST_PROJECT_NAME)
        parser.add_argument('--project-slug', default=HINT_TEST_PROJECT_SLUG)

    def handle(self, *args, **options):
        result = create_or_reset_hint_test_project(
            user_email=options['user_email'],
            username=options['username'],
            password=options['password'],
            member_email=options['member_email'],
            member_username=options['member_username'],
            member_password=options['member_password'],
            project_name=options['project_name'],
            project_slug=options['project_slug'],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'Hint test project ready: {result.project.name} '
                f'(slug={result.project.slug}, user={result.user.email}, '
                f'member={result.member_user.email})'
            )
        )
