"""API tests for the public culture library endpoints."""


from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from accounts.models import DocumentConsent
from farm.models import (
    Culture,
    Project,
    ProjectMembership,
    PublicCulture,
    SeedPackage,
)
from farm.tests.api_base import User


class PublicCultureLibraryApiTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='library-user', email='library@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Library Project', slug='library-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        self.culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            growth_duration_days=50,
            harvest_duration_days=20,
            notes='Project-local notes',
            project=self.project,
        )
        SeedPackage.objects.create(culture=self.culture, project=self.project, size_value='25.0', size_unit='g')

    def publish_current_culture(self):
        return self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/',
            {'accepted_public_library_terms': True},
            format='json',
        )

    def test_publish_project_culture_creates_separate_public_culture(self):
        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'created')
        self.assertEqual(PublicCulture.objects.count(), 1)
        public_culture = PublicCulture.objects.get()
        self.assertEqual(public_culture.name, self.culture.name)
        self.assertEqual(public_culture.variety, self.culture.variety)
        self.assertEqual(public_culture.source_project_culture, self.culture)
        self.assertEqual(public_culture.seed_packages[0]['size_value'], 25.0)
        self.assertEqual(response.data['duplicates'], [])
        self.assertTrue(
            DocumentConsent.objects.filter(
                user=self.user,
                document=DocumentConsent.DOCUMENT_PUBLIC_LIBRARY,
            ).exists()
        )

    def test_publish_requires_public_library_contribution_terms(self):
        response = self.client.post(f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'public_library_terms_required')
        self.assertEqual(PublicCulture.objects.count(), 0)

    def test_guest_demo_session_cannot_publish_to_public_library(self):
        """Throwaway guest-demo accounts must not contribute to the shared library."""
        from datetime import timedelta

        from django.utils import timezone

        from accounts.models import GuestDemoSession

        GuestDemoSession.objects.create(
            user=self.user,
            project=self.project,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'guest_demo_forbidden')
        self.assertEqual(PublicCulture.objects.count(), 0)

    def test_publish_rejects_duplicates_with_conflict_response(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
            supplier_name='Reinsaat',
        )
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save(update_fields=['seed_supplier', 'name_normalized', 'variety_normalized', 'updated_at'])

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        self.assertEqual(response.data['detail'], 'A similar public culture already exists.')
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(response.data['duplicates'][0]['name'], 'Lettuce')
        self.assertEqual(response.data['normalized_identity']['name'], 'lettuce')
        self.assertEqual(response.data['normalized_identity']['variety'], 'bijella')
        self.assertEqual(response.data['normalized_identity']['seed_supplier'], 'reinsaat')
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_second_publish_updates_own_linked_public_culture_and_increments_version(self):
        first_publish = self.publish_current_culture()
        self.assertEqual(first_publish.status_code, status.HTTP_201_CREATED)
        public_culture_id = first_publish.data['public_culture']['id']

        self.culture.notes = 'Updated local notes'
        self.culture.save()

        second_publish = self.publish_current_culture()

        self.assertEqual(second_publish.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_publish.data['operation'], 'updated')
        self.assertEqual(second_publish.data['public_culture']['id'], public_culture_id)
        self.assertEqual(PublicCulture.objects.count(), 1)

        updated_public = PublicCulture.objects.get(id=public_culture_id)
        self.assertEqual(updated_public.version, 2)
        self.assertEqual(updated_public.notes, 'Updated local notes')

    def test_publish_updates_own_imported_public_culture(self):
        own_public = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            created_by=self.user,
            source_project=self.project,
            version=3,
        )
        self.culture.source_public_culture = own_public
        self.culture.name = 'Carrot'
        self.culture.variety = 'Mokum'
        self.culture.notes = 'Refined owner notes'
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'updated')
        self.assertEqual(response.data['public_culture']['id'], own_public.id)

        own_public.refresh_from_db()
        self.assertEqual(own_public.version, 4)
        self.assertEqual(own_public.notes, 'Refined owner notes')

    def test_publish_does_not_update_foreign_source_public_culture(self):
        other_user = User.objects.create_user(username='other-owner', email='other@example.com', password='testpass', is_active=True)
        foreign_public = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=other_user,
            source_project=self.project,
            source_project_culture=self.culture,
            version=5,
            supplier_name='Reinsaat',
        )
        self.culture.source_public_culture = foreign_public
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        foreign_public.refresh_from_db()
        self.assertEqual(foreign_public.version, 5)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_rejects_duplicates_using_normalized_fields(self):
        PublicCulture.objects.create(
            name=' Lettuce ',
            variety='BIJELLA',
            status='published',
            created_by=self.user,
            source_project=self.project,
            supplier_name='  Rein   Saat  ',
        )
        self.culture.name = '  lettuce'
        self.culture.variety = 'bijella  '
        self.culture.seed_supplier = 'rein saat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_allows_new_public_culture_for_different_normalized_identity(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
            supplier_name='Reinsaat',
        )
        self.culture.variety = 'Other Variety'
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PublicCulture.objects.count(), 2)

    def test_import_public_culture_creates_project_local_copy(self):
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status='published',
            created_by=self.user,
            seed_supplier='Reinsaat',
            growth_duration_days=70,
            harvest_duration_days=30,
            notes='Public notes',
            seed_packages=[{'size_value': 15.0, 'size_unit': 'g'}],
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        imported = Culture.objects.get(id=response.data['id'])
        self.assertEqual(imported.project, self.project)
        self.assertEqual(imported.source_public_culture, public_culture)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertFalse(imported.is_modified_from_source)
        self.assertEqual(imported.seed_packages.count(), 1)
        self.assertEqual(float(imported.seed_packages.first().size_value), 15.0)

    def test_editing_imported_culture_does_not_change_public_culture(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            created_by=self.user,
            growth_duration_days=90,
            harvest_duration_days=14,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['growth_duration_days'] = 120
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(
            f'/openfarmplanner/api/cultures/{imported_id}/',
            payload,
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(public_culture.growth_duration_days, 90)
        self.assertEqual(imported.growth_duration_days, 120)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_normalizes_long_origin_type_without_db_error(self):
        public_culture = PublicCulture.objects.create(
            name='Pepper',
            variety='Red Flame',
            status='published',
            created_by=self.user,
            growth_duration_days=85,
            harvest_duration_days=20,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Changed locally'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['origin_type'] = 'imported_from_public_library_template'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_with_supplier_name_and_null_supplier_id_keeps_supplier_null(self):
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            seed_supplier='Reinsaat',
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Local edit'
        payload['supplier_id'] = None
        payload['supplier_name'] = 'Reinsaat'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertIsNone(imported.supplier_id)
        self.assertEqual(imported.seed_supplier, 'Reinsaat')

    def test_public_library_list_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/openfarmplanner/api/public-cultures/')
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_public_library_list_returns_matching_results(self):
        PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        PublicCulture.objects.create(name='Bean', variety='Neckargold', status='published', created_by=self.user)

        response = self.client.get('/openfarmplanner/api/public-cultures/?q=Roma')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Tomato')

    def test_import_requires_project_membership_header(self):
        public_culture = PublicCulture.objects.create(name='Kale', variety='Nero', status='published', created_by=self.user)
        del self.client.defaults['HTTP_X_PROJECT_ID']

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
