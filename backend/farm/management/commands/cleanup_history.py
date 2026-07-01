from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from farm.models import CultureRevision, ProjectRevision


class Command(BaseCommand):
    help = 'Delete culture and project history entries older than 30 days.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        deleted_culture, _ = CultureRevision.objects.filter(created_at__lt=cutoff).delete()
        deleted_project, _ = ProjectRevision.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f'Deleted {deleted_culture} culture and {deleted_project} project historical records.'
            )
        )
