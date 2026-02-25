from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from farm.models import Culture, MediaFile, CultureRevision


class CultureHistoryTests(TestCase):
    def setUp(self):
        self.culture = Culture.objects.create(name='Carrot', variety='Nantes', growth_duration_days=60, harvest_duration_days=20)

    def test_history_list_endpoint(self):
        self.culture.name = 'Carrot Updated'
        self.culture.save()

        response = self.client.get(f'/openfarmplanner/api/cultures/{self.culture.id}/history/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()), 2)

    def test_restore_endpoint(self):
        original_revision = self.culture.revisions.first()
        self.culture.name = 'Changed'
        self.culture.save()

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/restore/',
            data={'history_id': original_revision.id},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.culture.refresh_from_db()
        self.assertEqual(self.culture.name, 'Carrot')

    def test_cleanup_history_command(self):
        old = self.culture.revisions.first()
        old.created_at = timezone.now() - timedelta(days=40)
        old.save(update_fields=['created_at'])

        call_command('cleanup_history')
        self.assertFalse(CultureRevision.objects.filter(id=old.id).exists())


class MediaCleanupTests(TestCase):
    def test_cleanup_orphaned_media_command(self):
        media = MediaFile.objects.create(storage_path='culture-media/test.jpg', orphaned_at=timezone.now() - timedelta(days=40))
        call_command('cleanup_orphaned_media')
        self.assertFalse(MediaFile.objects.filter(id=media.id).exists())
