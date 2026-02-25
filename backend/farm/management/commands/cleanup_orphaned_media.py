from datetime import timedelta

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.utils import timezone

from farm.models import MediaFile


class Command(BaseCommand):
    help = 'Delete orphaned media files older than 30 days from storage and database.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        queryset = MediaFile.objects.filter(orphaned_at__isnull=False, orphaned_at__lt=cutoff)
        deleted = 0
        for media in queryset:
            if media.storage_path and default_storage.exists(media.storage_path):
                default_storage.delete(media.storage_path)
            media.delete()
            deleted += 1
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} orphaned media files.'))
