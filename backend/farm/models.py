from django.db import models
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json
from typing import Any
import re
import uuid


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


class Supplier(TimestampedModel):
    """A seed supplier or manufacturer."""
    
    name = models.CharField(max_length=200, help_text="Supplier name")
    name_normalized = models.CharField(
        max_length=200,
        unique=True,
        editable=False,
        help_text="Normalized name for deduplication"
    )
    
    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save supplier and auto-generate normalized name."""
        from .utils import normalize_supplier_name
        
        # Always update name_normalized based on current name
        self.name_normalized = normalize_supplier_name(self.name) or ''
        
        # Trim and collapse whitespace in the user-facing name
        if self.name:
            self.name = ' '.join(self.name.split())
        
        super().save(*args, **kwargs)
    
    def __str__(self) -> str:
        """Return the supplier name."""
        return self.name
    
    class Meta:
        ordering = ['name']


class Location(TimestampedModel):
    """A physical farm location that can contain multiple fields."""
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        """Return the location name."""
        return self.name

    class Meta:
        ordering = ['name']


class Field(TimestampedModel):
    """A field within a location that can contain multiple beds."""
    # Validation constants.
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('1000000.00')  # Maximum 100 hectares (safe value within DecimalField constraints)
    
    name = models.CharField(max_length=200)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='fields')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    def clean(self) -> None:
        """Validate that area_sqm is within realistic bounds if provided."""
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

    def __str__(self) -> str:
        """Return a string combining location and field name."""
        return f"{self.location.name} - {self.name}"

    class Meta:
        ordering = ['location', 'name']


class Bed(TimestampedModel):
    """A bed within a field that stores optional area in square meters."""
    # Validation constants.
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('10000.00')  # Maximum 10,000 sqm (~1 hectare, reasonable for a bed)
    
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

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


class ActiveCultureManager(models.Manager):
    """Default manager that hides soft-deleted cultures."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Culture(TimestampedModel):
    """A crop or plant type with growth, harvest, and planning metadata."""
    NUTRIENT_DEMAND_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    
    CULTIVATION_TYPE_CHOICES = [
        ('pre_cultivation', 'Pre-cultivation'),  # Anzucht
        ('direct_sowing', 'Direct Sowing'),  # Direktsaat
    ]
    
    HARVEST_METHOD_CHOICES = [
        ('per_plant', 'Per Plant'),
        ('per_sqm', 'Per m²'),
    ]
    
    # Basic information.
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200)
    # Use growth_duration_days instead of days_to_harvest.
    notes = models.TextField(blank=True)
    seed_supplier = models.CharField(max_length=200, blank=True, help_text="Seed supplier/manufacturer (legacy field)")
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
    crop_family = models.CharField(max_length=200, blank=True, help_text="Crop family for rotation planning")
    nutrient_demand = models.CharField(
        max_length=20, 
        choices=NUTRIENT_DEMAND_CHOICES, 
        blank=True,
        help_text="Nutrient demand level"
    )
    cultivation_type = models.CharField(
        max_length=30,
        choices=CULTIVATION_TYPE_CHOICES,
        blank=True,
        help_text="Type of cultivation"
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
    sowing_calculation_safety_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Safety margin for seeding calculation in percent (0-100)"
    )
    thousand_kernel_weight_g = models.FloatField(
        null=True,
        blank=True,
        help_text="Weight of 1000 kernels in grams"
    )
    package_size_g = models.FloatField(
        null=True,
        blank=True,
        help_text="Package size in grams"
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
        
        # Validate positive numeric fields.
        if self.growth_duration_days is not None and self.growth_duration_days < 0:
            errors['growth_duration_days'] = 'Growth duration must be non-negative.'
        
        if self.harvest_duration_days is not None and self.harvest_duration_days < 0:
            errors['harvest_duration_days'] = 'Harvest duration must be non-negative.'
        
        if self.propagation_duration_days is not None and self.propagation_duration_days < 0:
            errors['propagation_duration_days'] = 'Propagation duration must be non-negative.'
        
        if self.expected_yield is not None and self.expected_yield < 0:
            errors['expected_yield'] = 'Expected yield must be non-negative.'
        
        if self.distance_within_row_m is not None and self.distance_within_row_m < 0:
            errors['distance_within_row_m'] = 'Distance within row must be non-negative.'
        
        if self.row_spacing_m is not None and self.row_spacing_m < 0:
            errors['row_spacing_m'] = 'Row spacing must be non-negative.'
        
        if self.sowing_depth_m is not None and self.sowing_depth_m < 0:
            errors['sowing_depth_m'] = 'Sowing depth must be non-negative.'

        if self.thousand_kernel_weight_g is not None and self.thousand_kernel_weight_g < 0:
            errors['thousand_kernel_weight_g'] = 'Thousand kernel weight must be non-negative.'

        if self.package_size_g is not None and self.package_size_g < 0:
            errors['package_size_g'] = 'Package size must be non-negative.'
        
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

    def _hsl_to_rgb(self, h: float, s: float, l: float) -> tuple[int, int, int]:
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
            r = g = b = l
        else:
            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
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
                violation_error_message='A culture with this name, variety, and supplier already exists.'
            )
        ]


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

    class Meta:
        ordering = ['-created_at']



class PlantingPlan(TimestampedModel):
    """A planting schedule linking a culture to a bed with dates."""
    culture = models.ForeignKey(Culture, on_delete=models.CASCADE, related_name='planting_plans')
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='planting_plans')
    planting_date = models.DateField()
    harvest_date = models.DateField(blank=True, null=True, help_text="Harvest start date (Erntebeginn)")
    harvest_end_date = models.DateField(blank=True, null=True, help_text="Harvest end date (Ernteende)")
    quantity = models.IntegerField(null=True, blank=True, help_text="Number of plants or seeds")
    area_usage_sqm = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Area in square meters used by this planting plan"
    )
    notes = models.TextField(blank=True)

    def clean(self) -> None:
        """Validate total area usage against the bed area when available."""
        super().clean()
        
        # Only validate if area_usage_sqm is set and bed has dimensions.
        if self.area_usage_sqm and self.bed:
            bed_area = self.bed.get_total_area()
            
            if bed_area is not None:
                # Calculate total area used by other planting plans for this bed.
                existing_plans = PlantingPlan.objects.filter(bed=self.bed).exclude(pk=self.pk)
                total_used_area = sum(
                    float(plan.area_usage_sqm) 
                    for plan in existing_plans 
                    if plan.area_usage_sqm
                )
                
                # Add current plan's area usage.
                total_area_with_current = total_used_area + float(self.area_usage_sqm)
                
                # if total_area_with_current > bed_area:
                #     raise ValidationError({
                #         'area_usage_sqm': f'Total area usage ({total_area_with_current:.2f} sqm) '
                #                          f'exceeds bed area ({bed_area:.2f} sqm). '
                #                          f'Available: {bed_area - total_used_area:.2f} sqm.'
                #     })

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
        
        # Calculate harvest dates if needed.
        if should_recalculate and self.planting_date and self.culture:
            # Calculate harvest start date using growth_duration_days only.
            if self.culture.growth_duration_days:
                self.harvest_date = self.planting_date + timedelta(days=self.culture.growth_duration_days)
            else:
                self.harvest_date = self.planting_date  # Fallback: no offset when value is missing.
            # Calculate harvest end date.
            if self.culture.growth_duration_days and self.culture.harvest_duration_days:
                self.harvest_end_date = self.harvest_date + timedelta(days=self.culture.harvest_duration_days)
            else:
                self.harvest_end_date = self.harvest_date
        
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return a string combining culture, bed, and planting date."""
        return f"{self.culture.name} in {self.bed.name} - {self.planting_date}"

    class Meta:
        ordering = ['-planting_date']


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
    planting_plan = models.ForeignKey(PlantingPlan, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

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
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-created_at']
