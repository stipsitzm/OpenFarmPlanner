from __future__ import annotations

from django.core.management.base import BaseCommand, CommandParser

from farm.services.demo_project import (
    DEMO_PASSWORD,
    DEMO_PROJECT_NAME,
    DEMO_PROJECT_SLUG,
    DEMO_USER_EMAIL,
    DEMO_USERNAME,
    create_or_reset_demo_project,
)


class Command(BaseCommand):
    help = 'Create or reset the local OpenFarmPlanner demo project used for screenshots.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('--project-name', default=DEMO_PROJECT_NAME)
        parser.add_argument('--project-slug', default=DEMO_PROJECT_SLUG)
        parser.add_argument('--user-email', default=DEMO_USER_EMAIL)
        parser.add_argument('--username', default=DEMO_USERNAME)
        parser.add_argument('--password', default=DEMO_PASSWORD)

    def handle(self, *args: object, **options: object) -> None:
        result = create_or_reset_demo_project(
            project_name=str(options['project_name']),
            project_slug=str(options['project_slug']),
            user_email=str(options['user_email']),
            username=str(options['username']),
            password=str(options['password']),
        )
        project_state = 'created' if result.created_project else 'reset'
        user_state = 'created' if result.created_user else 'updated'
        self.stdout.write(self.style.SUCCESS(
            f'Demo project {project_state}: {result.project.name} ({result.project.slug}); '
            f'demo user {user_state}: {result.user.email}'
        ))
