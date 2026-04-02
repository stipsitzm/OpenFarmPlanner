from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from farm.models import Culture, CultureSupplierData, Project, ProjectMembership, Supplier


User = get_user_model()


class CultureSupplierDataApiTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='supplierdata', email='supplierdata@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Supplier Data Project', slug='supplier-data-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)

        self.supplier = Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        self.culture = Culture.objects.create(name='Karotte', variety='Nantaise', project=self.project)

    def test_create_supplier_data_record(self):
        payload = {
            'culture': self.culture.id,
            'supplier_id': self.supplier.id,
            'supplier_product_name': 'Nantaise fein',
            'supplier_product_url': 'https://reinsaat.example/karotte',
            'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
            'thousand_kernel_weight_g': 0.9,
        }

        response = self.client.post('/openfarmplanner/api/culture-supplier-data/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CultureSupplierData.objects.count(), 1)
        row = CultureSupplierData.objects.get()
        self.assertEqual(row.culture_id, self.culture.id)
        self.assertEqual(row.supplier_id, self.supplier.id)

    def test_culture_detail_includes_supplier_data(self):
        CultureSupplierData.objects.create(
            culture=self.culture,
            project=self.project,
            supplier=self.supplier,
            supplier_name='Reinsaat',
            supplier_product_name='Nantaise fein',
        )

        response = self.client.get(f'/openfarmplanner/api/cultures/{self.culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('supplier_data', response.data)
        self.assertEqual(len(response.data['supplier_data']), 1)
        self.assertEqual(response.data['supplier_data'][0]['supplier_product_name'], 'Nantaise fein')
