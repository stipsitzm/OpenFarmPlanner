from io import BytesIO
from tempfile import TemporaryDirectory
from unittest import skipUnless
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from farm.models import Location, Field, Bed, Culture, PlantingPlan, NoteAttachment

try:
    from PIL import Image
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False


@skipUnless(PIL_AVAILABLE, 'Pillow is required for image processing tests')
class NoteAttachmentProcessingApiTest(APITestCase):
    def setUp(self):
        self.location = Location.objects.create(name='Attachment Location')
        self.field = Field.objects.create(name='Attachment Field', location=self.location)
        self.bed = Bed.objects.create(name='Attachment Bed', field=self.field)
        self.culture = Culture.objects.create(name='Attachment Culture', growth_duration_days=7, harvest_duration_days=2)
        self.plan = PlantingPlan.objects.create(culture=self.culture, bed=self.bed, planting_date=date(2024, 3, 1))

    def _image_file(self, width: int, height: int, file_name: str = 'test.jpg') -> SimpleUploadedFile:
        image = Image.new('RGB', (width, height), color=(120, 50, 90))
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        return SimpleUploadedFile(file_name, buffer.getvalue(), content_type='image/jpeg')

    def test_upload_valid_image_resized_and_stored(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                upload = self._image_file(4000, 2000)
                response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': upload},
                    format='multipart',
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                attachment = NoteAttachment.objects.get(pk=response.data['id'])
                self.assertLessEqual(max(attachment.width or 0, attachment.height or 0), 1280)
                self.assertTrue(attachment.image.name.startswith(f'notes/{self.plan.id}/'))

    def test_upload_invalid_file_returns_400(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                not_image = SimpleUploadedFile('bad.txt', b'not-an-image', content_type='text/plain')
                response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': not_image},
                    format='multipart',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_attachment_works(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                upload = self._image_file(1200, 900)
                create_response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': upload},
                    format='multipart',
                )
                attachment_id = create_response.data['id']

                delete_response = self.client.delete(f'/openfarmplanner/api/attachments/{attachment_id}/')
                self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
                self.assertFalse(NoteAttachment.objects.filter(pk=attachment_id).exists())

    def test_upload_with_caption(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                upload = self._image_file(800, 600)
                response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': upload, 'caption': 'Test Caption'},
                    format='multipart',
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                attachment = NoteAttachment.objects.get(pk=response.data['id'])
                self.assertEqual(attachment.caption, 'Test Caption')

    def test_upload_max_size_limit(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                oversized = SimpleUploadedFile('huge.jpg', b'x' * (11 * 1024 * 1024), content_type='image/jpeg')
                response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': oversized},
                    format='multipart',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('exceeds', response.data['detail'].lower())

    def test_upload_stored_format_is_webp_or_jpeg(self):
        """Test that image is stored as WEBP or JPEG (with WEBP fallback)."""
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL='/media/'):
                upload = self._image_file(2000, 1500)
                response = self.client.post(
                    f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
                    {'image': upload},
                    format='multipart',
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                attachment = NoteAttachment.objects.get(pk=response.data['id'])
                # Stored format should be WEBP or JPEG
                self.assertIn(attachment.mime_type, ['image/webp', 'image/jpeg'])
                # Filename should match the format
                if attachment.mime_type == 'image/webp':
                    self.assertTrue(attachment.image.name.endswith('.webp'))
                else:
                    self.assertTrue(attachment.image.name.endswith('.jpg'))

