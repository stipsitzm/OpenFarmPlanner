from django.db import models
from datetime import timedelta
from typing import Any


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
    name = models.CharField(max_length=200)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='fields')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    have optional length and width measurements.
    
    Attributes:
        name: The name of the bed
        field: Foreign key reference to the parent Field
        length_m: Length of the bed in meters (optional)
        width_m: Width of the bed in meters (optional)
        notes: Additional notes about the bed
        created_at: Timestamp when the bed was created
        updated_at: Timestamp when the bed was last updated
    """
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds')
    length_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    width_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    with its growing characteristics, labor requirements, and yield expectations.
    It can store data from OpenFarm or be manually entered.
    
    Attributes:
        name: The name of the crop (e.g., "Tomato", "Lettuce")
        variety: Specific variety of the crop (optional, from cultivar_name in OpenFarm)
        days_to_harvest: Average days from planting to harvest (backward-compatible field)
        notes: Additional notes about the culture
        
        # CSA Farm management fields
        plant_spacing_cm: Distance between plants in centimeters
        row_spacing_cm: Distance between rows in centimeters
        maturity_days: Days to maturity (alias for days_to_harvest from OpenFarm)
        yield_kg_per_m2: Expected yield in kilograms per square meter
        planting_labor_min_per_m2: Labor minutes per square meter for planting
        harvest_labor_min_per_m2: Labor minutes per square meter for harvesting
        hilling_labor_min_per_m2: Labor minutes per square meter for hilling
        
        # OpenFarm identifiers and fields
        openfarm_id: OpenFarm internal ID (for upserts)
        openfarm_slug: OpenFarm URL-friendly slug
        binomial_name: Scientific binomial name (genus + species)
        common_names: JSON array of common names in different languages
        sun_requirements: Sun exposure requirements (full sun, partial, etc.)
        sowing_method: Method of sowing (direct, transplant, etc.)
        spread_cm: Plant spread/width in centimeters
        height_cm: Plant height in centimeters
        growing_degree_days: Growing degree days requirement
        taxon: Taxonomic rank (Species, Genus, Family, etc.)
        description: Detailed description of the crop
        openfarm_raw: Complete raw JSON from OpenFarm (preserves all data)
        
        created_at: Timestamp when the culture was created
        updated_at: Timestamp when the culture was last updated
    """
    # Core fields (existing)
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200, blank=True)
    days_to_harvest = models.IntegerField(
        help_text="Average days from planting to harvest",
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)
    
    # CSA Farm management fields
    plant_spacing_cm = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance between plants in centimeters"
    )
    row_spacing_cm = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance between rows in centimeters"
    )
    maturity_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Days to maturity"
    )
    yield_kg_per_m2 = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected yield in kilograms per square meter"
    )
    planting_labor_min_per_m2 = models.IntegerField(
        null=True,
        blank=True,
        help_text="Labor minutes per square meter for planting"
    )
    harvest_labor_min_per_m2 = models.IntegerField(
        null=True,
        blank=True,
        help_text="Labor minutes per square meter for harvesting"
    )
    hilling_labor_min_per_m2 = models.IntegerField(
        null=True,
        blank=True,
        help_text="Labor minutes per square meter for hilling"
    )
    
    # OpenFarm identifiers and typed fields
    openfarm_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        unique=True,
        help_text="OpenFarm internal identifier"
    )
    openfarm_slug = models.SlugField(
        max_length=200,
        null=True,
        blank=True,
        help_text="OpenFarm URL-friendly slug"
    )
    binomial_name = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        help_text="Scientific binomial name"
    )
    common_names = models.JSONField(
        null=True,
        blank=True,
        help_text="Array of common names in different languages"
    )
    sun_requirements = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Sun exposure requirements"
    )
    sowing_method = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Method of sowing (direct, transplant, etc.)"
    )
    spread_cm = models.IntegerField(
        null=True,
        blank=True,
        help_text="Plant spread/width in centimeters"
    )
    height_cm = models.IntegerField(
        null=True,
        blank=True,
        help_text="Plant height in centimeters"
    )
    growing_degree_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Growing degree days requirement"
    )
    taxon = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Taxonomic rank (Species, Genus, Family, etc.)"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the crop"
    )
    openfarm_raw = models.JSONField(
        null=True,
        blank=True,
        help_text="Complete raw JSON from OpenFarm (preserves all data)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """Return string representation of the culture.
        
        Returns:
            The name of the culture, with variety in parentheses if specified
        """
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name
    
    def get_days_to_harvest(self) -> int:
        """Get days to harvest, preferring maturity_days if set.
        
        Returns:
            Days to harvest value, or 0 if not set
        """
        return self.maturity_days or self.days_to_harvest or 0

    class Meta:
        ordering = ['name', 'variety']
        indexes = [
            models.Index(fields=['openfarm_id']),
            models.Index(fields=['name', 'variety']),
        ]


class PlantingPlan(models.Model):
    """A plan for planting a specific culture in a specific bed.
    
    This model represents a planting schedule that links a culture
    to a bed with specific dates. The harvest date is automatically
    calculated based on the planting date and the culture's days_to_harvest.
    
    Attributes:
        culture: Foreign key reference to the Culture being planted
        bed: Foreign key reference to the Bed where planting occurs
        planting_date: The date when planting is scheduled
        harvest_date: Calculated date for expected harvest (auto-calculated)
        quantity: Number of plants or seeds (optional)
        notes: Additional notes about the planting plan
        created_at: Timestamp when the plan was created
        updated_at: Timestamp when the plan was last updated
    """
    culture = models.ForeignKey(Culture, on_delete=models.CASCADE, related_name='planting_plans')
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='planting_plans')
    planting_date = models.DateField()
    harvest_date = models.DateField(blank=True, null=True)
    quantity = models.IntegerField(null=True, blank=True, help_text="Number of plants or seeds")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the planting plan and auto-calculate harvest_date if not set.
        
        If harvest_date is not already set, it is calculated by adding
        the culture's days to harvest to the planting_date.
        
        Args:
            *args: Variable length argument list passed to parent save()
            **kwargs: Arbitrary keyword arguments passed to parent save()
        """
        if not self.harvest_date and self.planting_date and self.culture:
            days = self.culture.get_days_to_harvest()
            if days > 0:
                self.harvest_date = self.planting_date + timedelta(days=days)
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

