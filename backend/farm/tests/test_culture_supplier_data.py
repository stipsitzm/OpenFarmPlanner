from django.contrib.auth import get_user_model
from decimal import Decimal
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
            packaging_sizes=[{'size_value': 5, 'size_unit': 'g'}, {'size_value': 25, 'size_unit': 'g'}],
        )

        response = self.client.get(f'/openfarmplanner/api/cultures/{self.culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('supplier_data', response.data)
        self.assertEqual(len(response.data['supplier_data']), 1)
        self.assertEqual(response.data['supplier_data'][0]['supplier_product_name'], 'Nantaise fein')
        self.assertEqual(
            response.data['supplier_data'][0]['packaging_sizes'],
            [{'size_value': 5, 'size_unit': 'g'}, {'size_value': 25, 'size_unit': 'g'}],
        )

    def test_supplier_tkg_accepts_decimal_values_and_comma_inputs(self):
        payloads = [
            4,
            3.9,
            '3,9',
            3.85,
        ]

        for index, tkg_value in enumerate(payloads):
            payload = {
                'culture': self.culture.id,
                'supplier_id': self.supplier.id,
                'supplier_product_name': f'Nantaise fein {index}',
                'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                'thousand_kernel_weight_g': tkg_value,
            }
            if index == 0:
                response = self.client.post('/openfarmplanner/api/culture-supplier-data/', payload, format='json')
            else:
                existing = CultureSupplierData.objects.get(culture=self.culture, supplier=self.supplier)
                response = self.client.patch(f'/openfarmplanner/api/culture-supplier-data/{existing.id}/', payload, format='json')

            self.assertEqual(response.status_code, status.HTTP_200_OK if index > 0 else status.HTTP_201_CREATED)
            expected_decimal = Decimal(str(tkg_value).replace(',', '.'))
            self.assertEqual(Decimal(str(response.data['thousand_kernel_weight_g'])), expected_decimal)

        stored = CultureSupplierData.objects.get(culture=self.culture, supplier=self.supplier)
        self.assertEqual(stored.thousand_kernel_weight_g, Decimal('3.85'))

    def test_supplier_tkg_accepts_empty_value_when_optional(self):
        payload = {
            'culture': self.culture.id,
            'supplier_id': self.supplier.id,
            'supplier_product_name': 'Nantaise fein',
            'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
            'thousand_kernel_weight_g': '',
        }

        response = self.client.post('/openfarmplanner/api/culture-supplier-data/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['thousand_kernel_weight_g'])

    def test_supplier_tkg_rejects_non_numeric_values(self):
        payload = {
            'culture': self.culture.id,
            'supplier_id': self.supplier.id,
            'supplier_product_name': 'Nantaise fein',
            'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
            'thousand_kernel_weight_g': 'abc',
        }

        response = self.client.post('/openfarmplanner/api/culture-supplier-data/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['thousand_kernel_weight_g'][0],
            'Please enter a valid numeric value, e.g. 3.9.',
        )
