"""Utilities for validating and processing uploaded note images."""

from __future__ import annotations

from io import BytesIO

from django.core.files.base import ContentFile

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_SIDE = 1280


class ImageProcessingError(ValueError):
    """Raised when uploaded image processing fails."""


def process_note_image(uploaded_file) -> tuple[ContentFile, dict[str, int | str]]:
    """Validate, orient, downscale and re-encode uploaded image."""
    try:
        from PIL import Image, ImageOps
    except ModuleNotFoundError as exc:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'PIL/Pillow not available: {exc}. Install with: pip install Pillow[webp]')
        raise ImageProcessingError('Image processing backend is not available.') from exc

    if uploaded_file.size > MAX_UPLOAD_SIZE_BYTES:
        raise ImageProcessingError('Uploaded file exceeds the 10MB size limit.')

    uploaded_file.seek(0)
    try:
        image = Image.open(uploaded_file)
        image.verify()
    except Exception as exc:
        raise ImageProcessingError('Uploaded file is not a valid image.') from exc

    try:
        uploaded_file.seek(0)
        image = Image.open(uploaded_file)
        image = ImageOps.exif_transpose(image)

        if image.mode not in ('RGB', 'RGBA'):
            image = image.convert('RGB')
        elif image.mode == 'RGBA':
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.getchannel('A'))
            image = background

        image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)

        buffer = BytesIO()
        mime_type = 'image/webp'
        filename = 'processed.webp'
        try:
            image.save(buffer, format='WEBP', quality=82, method=6)
        except Exception as webp_exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f'WEBP encoding not supported: {webp_exc}. Falling back to JPEG.')
            buffer = BytesIO()
            image.save(buffer, format='JPEG', quality=85, optimize=True)
            mime_type = 'image/jpeg'
            filename = 'processed.jpg'

        payload = buffer.getvalue()
        content = ContentFile(payload)

        metadata = {
            'width': image.width,
            'height': image.height,
            'size_bytes': len(payload),
            'mime_type': mime_type,
            'filename': filename,
        }
        return content, metadata
    except ImageProcessingError:
        raise
    except Exception as exc:
        raise ImageProcessingError('Failed to process image.') from exc
