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



    def test_soft_delete_and_undelete(self):
        delete_response = self.client.delete(f'/openfarmplanner/api/cultures/{self.culture.id}/')
        self.assertEqual(delete_response.status_code, 204)

        list_response = self.client.get('/openfarmplanner/api/cultures/')
        ids = [item['id'] for item in list_response.json()['results']]
        self.assertNotIn(self.culture.id, ids)

        undelete_response = self.client.post(f'/openfarmplanner/api/cultures/{self.culture.id}/undelete/')
        self.assertEqual(undelete_response.status_code, 200)
        self.culture.refresh_from_db()
        self.assertIsNone(self.culture.deleted_at)

    def test_global_history_lists_entries(self):
        self.culture.name = 'Global History Test'
        self.culture.save()

        response = self.client.get('/openfarmplanner/api/history/global/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()), 1)

    def test_global_history_restore_undeletes_culture(self):
        delete_response = self.client.delete(f'/openfarmplanner/api/cultures/{self.culture.id}/')
        self.assertEqual(delete_response.status_code, 204)

        revision = self.culture.revisions.first()
        restore_response = self.client.post(
            '/openfarmplanner/api/history/global/restore/',
            data={'history_id': revision.id},
            content_type='application/json',
        )
        self.assertEqual(restore_response.status_code, 200)
        self.culture.refresh_from_db()
        self.assertIsNone(self.culture.deleted_at)



    def test_project_history_snapshot_created_on_mutation(self):
        self.client.put(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            data={
                'name': 'Snapshot Trigger',
                'variety': self.culture.variety,
                'growth_duration_days': self.culture.growth_duration_days,
                'harvest_duration_days': self.culture.harvest_duration_days,
            },
            content_type='application/json',
        )

        response = self.client.get('/openfarmplanner/api/history/project/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()), 1)

    def test_project_restore_restores_previous_project_state(self):
        self.client.put(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            data={
                'name': 'Carrot',
                'variety': self.culture.variety,
                'growth_duration_days': self.culture.growth_duration_days,
                'harvest_duration_days': self.culture.harvest_duration_days,
            },
            content_type='application/json',
        )
        before = self.client.get('/openfarmplanner/api/history/project/')
        first_revision_id = before.json()[0]['history_id']

        self.client.put(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            data={
                'name': 'Changed Name',
                'variety': self.culture.variety,
                'growth_duration_days': self.culture.growth_duration_days,
                'harvest_duration_days': self.culture.harvest_duration_days,
            },
            content_type='application/json',
        )

        restore_response = self.client.post(
            '/openfarmplanner/api/history/project/restore/',
            data={'history_id': first_revision_id},
            content_type='application/json',
        )
        self.assertEqual(restore_response.status_code, 200)
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
