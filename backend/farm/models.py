import json
import hashlib
import re
import secrets
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from .seed_units import (
    SEED_PACKAGE_UNIT_GRAMS,
    SEED_PACKAGE_UNIT_SEEDS,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
    SEED_RATE_UNITS,
)


def note_attachment_upload_path(instance: 'NoteAttachment', filename: str) -> str:
    """Build a deterministic storage path for note attachments."""
    extension = (filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin')
    return f"notes/{instance.planting_plan_id}/{uuid.uuid4().hex}.{extension}"




def culture_media_upload_path(instance: 'MediaFile', filename: str) -> str:
    """Build unique storage path for culture files."""
    extension = (filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin')
    return f"culture-media/{timezone.now().strftime('%Y/%m')}/{uuid.uuid4().hex}.{extension}"


class MediaFile(models.Model):
    """Stored media metadata used as file references in domain models."""

    storage_path = models.CharField(max_length=500, unique=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    orphaned_at = models.DateTimeField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ['-uploaded_at']

class TimestampedModel(models.Model):
    """Abstract base model with created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Project(TimestampedModel):
    """A collaborative workspace that owns farm planning data."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        """Return project name for admin and debug output."""
        return self.name


class ProjectMembership(models.Model):
    """Membership relation between a user and a project."""

    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'
    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_MEMBER, 'Member'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_memberships')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'project'], name='unique_project_membership'),
        ]

    @property
    def is_admin(self) -> bool:
        """Return True if membership role grants admin permissions."""
        return self.role == self.ROLE_ADMIN


class ProjectInvitation(models.Model):
    """An invitation token for adding users to projects."""

    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REVOKED = 'revoked'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_REVOKED, 'Revoked'),
    ]

    ROLE_ADMIN = ProjectMembership.ROLE_ADMIN
    ROLE_MEMBER = ProjectMembership.ROLE_MEMBER
    ROLE_CHOICES = ProjectMembership.ROLE_CHOICES

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    email_normalized = models.EmailField(blank=True, default='')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    token = models.CharField(max_length=128, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_invitations_sent',
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_invitations_accepted',
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_invitations_revoked',
    )
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'email_normalized'],
                condition=Q(status='pending'),
                name='unique_open_project_invitation_per_email',
            ),
        ]

    @staticmethod
    def normalize_email(email: str) -> str:
        """Normalize an invitation email for canonical comparisons.

        :param email: Raw email value from input.
        :return: Lower-cased, trimmed email value.
        """
        return (email or '').strip().lower()

    @property
    def resolved_status(self) -> str:
        """Resolve runtime status including expiry for pending invitations.

        :return: Resolved invitation status.
        """
        if self.status == self.STATUS_PENDING and self.is_expired:
            return 'expired'
        return self.status

    @property
    def is_expired(self) -> bool:
        """Return True if invitation expiry is in the past."""
        return timezone.now() >= self.expires_at

    @property
    def is_open(self) -> bool:
        """Return True if invitation can still be accepted."""
        return self.resolved_status == self.STATUS_PENDING

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Persist normalized email before writing invitation records.

        :param args: Positional arguments for model save.
        :param kwargs: Keyword arguments for model save.
        :return: None.
        """
        self.email_normalized = self.normalize_email(self.email)
        self.email = self.email_normalized
        super().save(*args, **kwargs)


class AgentLoginToken(models.Model):
    """Reusable project-bound login token for superuser-only agent sessions."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_login_tokens_created',
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='agent_login_tokens')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    used_at = models.DateTimeField(null=True, blank=True, db_index=True)
    used_by_ip = models.GenericIPAddressField(null=True, blank=True)
    used_user_agent = models.CharField(max_length=512, blank=True)

    class Meta:
        ordering = ['-created_at']

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Return SHA256 hash for opaque token storage."""
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def create_token(
        cls,
        *,
        created_by,
        project: Project,
        expires_at=None,
    ) -> tuple['AgentLoginToken', str]:
        """Create and persist a new one-time token for superusers."""
        if not getattr(created_by, 'is_superuser', False):
            raise PermissionError('Only superusers can create agent login tokens.')

        raw_token = secrets.token_urlsafe(48)
        token = cls.objects.create(
            created_by=created_by,
            project=project,
            token_hash=cls.hash_token(raw_token),
            expires_at=expires_at,
        )
        return token, raw_token

    @property
    def is_usable(self) -> bool:
        """Return True when token has not expired."""
        if self.expires_at is None:
            return True
        return timezone.now() < self.expires_at


class Supplier(TimestampedModel):
    """A seed supplier or manufacturer."""

    name = models.CharField(max_length=200, help_text="Supplier name")
    homepage_url = models.URLField(blank=True, help_text="Supplier homepage URL")
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    allowed_domains = models.JSONField(default=list, blank=True)
    name_normalized = models.CharField(
        max_length=200,
        editable=False,
        help_text="Normalized name for deduplication"
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='suppliers')

    @staticmethod
    def _normalize_domain(hostname: str) -> str:
        """Normalize one domain value and strip common URL parts."""
        raw = (hostname or '').strip().lower()
        if not raw:
            return ''
        if '://' in raw:
            raw = urlparse(raw).hostname or ''
        raw = raw.split('/')[0].split(':')[0].strip().lower().rstrip('.')
        if raw.startswith('www.'):
            raw = raw[4:]
        return raw

    @classmethod
    def normalize_allowed_domains(cls, domains: list[str] | tuple[str, ...] | None) -> list[str]:
        """Normalize user-provided allowed domains and deduplicate while preserving order."""
        normalized: list[str] = []
        for domain in (domains or []):
            item = cls._normalize_domain(str(domain))
            if item and item not in normalized:
                normalized.append(item)
            if item and f'www.{item}' not in normalized:
                normalized.append(f'www.{item}')
        return normalized

    @staticmethod
    def _is_valid_domain(domain: str) -> bool:
        """Return True if the string looks like a bare hostname."""
        if not domain or len(domain) > 253:
            return False
        if '/' in domain or ':' in domain or ' ' in domain:
            return False
        return bool(re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain))

    def _derive_slug_base(self) -> str:
        try:
            host = self._normalize_domain(urlparse(self.homepage_url).hostname or '')
        except Exception:  # noqa: BLE001
            host = ''
        if host:
            return host.split('.')[0]

        from django.utils.text import slugify
        return slugify(self.name) or 'supplier'

    def _assign_unique_slug(self) -> None:
        from django.utils.text import slugify

        if self.slug:
            base_slug = slugify(self.slug)
        else:
            base_slug = slugify(self._derive_slug_base())
        base_slug = base_slug or 'supplier'

        candidate = base_slug
        suffix = 2
        qs = Supplier.objects.exclude(pk=self.pk)
        while qs.filter(slug=candidate).exists():
            candidate = f"{base_slug}-{suffix}"
            suffix += 1
        self.slug = candidate

    def _derive_default_allowed_domains(self) -> list[str]:
        """Build default allowed domains from homepage host and explicit www variant."""
        try:
            hostname = urlparse(self.homepage_url).hostname or ''
        except Exception:  # noqa: BLE001
            hostname = ''
        normalized = self._normalize_domain(hostname)
        if not normalized:
            return []
        return [normalized, f'www.{normalized}']

    def clean(self) -> None:
        """Validate and normalize mutable supplier fields."""
        super().clean()
        domains = self.normalize_allowed_domains(self.allowed_domains if isinstance(self.allowed_domains, list) else [])
        if not domains:
            domains = self._derive_default_allowed_domains()
        invalid = [domain for domain in domains if not self._is_valid_domain(self._normalize_domain(domain))]
        if invalid:
            raise ValidationError({'allowed_domains': 'Domains müssen gültige Hostnamen ohne Schema oder Pfad sein.'})
        self.allowed_domains = domains

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save supplier and auto-generate normalized helper fields."""
        from .utils import normalize_supplier_name

        if self.name:
            self.name = ' '.join(self.name.split())
        self.name_normalized = normalize_supplier_name(self.name) or ''
        self.allowed_domains = self.normalize_allowed_domains(self.allowed_domains if isinstance(self.allowed_domains, list) else [])
        if not self.allowed_domains:
            self.allowed_domains = self._derive_default_allowed_domains()
        if not self.slug:
            self._assign_unique_slug()

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return the supplier name."""
        return self.name

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['project', 'name_normalized'], name='unique_supplier_name_per_project'),
        ]



def is_supplier_domain(url: str, supplier: Supplier | None) -> bool:
    """Return True when URL host matches supplier allowed domains."""
    if not supplier or not url:
        return False
    try:
        host = Supplier._normalize_domain(urlparse(url).hostname or '')
    except Exception:  # noqa: BLE001
        return False
    if not host:
        return False
    domains = [Supplier._normalize_domain(domain) for domain in (supplier.allowed_domains or []) if domain]
    return any(host == domain or host.endswith(f'.{domain}') for domain in domains)


class Location(TimestampedModel):
    """A physical farm location that can contain multiple fields."""
    SOIL_TYPE_SAND = 'sand'
    SOIL_TYPE_LOAM = 'loam'
    SOIL_TYPE_CLAY = 'clay'
    SOIL_TYPE_CHOICES = [
        (SOIL_TYPE_SAND, 'Sand'),
        (SOIL_TYPE_LOAM, 'Loam'),
        (SOIL_TYPE_CLAY, 'Clay'),
    ]

    EXPOSURE_NORTH = 'north'
    EXPOSURE_SOUTH = 'south'
    EXPOSURE_EAST = 'east'
    EXPOSURE_WEST = 'west'
    EXPOSURE_FLAT = 'flat'
    EXPOSURE_CHOICES = [
        (EXPOSURE_NORTH, 'North'),
        (EXPOSURE_SOUTH, 'South'),
        (EXPOSURE_EAST, 'East'),
        (EXPOSURE_WEST, 'West'),
        (EXPOSURE_FLAT, 'Flat'),
    ]

    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    soil_type = models.CharField(max_length=20, choices=SOIL_TYPE_CHOICES, null=True, blank=True)
    exposure = models.CharField(max_length=20, choices=EXPOSURE_CHOICES, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='locations')

    def clean(self) -> None:
        """Validate optional geographic coordinates."""
        super().clean()
        if self.latitude is not None and not (-90 <= self.latitude <= 90):
            raise ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if self.longitude is not None and not (-180 <= self.longitude <= 180):
            raise ValidationError({'longitude': 'Longitude must be between -180 and 180.'})

    def __str__(self) -> str:
        """Return the location name."""
        return self.name

    class Meta:
        ordering = ['name']


class Field(TimestampedModel):
    """A field within a location that can contain multiple beds."""
    # Validation constants.
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('1000000.00')  # Maximum 100 hectares (safe value within
    # DecimalField constraints)
    
    name = models.CharField(max_length=200)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='fields')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    length_m = models.FloatField(null=True, blank=True)
    width_m = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='fields')

    def clean(self) -> None:
        """Validate area and optional field dimensions."""
        super().clean()
        if self.area_sqm is not None:
            if self.area_sqm < self.MIN_AREA_SQM:
                raise ValidationError({
                    'area_sqm': f'Area must be at least {self.MIN_AREA_SQM} sqm.'
                })
            if self.area_sqm > self.MAX_AREA_SQM:
                raise ValidationError({
                    'area_sqm': f'Area must not exceed {self.MAX_AREA_SQM} sqm (100 hectares).'
                })

        if self.length_m is not None and self.length_m < 0:
            raise ValidationError({'length_m': 'Length must be greater than or equal to 0.'})
        if self.width_m is not None and self.width_m < 0:
            raise ValidationError({'width_m': 'Width must be greater than or equal to 0.'})

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Persist field and derive area from dimensions when both values are set."""
        if self.length_m is not None and self.width_m is not None:
            computed_area = Decimal(str(self.length_m * self.width_m)).quantize(Decimal('0.1'))
            self.area_sqm = computed_area
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return a string combining location and field name."""
        return f"{self.location.name} - {self.name}"

    class Meta:
        ordering = ['location', 'name']
        verbose_name = 'Parzelle'
        verbose_name_plural = 'Parzellen'
        constraints = [
            models.UniqueConstraint(
                fields=['location', 'name'],
                name='unique_field_name_per_location',
            ),
        ]


class Bed(TimestampedModel):
    """A bed within a field that stores optional area in square meters."""
    # Validation constants.
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('10000.00')  # Maximum 10,000 sqm (~1 hectare, reasonable for a bed)
    
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds', verbose_name='Parzelle')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    length_m = models.FloatField(null=True, blank=True)
    width_m = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='beds')

    def clean(self) -> None:
        """Validate area and optional bed dimensions."""
        super().clean()
        if self.area_sqm is not None:
            if self.area_sqm < self.MIN_AREA_SQM:
                raise ValidationError({'area_sqm': f'Area must be at least {self.MIN_AREA_SQM} sqm.'})
            if self.area_sqm > self.MAX_AREA_SQM:
                raise ValidationError({'area_sqm': f'Area must not exceed {self.MAX_AREA_SQM} sqm (1 hectare).'})

        if self.length_m is not None and self.length_m < 0:
            raise ValidationError({'length_m': 'Length must be greater than or equal to 0.'})
        if self.width_m is not None and self.width_m < 0:
            raise ValidationError({'width_m': 'Width must be greater than or equal to 0.'})

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Persist bed and derive area from dimensions when both values are set."""
        if self.length_m is not None and self.width_m is not None:
            computed_area = Decimal(str(self.length_m * self.width_m)).quantize(Decimal('0.1'))
            self.area_sqm = computed_area
        super().save(*args, **kwargs)

    def get_total_area(self) -> float | None:
        """Return the bed area in square meters, or None if not set."""
        if self.area_sqm:
            return float(self.area_sqm)
        return None

    def __str__(self) -> str:
        """Return a string combining field and bed name."""
        return f"{self.field.name} - {self.name}"

    class Meta:
        ordering = ['field', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'name'],
                name='unique_bed_name_per_field',
            ),
        ]


class BedLayout(TimestampedModel):
    """Persisted bed layout coordinates for the graphical field view."""

    bed = models.OneToOneField(Bed, on_delete=models.CASCADE, related_name='layout')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='bed_layouts')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='bed_layouts')
    x = models.FloatField(default=0.0)
    y = models.FloatField(default=0.0)
    version = models.PositiveIntegerField(default=1)
    scale = models.FloatField(null=True, blank=True)

    def clean(self) -> None:
        """Validate that location matches the bed's location."""
        super().clean()
        if self.bed_id and self.location_id and self.bed.field.location_id != self.location_id:
            raise ValidationError({'location': 'Layout location must match the bed location.'})

    def __str__(self) -> str:
        """Return a compact textual representation."""
        return f"BedLayout bed={self.bed_id} location={self.location_id}"

    class Meta:
        ordering = ['location', 'bed']


class FieldLayout(TimestampedModel):
    """Persisted field layout coordinates for the graphical field view."""

    field = models.OneToOneField(Field, on_delete=models.CASCADE, related_name='layout')
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='field_layouts')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='field_layouts')
    x = models.FloatField(default=0.0)
    y = models.FloatField(default=0.0)
    version = models.PositiveIntegerField(default=1)
    scale = models.FloatField(null=True, blank=True)

    def clean(self) -> None:
        """Validate that location matches the field's location."""
        super().clean()
        if self.field_id and self.location_id and self.field.location_id != self.location_id:
            raise ValidationError({'location': 'Layout location must match the field location.'})

    def __str__(self) -> str:
        """Return a compact textual representation."""
        return f"FieldLayout field={self.field_id} location={self.location_id}"

    class Meta:
        ordering = ['location', 'field']


class ActiveCultureManager(models.Manager):
    """Default manager that hides soft-deleted cultures."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Culture(TimestampedModel):
    """A crop or plant type with growth, harvest, and planning metadata."""
    ORIGIN_MANUAL = 'manual'
    ORIGIN_IMPORTED = 'imported'
    ORIGIN_TYPE_CHOICES = [
        (ORIGIN_MANUAL, 'Manual'),
        (ORIGIN_IMPORTED, 'Imported'),
    ]
    NUTRIENT_DEMAND_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    
    CULTIVATION_TYPE_CHOICES = [
        ('pre_cultivation', 'Pre-cultivation'),  # Anzucht
        ('direct_sowing', 'Direct Sowing'),  # Direktsaat
    ]
    CULTIVATION_TYPE_VALUES = {item[0] for item in CULTIVATION_TYPE_CHOICES}
    DIRECT_SOWING_SEED_RATE_UNITS = SEED_RATE_UNITS
    PRE_CULTIVATION_AUTO_SEED_RATE_UNITS = {
        SEED_RATE_UNIT_G_PER_M2,
        SEED_RATE_UNIT_G_PER_LFM,
        SEED_RATE_UNIT_SEEDS_PER_M2,
        SEED_RATE_UNIT_SEEDS_PER_LFM,
        SEED_RATE_UNIT_SEEDS_PER_PLANT,
    }
    
    HARVEST_METHOD_CHOICES = [
        ('per_plant', 'Per Plant'),
        ('per_sqm', 'Per m²'),
    ]

    # Basic information.
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200)
    # Use growth_duration_days instead of days_to_harvest.
    notes = models.TextField(blank=True)
    seed_supplier = models.CharField(
        max_length=200,
        blank=True,
        help_text="Seed supplier/manufacturer (legacy field)",
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    image_file = models.ForeignKey(
        'MediaFile',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cultures',
        help_text='Referenced media file for this culture image'
    )
    supplier = models.ForeignKey(
        'Supplier',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cultures',
        help_text="Seed supplier (preferred over seed_supplier text field)"
    )
    selected_seed_demand_supplier = models.ForeignKey(
        'Supplier',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='seed_demand_cultures',
        help_text='Persisted supplier selection for seed-demand package calculations',
    )
    supplier_product_url = models.URLField(null=True, blank=True, help_text='Supplier product page URL for enrichment')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='cultures')
    source_public_culture = models.ForeignKey('PublicCulture', null=True, blank=True, on_delete=models.SET_NULL, related_name='imported_cultures')
    source_public_version = models.IntegerField(null=True, blank=True)
    origin_type = models.CharField(max_length=50, choices=ORIGIN_TYPE_CHOICES, default=ORIGIN_MANUAL)
    is_modified_from_source = models.BooleanField(default=False)
    
    # Normalized fields for matching and deduplication.
    name_normalized = models.CharField(
        max_length=200,
        db_index=True,
        editable=False,
        help_text="Normalized name for deduplication"
    )
    variety_normalized = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        db_index=True,
        editable=False,
        help_text="Normalized variety for deduplication"
    )
    
    # Manual planning fields.
    crop_family = models.CharField(
        max_length=200,
        blank=True,
        help_text="Crop family for rotation planning",
    )
    nutrient_demand = models.CharField(
        max_length=20, 
        choices=NUTRIENT_DEMAND_CHOICES, 
        blank=True,
        help_text="Nutrient demand level"
    )
    cultivation_types = models.JSONField(default=list, blank=True)
    cultivation_type = models.CharField(
        max_length=30,
        choices=CULTIVATION_TYPE_CHOICES,
        blank=True,
        help_text="Deprecated single cultivation type (kept for compatibility)"
    )
    
    # Timing fields (in days).
    growth_duration_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Growth duration in days (from planting to first harvest)"
    )
    harvest_duration_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Harvest duration in days (from first to last harvest)"
    )
    propagation_duration_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Propagation duration in days"
    )
    
    # Harvest information.
    harvest_method = models.CharField(
        max_length=20,
        choices=HARVEST_METHOD_CHOICES,
        blank=True,
        help_text="Harvest method"
    )
    expected_yield = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected yield amount"
    )
    allow_deviation_delivery_weeks = models.BooleanField(
        default=False,
        help_text="Allow deviating delivery weeks"
    )
    
    # Planting distances (stored in meters - SI units).
    distance_within_row_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Distance within row in meters (stored in SI units)"
    )
    row_spacing_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Row spacing in meters (stored in SI units)"
    )
    sowing_depth_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Sowing depth in meters (stored in SI units)"
    )

    # Seeding attributes.
    seed_rate_value = models.FloatField(
        null=True,
        blank=True,
        help_text="Seed rate value (per m², per meter, or per plant, depending on unit)"
    )
    seed_rate_unit = models.CharField(
        max_length=30,
        null=True,
        blank=True,
        help_text="Unit for seed rate (e.g. 'g/m²', 'seeds/m', 'seeds_per_plant')"
    )
    seed_rate_by_cultivation = models.JSONField(null=True, blank=True)
    sowing_calculation_safety_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Safety margin for seeding calculation in percent (0-100)"
    )
    seed_rate_direct_value = models.FloatField(
        null=True,
        blank=True,
        help_text="Seed rate for direct sowing"
    )
    seed_rate_direct_unit = models.CharField(
        max_length=30,
        null=True,
        blank=True,
        help_text="Unit for direct sowing seed rate"
    )
    sowing_calculation_safety_percent_direct = models.FloatField(
        null=True,
        blank=True,
        help_text="Safety margin for direct sowing in percent (0-100)"
    )
    seed_rate_pre_cultivation_value = models.FloatField(
        null=True,
        blank=True,
        help_text="Seed rate for pre-cultivation/transplanting"
    )
    seed_rate_pre_cultivation_unit = models.CharField(
        max_length=30,
        null=True,
        blank=True,
        help_text="Unit for pre-cultivation/transplanting seed rate"
    )
    sowing_calculation_safety_percent_pre_cultivation = models.FloatField(
        null=True,
        blank=True,
        help_text="Safety margin for pre-cultivation/transplanting in percent (0-100)"
    )
    thousand_kernel_weight_g = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Weight of 1000 kernels in grams"
    )
    seeding_requirement = models.FloatField(
        null=True,
        blank=True,
        help_text="Total seeding requirement (g or seeds, depending on type)"
    )
    seeding_requirement_type = models.CharField(
        max_length=30,
        blank=True,
        help_text="Type of seeding requirement (e.g. 'g', 'seeds')"
    )
    
    # Display settings.

    objects = ActiveCultureManager()
    all_objects = models.Manager()
    display_color = models.CharField(
        max_length=7,
        blank=True,
        help_text="Display color for cultivation calendar (hex format: #RRGGBB)"
    )
    
    def clean(self) -> None:
        """Validate numeric ranges for positive values."""
        super().clean()
        errors = {}
        for field_name in ('seed_rate_unit', 'seed_rate_direct_unit', 'seed_rate_pre_cultivation_unit'):
            if getattr(self, field_name) == '-':
                setattr(self, field_name, None)

        if not isinstance(self.cultivation_types, list):
            errors['cultivation_types'] = 'Cultivation types must be a list.'
        else:
            normalized_types = [str(item).strip() for item in self.cultivation_types if str(item).strip()]
            if not normalized_types and self.cultivation_type:
                normalized_types = [self.cultivation_type]
            if not normalized_types:
                normalized_types = ['pre_cultivation']
            if len(set(normalized_types)) != len(normalized_types):
                errors['cultivation_types'] = 'Cultivation types must be unique.'
            invalid_types = [item for item in normalized_types if item not in self.CULTIVATION_TYPE_VALUES]
            if invalid_types:
                errors['cultivation_types'] = 'Cultivation types contain unsupported values.'
            self.cultivation_types = normalized_types
            if normalized_types and self.cultivation_type not in normalized_types:
                self.cultivation_type = normalized_types[0]
        
        # Validate positive numeric fields.
        if self.growth_duration_days is not None and self.growth_duration_days < 0:
            errors['growth_duration_days'] = 'Growth duration must be non-negative.'
        
        if self.harvest_duration_days is not None and self.harvest_duration_days < 0:
            errors['harvest_duration_days'] = 'Harvest duration must be non-negative.'
        
        if self.propagation_duration_days is not None and self.propagation_duration_days < 0:
            errors['propagation_duration_days'] = 'Propagation duration must be non-negative.'
        
        if self.expected_yield is not None and self.expected_yield < 0:
            errors['expected_yield'] = 'Expected yield must be non-negative.'

        if self.seeding_requirement is None and self.seeding_requirement_type:
            errors['seeding_requirement'] = 'Seeding requirement value is required when seeding requirement type is set.'

        if self.seeding_requirement is not None and not self.seeding_requirement_type:
            errors['seeding_requirement_type'] = 'Seeding requirement type is required when seeding requirement is set.'

        if self.seed_rate_by_cultivation is not None:
            if not isinstance(self.seed_rate_by_cultivation, dict):
                errors['seed_rate_by_cultivation'] = 'Seed rate by cultivation must be an object.'
            else:
                key_set = set(self.seed_rate_by_cultivation.keys())
                if not key_set.issubset(set(self.cultivation_types or [])):
                    errors['seed_rate_by_cultivation'] = 'Seed rate by cultivation keys must be a subset of cultivation_types.'
                for method, payload in self.seed_rate_by_cultivation.items():
                    if not isinstance(payload, dict):
                        errors['seed_rate_by_cultivation'] = 'Each cultivation seed rate entry must be an object.'
                        continue
                    value = payload.get('value')
                    unit = payload.get('unit')
                    if not isinstance(value, (int, float)) or float(value) <= 0:
                        errors['seed_rate_by_cultivation'] = 'Seed rate by cultivation values must be positive numbers.'
                    if method == 'pre_cultivation' and unit not in self.PRE_CULTIVATION_AUTO_SEED_RATE_UNITS:
                        errors['seed_rate_by_cultivation'] = 'Pre-cultivation unit is unsupported.'
                    if method == 'direct_sowing' and unit not in self.DIRECT_SOWING_SEED_RATE_UNITS:
                        errors['seed_rate_by_cultivation'] = 'Direct-sowing unit is unsupported.'

        if self.distance_within_row_m is not None and self.distance_within_row_m < 0:
            errors['distance_within_row_m'] = 'Distance within row must be non-negative.'
        
        if self.row_spacing_m is not None and self.row_spacing_m < 0:
            errors['row_spacing_m'] = 'Row spacing must be non-negative.'
        
        if self.sowing_depth_m is not None and self.sowing_depth_m < 0:
            errors['sowing_depth_m'] = 'Sowing depth must be non-negative.'

        if self.seed_rate_value is not None and self.seed_rate_value <= 0:
            errors['seed_rate_value'] = 'Seed rate value must be greater than zero.'

        if self.seed_rate_unit and self.seed_rate_unit not in self.PRE_CULTIVATION_AUTO_SEED_RATE_UNITS:
            errors['seed_rate_unit'] = 'Seed rate unit is unsupported.'

        if self.seed_rate_direct_value is not None and self.seed_rate_direct_value <= 0:
            errors['seed_rate_direct_value'] = 'Direct sowing seed rate value must be greater than zero.'
        if self.seed_rate_direct_unit and self.seed_rate_direct_unit not in self.DIRECT_SOWING_SEED_RATE_UNITS:
            errors['seed_rate_direct_unit'] = 'Direct sowing seed rate unit is unsupported.'
        has_direct = 'direct_sowing' in (self.cultivation_types or [])
        has_pre = 'pre_cultivation' in (self.cultivation_types or [])

        if has_direct and self.seed_rate_direct_value is None and self.seed_rate_direct_unit:
            errors['seed_rate_direct_value'] = 'Direct sowing seed rate value is required when direct sowing unit is set.'
        if has_direct and self.seed_rate_direct_value is not None and not self.seed_rate_direct_unit:
            errors['seed_rate_direct_unit'] = 'Direct sowing seed rate unit is required when direct sowing value is set.'

        if self.seed_rate_pre_cultivation_value is not None and self.seed_rate_pre_cultivation_value <= 0:
            errors['seed_rate_pre_cultivation_value'] = 'Pre-cultivation seed rate value must be greater than zero.'
        if self.seed_rate_pre_cultivation_unit and self.seed_rate_pre_cultivation_unit not in self.PRE_CULTIVATION_AUTO_SEED_RATE_UNITS:
            errors['seed_rate_pre_cultivation_unit'] = 'Pre-cultivation seed rate unit is unsupported.'
        if has_pre and self.seed_rate_pre_cultivation_value is not None and not self.seed_rate_pre_cultivation_unit:
            errors['seed_rate_pre_cultivation_unit'] = 'Pre-cultivation seed rate unit is required when pre-cultivation value is set.'
        if has_pre and self.seed_rate_pre_cultivation_value is None and self.seed_rate_pre_cultivation_unit:
            errors['seed_rate_pre_cultivation_value'] = 'Pre-cultivation seed rate value is required when pre-cultivation unit is set.'

        if self.thousand_kernel_weight_g is not None and self.thousand_kernel_weight_g <= 0:
            errors['thousand_kernel_weight_g'] = 'Thousand kernel weight must be greater than zero.'

        if self.selected_seed_demand_supplier_id and self.project_id and self.selected_seed_demand_supplier.project_id != self.project_id:
            errors['selected_seed_demand_supplier'] = 'Selected seed demand supplier must belong to the same project.'

        
        # Validate hex color format if provided.
        if self.display_color:
            import re
            if not re.match(r'^#[0-9A-Fa-f]{6}$', self.display_color):
                errors['display_color'] = 'Display color must be in hex format (#RRGGBB).'
        
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the culture and auto-generate display color and normalized fields."""
        from .utils import normalize_text

        previous = None
        if self.pk:
            previous = Culture.all_objects.filter(pk=self.pk).values().first()

        if previous and previous.get('source_public_culture_id') and not previous.get('is_modified_from_source'):
            tracked_fields = {
                'name', 'variety', 'notes', 'seed_supplier', 'crop_family', 'nutrient_demand', 'cultivation_types',
                'cultivation_type', 'growth_duration_days', 'harvest_duration_days', 'propagation_duration_days',
                'harvest_method', 'expected_yield', 'allow_deviation_delivery_weeks', 'distance_within_row_m',
                'row_spacing_m', 'sowing_depth_m', 'seed_rate_value', 'seed_rate_unit', 'seed_rate_by_cultivation',
                'sowing_calculation_safety_percent', 'seed_rate_direct_value', 'seed_rate_direct_unit',
                'sowing_calculation_safety_percent_direct', 'seed_rate_pre_cultivation_value',
                'seed_rate_pre_cultivation_unit', 'sowing_calculation_safety_percent_pre_cultivation',
                'thousand_kernel_weight_g', 'seeding_requirement',
                'seeding_requirement_type', 'display_color', 'supplier_id', 'supplier_product_url', 'image_file_id',
                'selected_seed_demand_supplier_id',
            }
            if any(previous.get(field) != getattr(self, field) for field in tracked_fields):
                self.is_modified_from_source = True

        # Generate display color on creation if not set.
        if not self.pk and not self.display_color:
            self.display_color = self._generate_display_color()

        # Always update normalized fields based on current values
        self.name_normalized = normalize_text(self.name) or ''
        self.variety_normalized = normalize_text(self.variety)

        super().save(*args, **kwargs)

        current = Culture.all_objects.filter(pk=self.pk).values().first() or {}
        serializable_snapshot: dict[str, Any] = json.loads(
            json.dumps(current, cls=DjangoJSONEncoder)
        )

        changed_fields: list[str] = []
        if previous:
            for key, value in current.items():
                if key in {'created_at', 'updated_at'}:
                    continue
                if previous.get(key) != value:
                    changed_fields.append(key)
        else:
            changed_fields.append('created')

        CultureRevision.objects.create(
            culture=self,
            snapshot=serializable_snapshot,
            changed_fields=changed_fields,
        )

    def _generate_display_color(self) -> str:
        """Generate a display color using a Golden Angle HSL strategy."""
        # Use the max ID as index to avoid race conditions (None -> 0).
        max_id = Culture.objects.aggregate(models.Max('id'))['id__max']
        index = max_id if max_id is not None else 0
        
        # Golden Angle HSL strategy: hue=(index×137.508)%360, saturation=65%, lightness=55%.
        golden_angle = 137.508
        hue = (index * golden_angle) % 360
        saturation = 0.65
        lightness = 0.55
        
        # Convert HSL to RGB.
        rgb = self._hsl_to_rgb(hue, saturation, lightness)
        
        # Convert RGB to hex.
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def _hsl_to_rgb(
        self,
        h: float,
        s: float,
        lightness: float,
    ) -> tuple[int, int, int]:
        """Convert HSL color to RGB."""
        h = h / 360.0
        
        def hue_to_rgb(p: float, q: float, t: float) -> float:
            if t < 0:
                t += 1
            if t > 1:
                t -= 1
            if t < 1/6:
                return p + (q - p) * 6 * t
            if t < 1/2:
                return q
            if t < 2/3:
                return p + (q - p) * (2/3 - t) * 6
            return p
        
        if s == 0:
            r = g = b = lightness
        else:
            q = (
                lightness * (1 + s)
                if lightness < 0.5
                else lightness + s - lightness * s
            )
            p = 2 * lightness - q
            r = hue_to_rgb(p, q, h + 1/3)
            g = hue_to_rgb(p, q, h)
            b = hue_to_rgb(p, q, h - 1/3)
        
        return (int(r * 255), int(g * 255), int(b * 255))

    @property
    def plants_per_m2(self) -> Decimal | None:
        """
        Calculate plants per square meter based on spacing.
        
        Formula: plants_per_m2 = 10000 / (row_spacing_cm * plant_spacing_cm)
        
        :return: Plants per m² as Decimal, or None if spacing data is missing or invalid
        """
        # Convert meters to centimeters for calculation
        row_spacing_cm = self.row_spacing_m * 100 if self.row_spacing_m else None
        plant_spacing_cm = self.distance_within_row_m * 100 if self.distance_within_row_m else None
        
        # Return None if either spacing is missing or invalid (<= 0)
        if not row_spacing_cm or not plant_spacing_cm:
            return None
        if row_spacing_cm <= 0 or plant_spacing_cm <= 0:
            return None
        
        # Calculate plants per m²: 10000 cm² per m² / (row_spacing * plant_spacing)
        return Decimal("10000") / (Decimal(str(row_spacing_cm)) * Decimal(str(plant_spacing_cm)))

    def __str__(self) -> str:
        """Return the culture name, with variety in parentheses if set."""
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name

    class Meta:
        ordering = ['name', 'variety']
        constraints = [
            models.UniqueConstraint(
                fields=['name_normalized', 'variety_normalized', 'supplier'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_culture_normalized',
                violation_error_message=(
                    'A culture with this name, variety, and supplier already exists.'
                )
            )
        ]

class CultureSupplierData(TimestampedModel):
    """Supplier-specific seed metadata attached to one culture."""

    culture = models.ForeignKey(Culture, on_delete=models.CASCADE, related_name='supplier_data')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='culture_supplier_data')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='culture_supplier_data')
    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_url = models.URLField(blank=True)
    supplier_product_name = models.CharField(max_length=255, blank=True)
    supplier_product_url = models.URLField(blank=True)
    packaging_sizes = models.JSONField(default=list, blank=True)
    thousand_kernel_weight_g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    germination_rate = models.FloatField(null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    source_url = models.URLField(blank=True)

    class Meta:
        ordering = ['culture', 'supplier']
        constraints = [
            models.UniqueConstraint(fields=['culture', 'supplier'], name='unique_culture_supplier_data_per_supplier'),
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.thousand_kernel_weight_g is not None and self.thousand_kernel_weight_g <= 0:
            errors['thousand_kernel_weight_g'] = 'Thousand kernel weight must be greater than zero.'
        if self.germination_rate is not None and (self.germination_rate < 0 or self.germination_rate > 100):
            errors['germination_rate'] = 'Germination rate must be between 0 and 100.'
        if self.price is not None and self.price < 0:
            errors['price'] = 'Price must be non-negative.'
        if errors:
            raise ValidationError(errors)


class PublicCulture(TimestampedModel):
    """Published culture template in the shared public library."""

    STATUS_PUBLISHED = 'published'
    STATUS_CHOICES = [
        (STATUS_PUBLISHED, 'Published'),
    ]

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='public_cultures')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_PUBLISHED)
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    seed_supplier = models.CharField(max_length=200, blank=True)
    supplier_name = models.CharField(max_length=200, blank=True)
    source_project_culture = models.ForeignKey('Culture', null=True, blank=True, on_delete=models.SET_NULL, related_name='published_public_cultures')
    source_project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.SET_NULL, related_name='published_cultures')
    version = models.IntegerField(default=1)
    published_at = models.DateTimeField(null=True, blank=True)
    name_normalized = models.CharField(max_length=200, db_index=True, editable=False)
    variety_normalized = models.CharField(max_length=200, blank=True, db_index=True, editable=False)
    crop_family = models.CharField(max_length=200, blank=True)
    nutrient_demand = models.CharField(max_length=20, choices=Culture.NUTRIENT_DEMAND_CHOICES, blank=True)
    cultivation_types = models.JSONField(default=list, blank=True)
    cultivation_type = models.CharField(max_length=30, choices=Culture.CULTIVATION_TYPE_CHOICES, blank=True)
    growth_duration_days = models.IntegerField(null=True, blank=True)
    harvest_duration_days = models.IntegerField(null=True, blank=True)
    propagation_duration_days = models.IntegerField(null=True, blank=True)
    harvest_method = models.CharField(max_length=20, choices=Culture.HARVEST_METHOD_CHOICES, blank=True)
    expected_yield = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    allow_deviation_delivery_weeks = models.BooleanField(default=False)
    distance_within_row_m = models.FloatField(null=True, blank=True)
    row_spacing_m = models.FloatField(null=True, blank=True)
    sowing_depth_m = models.FloatField(null=True, blank=True)
    seed_rate_value = models.FloatField(null=True, blank=True)
    seed_rate_unit = models.CharField(max_length=30, null=True, blank=True)
    seed_rate_by_cultivation = models.JSONField(null=True, blank=True)
    sowing_calculation_safety_percent = models.FloatField(null=True, blank=True)
    thousand_kernel_weight_g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    seeding_requirement = models.FloatField(null=True, blank=True)
    seeding_requirement_type = models.CharField(max_length=30, blank=True)
    display_color = models.CharField(max_length=7, blank=True)
    seed_packages = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['name', 'variety']

    def save(self, *args: Any, **kwargs: Any) -> None:
        from .utils import normalize_text

        self.name_normalized = normalize_text(self.name) or ''
        self.variety_normalized = normalize_text(self.variety) or ''
        if self.status == self.STATUS_PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.variety})" if self.variety else self.name


class EnrichmentAccountingRun(models.Model):
    """Stores token usage and estimated costs per enrichment invocation."""

    MODE_CHOICES = [
        ('complete', 'Complete'),
        ('reresearch', 'Re-research'),
    ]

    culture = models.ForeignKey(
        Culture,
        on_delete=models.CASCADE,
        related_name='enrichment_accounting_runs',
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    provider = models.CharField(max_length=50)
    model = models.CharField(max_length=100)
    input_tokens = models.IntegerField(default=0)
    cached_input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    web_search_call_count = models.IntegerField(default=0)
    estimated_cost_usd = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']



class CultureRevision(models.Model):
    """Versioned snapshot of a culture record."""

    culture = models.ForeignKey('Culture', on_delete=models.CASCADE, related_name='revisions')
    snapshot = models.JSONField()
    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    user_name = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['-created_at']



class ProjectRevision(models.Model):
    """Snapshot of the full project state for point-in-time restore."""

    snapshot = models.JSONField()
    summary = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_revisions')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
        ]



class SeedPackage(TimestampedModel):
    """Sold package option for a culture."""

    UNIT_GRAMS = SEED_PACKAGE_UNIT_GRAMS
    UNIT_SEEDS = SEED_PACKAGE_UNIT_SEEDS
    UNIT_CHOICES = [
        (UNIT_GRAMS, 'Grams'),
        (UNIT_SEEDS, 'Seeds'),
    ]

    culture = models.ForeignKey('Culture', on_delete=models.CASCADE, related_name='seed_packages')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='seed_packages')
    size_value = models.DecimalField(max_digits=10, decimal_places=1)
    size_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default=UNIT_GRAMS)
    evidence_text = models.CharField(max_length=200, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['size_unit', 'size_value']
        constraints = [
            models.UniqueConstraint(
                fields=['culture', 'size_value', 'size_unit'],
                name='unique_seed_package_per_culture_size_unit',
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.size_value is not None and self.size_value <= 0:
            raise ValidationError({'size_value': 'Package size must be greater than zero.'})
        if self.size_unit not in {self.UNIT_GRAMS, self.UNIT_SEEDS}:
            raise ValidationError({'size_unit': 'Unsupported package size unit.'})

    def __str__(self) -> str:
        return f"{self.culture.name} {self.size_value} {self.size_unit}"


class PlantingPlan(TimestampedModel):
    """A planting schedule linking a culture to a bed with dates."""
    CULTIVATION_TYPE_CHOICES = Culture.CULTIVATION_TYPE_CHOICES

    culture = models.ForeignKey(Culture, on_delete=models.CASCADE, related_name='planting_plans')
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='planting_plans')
    cultivation_type = models.CharField(
        max_length=30,
        choices=CULTIVATION_TYPE_CHOICES,
        blank=True,
        help_text="Cultivation type used for this plan",
    )
    planting_date = models.DateField()
    harvest_date = models.DateField(
        blank=True,
        null=True,
        help_text="Harvest start date (Erntebeginn)",
    )
    harvest_end_date = models.DateField(
        blank=True,
        null=True,
        help_text="Harvest end date (Ernteende)",
    )
    quantity = models.IntegerField(null=True, blank=True, help_text="Number of plants or seeds")
    area_usage_sqm = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Area in square meters used by this planting plan"
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_planting_plans',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_planting_plans',
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='planting_plans')

    def _get_active_period(self) -> tuple[date, date] | None:
        """Return inclusive active period used for overlap validations."""
        if self.planting_date is None:
            return None

        active_start = self.planting_date
        active_end = self.harvest_end_date or self.harvest_date

        if active_end is None and self.culture_id:
            if self.culture.growth_duration_days:
                harvest_date = active_start + timedelta(days=self.culture.growth_duration_days)
            else:
                harvest_date = active_start

            if self.culture.growth_duration_days and self.culture.harvest_duration_days:
                active_end = harvest_date + timedelta(days=self.culture.harvest_duration_days)
            else:
                active_end = harvest_date

        if active_end is None:
            active_end = active_start

        return active_start, active_end

    def clean(self) -> None:
        """Run default model validation."""
        super().clean()


    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the plan and auto-calculate harvest dates if needed."""
        # Detect if planting_date or culture has changed.
        should_recalculate = False
        
        if self.pk:
            # Existing instance - check if planting_date or culture changed.
            try:
                prev = PlantingPlan.objects.get(pk=self.pk)
                if prev.planting_date != self.planting_date or prev.culture_id != self.culture_id:
                    should_recalculate = True
            except PlantingPlan.DoesNotExist:
                # Should not happen, but treat as new instance.
                should_recalculate = True
        else:
            # New instance - always calculate.
            should_recalculate = True
        
        if not self.cultivation_type and self.culture:
            if self.culture.cultivation_types and len(self.culture.cultivation_types) > 0:
                self.cultivation_type = self.culture.cultivation_types[0]
            elif self.culture.cultivation_type:
                self.cultivation_type = self.culture.cultivation_type

        # Calculate harvest dates if needed.
        if should_recalculate and self.planting_date and self.culture:
            # Calculate harvest start date using growth_duration_days only.
            if self.culture.growth_duration_days:
                self.harvest_date = self.planting_date + timedelta(
                    days=self.culture.growth_duration_days
                )
            else:
                self.harvest_date = self.planting_date  # Fallback: no offset when value is missing.
            # Calculate harvest end date.
            if self.culture.growth_duration_days and self.culture.harvest_duration_days:
                self.harvest_end_date = self.harvest_date + timedelta(
                    days=self.culture.harvest_duration_days
                )
            else:
                self.harvest_end_date = self.harvest_date
        
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return a string combining culture, bed, and planting date."""
        return f"{self.culture.name} in {self.bed.name} - {self.planting_date}"

    class Meta:
        ordering = ['-planting_date']
        indexes = [
            models.Index(fields=['project', '-planting_date']),
            models.Index(fields=['project', 'bed', 'planting_date', 'harvest_end_date']),
            models.Index(fields=['project', 'culture']),
        ]


class Task(TimestampedModel):
    """A farm management task optionally linked to a planting plan."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    planting_plan = models.ForeignKey(
        PlantingPlan,
        on_delete=models.CASCADE,
        related_name='tasks',
        null=True,
        blank=True,
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')

    def __str__(self) -> str:
        """Return a string combining task title and status."""
        return f"{self.title} ({self.status})"

    class Meta:
        ordering = ['due_date', '-created_at']


class NoteAttachment(models.Model):
    """Image attachment linked to a planting plan note."""

    planting_plan = models.ForeignKey(
        PlantingPlan,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    image = models.FileField(upload_to=note_attachment_upload_path)
    caption = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_note_attachments',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_note_attachments',
    )
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='note_attachments')

    class Meta:
        ordering = ['-created_at']
