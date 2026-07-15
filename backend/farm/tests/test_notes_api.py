"""API tests for media uploads and note attachments."""

from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from farm.models import (
    Bed,
    Culture,
    Field,
    Location,
    PlantingPlan,
    Project,
    ProjectMembership,
)
from farm.tests.api_base import ProjectApiTestCase, User


class MediaUploadApiTest(ProjectApiTestCase):
    def test_media_upload_rejects_non_image_file(self):
        upload = SimpleUploadedFile('payload.txt', b'not-an-image', content_type='text/plain')
        response = self.client.post(
            '/openfarmplanner/api/media-files/upload/',
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('file', response.data)


class NoteAttachmentApiTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='attachapiuser', email='attachapi@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Attachment API Project', slug='attachment-api-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        self.location = Location.objects.create(name="Attachment Location", project=self.project)
        self.field = Field.objects.create(name="Attachment Field", location=self.location, project=self.project)
        self.bed = Bed.objects.create(name="Attachment Bed", field=self.field, project=self.project)
        self.culture = Culture.objects.create(
            name="Attachment Culture",
            growth_duration_days=7,
            harvest_duration_days=2,
            project=self.project,
        )
        self.plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            project=self.project,
        )

    @patch('farm.notes.views.process_note_image')
    def test_upload_list_delete_attachment(self, mock_process):
        mock_process.return_value = (
            SimpleUploadedFile('processed.webp', b'processed', content_type='image/webp'),
            {
                'width': 1280,
                'height': 720,
                'size_bytes': 9,
                'mime_type': 'image/webp',
            },
        )
        upload = SimpleUploadedFile('raw.jpg', b'raw', content_type='image/jpeg')

        upload_response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(upload_response.status_code, status.HTTP_201_CREATED)
        self.assertLessEqual(upload_response.data['width'], 1280)

        list_response = self.client.get(f'/openfarmplanner/api/notes/{self.plan.id}/attachments/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        attachment_id = upload_response.data['id']
        delete_response = self.client.delete(f'/openfarmplanner/api/attachments/{attachment_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)


    @patch(
        'farm.notes.views.process_note_image',
        side_effect=__import__('farm.image_processing', fromlist=['ImageProcessingBackendUnavailableError']).ImageProcessingBackendUnavailableError('Image processing backend is not available. Install Pillow in the backend environment.'),
    )
    def test_attachment_upload_returns_503_when_processing_backend_missing(self, _mock_process):
        upload = SimpleUploadedFile('raw.jpg', b'raw', content_type='image/jpeg')
        response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch(
        'farm.notes.views.process_note_image',
        side_effect=__import__('farm.image_processing', fromlist=['ImageProcessingError']).ImageProcessingError('bad image'),
    )
    def test_invalid_attachment_upload_returns_400(self, _mock_process):
        upload = SimpleUploadedFile('not-image.txt', b'text', content_type='text/plain')
        response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_attachments_for_other_project_is_forbidden(self):
        other_user = User.objects.create_user(username='attachother', email='attachother@example.com', password='testpass', is_active=True)
        other_project = Project.objects.create(name='Other Attachment Project', slug='other-attachment-project')
        ProjectMembership.objects.create(user=other_user, project=other_project, role='admin')

        self.client.force_authenticate(user=other_user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(other_project.id)

        response = self.client.get(f'/openfarmplanner/api/notes/{self.plan.id}/attachments/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

