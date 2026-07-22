from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from crops.models import CropSpecies
from farm.models import PublicCulture

User = get_user_model()


class CropViewSetTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='crops-user', email='crops@example.com', password='testpass', is_active=True,
        )
        self.published = PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED,
            version=1, created_by=self.user,
        )
        self.draft = PublicCulture.objects.create(
            name='Carrot', variety='Nantes', status='draft', version=1, created_by=self.user,
        )

    def test_requires_authentication(self):
        response = self.client.get('/openfarmplanner/api/crops/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lists_only_published_crops(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertIn('Lettuce', names)
        self.assertNotIn('Carrot', names)

    def test_filters_by_free_text_query(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/', {'q': 'lett'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Lettuce')

    def test_retrieves_a_single_published_crop(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/openfarmplanner/api/crops/{self.published.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Lettuce')
        self.assertEqual(response.data['variety'], 'Bijella')
        # Provenance fields are project-scoped and must not leak into the
        # crop-library-facing serializer.
        self.assertNotIn('source_project', response.data)
        self.assertNotIn('source_project_culture', response.data)

    def test_retrieving_an_unpublished_crop_404s(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/openfarmplanner/api/crops/{self.draft.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_match_finds_an_exact_normalized_match(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/match/', {'name': 'lettuce', 'variety': 'bijella'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['exists'])
        self.assertEqual(response.data['crop']['id'], self.published.id)

    def test_match_reports_no_match(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/match/', {'name': 'Kohlrabi', 'variety': 'Superschmelz'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['exists'])
        self.assertIsNone(response.data['crop'])

    def test_write_methods_are_not_allowed(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/openfarmplanner/api/crops/', {'name': 'X', 'variety': 'Y'})

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_lists_official_crop_species(self):
        CropSpecies.objects.create(name='Tomato')
        CropSpecies.objects.create(name='Draft species', status=CropSpecies.STATUS_PROPOSED)
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/openfarmplanner/api/crop-species/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertEqual(names, ['Tomato'])

    def test_species_create_stores_a_proposal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/openfarmplanner/api/crop-species/', {'name': 'Tree onion'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], CropSpecies.STATUS_PROPOSED)
