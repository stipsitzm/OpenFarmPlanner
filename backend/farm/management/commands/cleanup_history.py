from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from farm.models import CultureRevision


class Command(BaseCommand):
    help = 'Delete culture history entries older than 30 days.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        deleted, _ = CultureRevision.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} historical records.'))
