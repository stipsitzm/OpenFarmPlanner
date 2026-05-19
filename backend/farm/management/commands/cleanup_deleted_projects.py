from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from farm.models import Project


class Command(BaseCommand):
    help = 'Permanently delete projects that have been in the trash for more than 30 days.'

    def handle(self, *args: object, **options: object) -> None:
        cutoff = timezone.now() - timedelta(days=30)
        queryset = Project.objects.filter(deleted_at__lt=cutoff)
        project_count = queryset.count()
        queryset.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {project_count} trashed projects.'))
