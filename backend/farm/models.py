from django.db import models
from django.core.exceptions import ValidationError
from datetime import timedelta
from decimal import Decimal
from typing import Any
from decimal import Decimal



class Location(models.Model):
    """A physical location where farming occurs.
    
    This model represents a physical farm location that can contain
    multiple fields. It stores basic information about the location
    including name, address, and notes.
    
    Attributes:
        name: The name of the location
        address: Physical address of the location
        notes: Additional notes about the location
        created_at: Timestamp when the location was created
        updated_at: Timestamp when the location was last updated
    """
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """Return string representation of the location.
        
        Returns:
            The name of the location
        """
        return self.name

    class Meta:
        ordering = ['name']


class Field(models.Model):
    """A field within a location.
    
    This model represents a field that belongs to a specific location.
    A field can contain multiple beds and has optional area measurements.
    
    Attributes:
        name: The name of the field
        location: Foreign key reference to the parent Location
        area_sqm: Area of the field in square meters (optional)
        notes: Additional notes about the field
        created_at: Timestamp when the field was created
        updated_at: Timestamp when the field was last updated
    """
    # Constants for validation
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('1000000.00')  # Maximum 100 hectares (safe value within DecimalField constraints)
    
    name = models.CharField(max_length=200)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='fields')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self) -> None:
        """Validate the field data.
        
        Validates that area_sqm is within realistic bounds if provided.
        
        Raises:
            ValidationError: If area_sqm is outside realistic bounds
        """
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
        """Return string representation of the field.
        
        Returns:
            A string combining location name and field name
        """
        return f"{self.location.name} - {self.name}"

    class Meta:
        ordering = ['location', 'name']


class Bed(models.Model):
    """A bed within a field.
    
    This model represents a planting bed that belongs to a specific field.
    Beds are the smallest organizational unit in the farm hierarchy and
    have area measurement in square meters.
    
    Attributes:
        name: The name of the bed
        field: Foreign key reference to the parent Field
        area_sqm: Area of the bed in square meters (optional)
        notes: Additional notes about the bed
        created_at: Timestamp when the bed was created
        updated_at: Timestamp when the bed was last updated
    """
    # Constants for validation
    MIN_AREA_SQM = Decimal('0.01')  # Minimum 0.01 sqm (10cm x 10cm)
    MAX_AREA_SQM = Decimal('10000.00')  # Maximum 10,000 sqm (~1 hectare, reasonable for a bed)
    
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_total_area(self) -> float | None:
        """Get total area of the bed in square meters.
        
        Returns:
            The total area in square meters, or None if not set
        """
        if self.area_sqm:
            return float(self.area_sqm)
        return None

    def __str__(self) -> str:
        """Return string representation of the bed.
        
        Returns:
            A string combining field name and bed name
        """
        return f"{self.field.name} - {self.name}"

    class Meta:
        ordering = ['field', 'name']


class Culture(models.Model):
    """A crop or plant type that can be grown.
    
    This model represents a specific type of crop or plant variety
    with its growing characteristics, particularly the time needed
    from planting to harvest.
    
    Attributes:
        name: The name of the crop (e.g., "Tomato", "Lettuce")
        variety: Specific variety of the crop (optional)
        days_to_harvest: Average days from planting to harvest (kept for backwards compatibility)
        notes: Additional notes about the culture
        
        # Manual planning fields
        crop_family: Crop family for rotation planning (optional)
        nutrient_demand: Nutrient demand level (low/medium/high, optional)
        cultivation_type: Type of cultivation (pre-cultivation/direct sowing, optional)
        germination_rate: Germination rate percentage (0-100, optional)
        safety_margin: Safety margin percentage for planning (0-100, optional)
        
        # Timing fields (in days)
        growth_duration_days: Growth duration in days (from planting to first harvest, required)
        harvest_duration_days: Harvest duration in days (from first to last harvest, required)
        propagation_duration_days: Propagation duration in days (optional)
        
        # Harvest information
        harvest_method: Harvest method (per plant, per m², optional)
        expected_yield: Expected yield amount (optional)
        allow_deviation_delivery_weeks: Allow deviating delivery weeks (boolean, optional)
        
        # Planting distances
        distance_within_row_cm: Distance within row in cm (optional)
        row_spacing_cm: Row spacing in cm (optional)
        sowing_depth_cm: Sowing depth in cm (optional)
        
        # Display settings
        display_color: Display color for cultivation calendar (hex color, optional)
        
        # Growstuff API fields (read-only via form)
        growstuff_id: Unique ID from Growstuff API (optional)
        growstuff_slug: URL slug from Growstuff API (optional)
        source: Source of the data ('manual', 'growstuff')
        last_synced: Timestamp of last Growstuff sync (optional)
        en_wikipedia_url: English Wikipedia URL for the crop (from Growstuff)
        perennial: Whether the crop is perennial (from Growstuff)
        median_lifespan: Median lifespan in days (from Growstuff)
        
        created_at: Timestamp when the culture was created
        updated_at: Timestamp when the culture was last updated
    """
    SOURCE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('growstuff', 'Growstuff API'),
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
    
    HARVEST_METHOD_CHOICES = [
        ('per_plant', 'Per Plant'),
        ('per_sqm', 'Per m²'),
    ]
    
    # Basic information
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200, blank=True)
    days_to_harvest = models.IntegerField(help_text="Average days from planting to harvest")
    notes = models.TextField(blank=True)
    
    # Manual planning fields
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
    germination_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Germination rate percentage (0-100)"
    )
    safety_margin = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Safety margin percentage (0-100)"
    )
    
    # Timing fields (in days)
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
    
    # Harvest information
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
    
    # Planting distances
    distance_within_row_cm = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Distance within row in cm"
    )
    row_spacing_cm = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Row spacing in cm"
    )
    sowing_depth_cm = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Sowing depth in cm"
    )
    
    # Display settings
    display_color = models.CharField(
        max_length=7,
        blank=True,
        help_text="Display color for cultivation calendar (hex format: #RRGGBB)"
    )
    
    # Growstuff API fields
    growstuff_id = models.IntegerField(null=True, blank=True, unique=True, help_text="Growstuff API crop ID")
    growstuff_slug = models.CharField(max_length=200, blank=True, help_text="Growstuff API crop slug")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual', help_text="Source of the crop data")
    last_synced = models.DateTimeField(null=True, blank=True, help_text="Last time synced with Growstuff API")
    en_wikipedia_url = models.URLField(max_length=500, blank=True, null=True, help_text="English Wikipedia URL")
    perennial = models.BooleanField(null=True, blank=True, help_text="Whether the crop is perennial")
    median_lifespan = models.IntegerField(null=True, blank=True, help_text="Median lifespan in days")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self) -> None:
        """Validate the culture data.
        
        Validates numeric ranges for percentages and positive values.
        
        Raises:
            ValidationError: If validation fails
        """
        super().clean()
        errors = {}
        
        # Validate percentage fields (0-100)
        if self.germination_rate is not None:
            if self.germination_rate < 0 or self.germination_rate > 100:
                errors['germination_rate'] = 'Germination rate must be between 0 and 100.'
        
        if self.safety_margin is not None:
            if self.safety_margin < 0 or self.safety_margin > 100:
                errors['safety_margin'] = 'Safety margin must be between 0 and 100.'
        
        # Validate positive numeric fields
        if self.growth_duration_days is not None and self.growth_duration_days < 0:
            errors['growth_duration_days'] = 'Growth duration must be non-negative.'
        
        if self.harvest_duration_days is not None and self.harvest_duration_days < 0:
            errors['harvest_duration_days'] = 'Harvest duration must be non-negative.'
        
        if self.propagation_duration_days is not None and self.propagation_duration_days < 0:
            errors['propagation_duration_days'] = 'Propagation duration must be non-negative.'
        
        if self.expected_yield is not None and self.expected_yield < 0:
            errors['expected_yield'] = 'Expected yield must be non-negative.'
        
        if self.distance_within_row_cm is not None and self.distance_within_row_cm < 0:
            errors['distance_within_row_cm'] = 'Distance within row must be non-negative.'
        
        if self.row_spacing_cm is not None and self.row_spacing_cm < 0:
            errors['row_spacing_cm'] = 'Row spacing must be non-negative.'
        
        if self.sowing_depth_cm is not None and self.sowing_depth_cm < 0:
            errors['sowing_depth_cm'] = 'Sowing depth must be non-negative.'
        
        # Validate hex color format if provided
        if self.display_color:
            import re
            if not re.match(r'^#[0-9A-Fa-f]{6}$', self.display_color):
                errors['display_color'] = 'Display color must be in hex format (#RRGGBB).'
        
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the culture and auto-generate display color if not set.
        
        Uses Golden Angle HSL strategy to generate visually distinct colors.
        Color is only generated on creation if not already set.
        
        Args:
            *args: Variable length argument list passed to parent save()
            **kwargs: Arbitrary keyword arguments passed to parent save()
        """
        # Generate display color on creation if not set
        if not self.pk and not self.display_color:
            self.display_color = self._generate_display_color()
        
        super().save(*args, **kwargs)

    def _generate_display_color(self) -> str:
        """Generate a display color using Golden Angle HSL strategy.
        
        Uses a deterministic approach based on database count to ensure
        visually distinct colors across all cultures.
        
        Returns:
            Hex color string in format #RRGGBB
        """
        # Use the max ID as index to avoid race conditions
        # For the first culture, this will be None, so we use 0
        max_id = Culture.objects.aggregate(models.Max('id'))['id__max']
        index = max_id if max_id is not None else 0
        
        # Golden Angle HSL strategy
        # hue = (index × 137.508) % 360
        # saturation = 65%
        # lightness = 55%
        golden_angle = 137.508
        hue = (index * golden_angle) % 360
        saturation = 0.65
        lightness = 0.55
        
        # Convert HSL to RGB
        rgb = self._hsl_to_rgb(hue, saturation, lightness)
        
        # Convert RGB to hex
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def _hsl_to_rgb(self, h: float, s: float, l: float) -> tuple[int, int, int]:
        """Convert HSL color to RGB.
        
        :param h: Hue (0-360)
        :param s: Saturation (0-1)
        :param l: Lightness (0-1)
        :return: Tuple of RGB values (0-255)
        """
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

    def __str__(self) -> str:
        """Return string representation of the culture.
        
        Returns:
            The name of the culture, with variety in parentheses if specified
        """
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name

    class Meta:
        ordering = ['name', 'variety']


class PlantingPlan(models.Model):
    """A plan for planting a specific culture in a specific bed.
    
    This model represents a planting schedule that links a culture
    to a bed with specific dates. The harvest dates are automatically
    calculated based on the planting date and the culture's harvest timing.
    
    Attributes:
        culture: Foreign key reference to the Culture being planted
        bed: Foreign key reference to the Bed where planting occurs
        planting_date: The date when planting is scheduled
        harvest_date: Calculated date for expected harvest start (auto-calculated)
        harvest_end_date: Calculated date for expected harvest end (auto-calculated)
        quantity: Number of plants or seeds (optional)
        area_usage_sqm: Area in square meters used by this planting plan (optional)
        notes: Additional notes about the planting plan
        created_at: Timestamp when the plan was created
        updated_at: Timestamp when the plan was last updated
    """
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self) -> None:
        """Validate the planting plan.
        
        Validates that the total area usage of all planting plans for this bed
        does not exceed the bed's total area (if bed dimensions are set).
        
        Raises:
            ValidationError: If total area usage exceeds bed area
        """
        super().clean()
        
        # Only validate if area_usage_sqm is set and bed has dimensions
        if self.area_usage_sqm and self.bed:
            bed_area = self.bed.get_total_area()
            
            if bed_area is not None:
                # Calculate total area used by all other planting plans for this bed
                existing_plans = PlantingPlan.objects.filter(bed=self.bed).exclude(pk=self.pk)
                total_used_area = sum(
                    float(plan.area_usage_sqm) 
                    for plan in existing_plans 
                    if plan.area_usage_sqm
                )
                
                # Add current plan's area usage
                total_area_with_current = total_used_area + float(self.area_usage_sqm)
                
                #if total_area_with_current > bed_area:
                #    raise ValidationError({
                #        'area_usage_sqm': f'Total area usage ({total_area_with_current:.2f} sqm) '
                #                         f'exceeds bed area ({bed_area:.2f} sqm). '
                #                         f'Available: {bed_area - total_used_area:.2f} sqm.'
                #    })

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the planting plan and auto-calculate harvest dates.
        
        Auto-calculates harvest dates based on planting date and culture timing:
        - harvest_date: planting_date + days_to_harvest (or median_days_to_first_harvest if available)
        - harvest_end_date: planting_date + median_days_to_last_harvest (if available)
        
        Harvest dates are recalculated whenever planting_date or culture changes.
        
        Args:
            *args: Variable length argument list passed to parent save()
            **kwargs: Arbitrary keyword arguments passed to parent save()
        """
        # Detect if planting_date or culture has changed
        should_recalculate = False
        
        if self.pk:
            # Existing instance - check if planting_date or culture changed
            try:
                prev = PlantingPlan.objects.get(pk=self.pk)
                if prev.planting_date != self.planting_date or prev.culture_id != self.culture_id:
                    should_recalculate = True
            except PlantingPlan.DoesNotExist:
                # Should not happen, but treat as new instance
                should_recalculate = True
        else:
            # New instance - always calculate
            should_recalculate = True
        
        # Calculate harvest dates if needed
        if should_recalculate and self.planting_date and self.culture:
            # Calculate harvest start date
            # Use median_days_to_first_harvest if available, otherwise fall back to days_to_harvest
            if self.culture.median_days_to_first_harvest:
                self.harvest_date = self.planting_date + timedelta(days=self.culture.median_days_to_first_harvest)
            else:
                self.harvest_date = self.planting_date + timedelta(days=self.culture.days_to_harvest)
            
            # Calculate harvest end date
            if self.culture.median_days_to_last_harvest:
                self.harvest_end_date = self.planting_date + timedelta(days=self.culture.median_days_to_last_harvest)
            else:
                # If no median_days_to_last_harvest, set to same as harvest_date (single-day window)
                self.harvest_end_date = self.harvest_date
        
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return string representation of the planting plan.
        
        Returns:
            A string combining culture name, bed name, and planting date
        """
        return f"{self.culture.name} in {self.bed.name} - {self.planting_date}"

    class Meta:
        ordering = ['-planting_date']


class Task(models.Model):
    """A task related to farm management.
    
    This model represents a farm management task that can optionally
    be linked to a specific planting plan. Tasks track activities
    with status and due dates.
    
    Attributes:
        STATUS_CHOICES: Tuple of valid status options for tasks
        title: Short title describing the task
        description: Detailed description of the task
        planting_plan: Optional foreign key to associated PlantingPlan
        due_date: Optional due date for the task
        status: Current status of the task (default: 'pending')
        created_at: Timestamp when the task was created
        updated_at: Timestamp when the task was last updated
    """
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """Return string representation of the task.
        
        Returns:
            A string combining task title and status
        """
        return f"{self.title} ({self.status})"

    class Meta:
        ordering = ['due_date', '-created_at']

