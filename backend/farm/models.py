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
    have optional area measurement in square meters.
    
    Attributes:
        name: The name of the bed
        field: Foreign key reference to the parent Field
        area_sqm: Area of the bed in square meters (optional)
        notes: Additional notes about the bed
        created_at: Timestamp when the bed was created
        updated_at: Timestamp when the bed was last updated
    """
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
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
    with its growing characteristics, particularly the time needed
    from planting to harvest.
    
    Attributes:
        name: The name of the crop (e.g., "Tomato", "Lettuce")
        variety: Specific variety of the crop (optional)
        days_to_harvest: Average days from planting to harvest
        notes: Additional notes about the culture
        growstuff_id: Unique ID from Growstuff API (optional)
        growstuff_slug: URL slug from Growstuff API (optional)
        source: Source of the data ('manual', 'growstuff')
        last_synced: Timestamp of last Growstuff sync (optional)
        en_wikipedia_url: English Wikipedia URL for the crop (from Growstuff)
        perennial: Whether the crop is perennial (from Growstuff)
        median_lifespan: Median lifespan in days (from Growstuff)
        median_days_to_first_harvest: Median days to first harvest (from Growstuff)
        median_days_to_last_harvest: Median days to last harvest (from Growstuff)
        created_at: Timestamp when the culture was created
        updated_at: Timestamp when the culture was last updated
    """
    SOURCE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('growstuff', 'Growstuff API'),
    ]
    
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200, blank=True)
    days_to_harvest = models.IntegerField(help_text="Average days from planting to harvest")
    notes = models.TextField(blank=True)
    
    # Growstuff API fields
    growstuff_id = models.IntegerField(null=True, blank=True, unique=True, help_text="Growstuff API crop ID")
    growstuff_slug = models.CharField(max_length=200, blank=True, help_text="Growstuff API crop slug")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual', help_text="Source of the crop data")
    last_synced = models.DateTimeField(null=True, blank=True, help_text="Last time synced with Growstuff API")
    en_wikipedia_url = models.URLField(max_length=500, blank=True, null=True, help_text="English Wikipedia URL")
    perennial = models.BooleanField(null=True, blank=True, help_text="Whether the crop is perennial")
    median_lifespan = models.IntegerField(null=True, blank=True, help_text="Median lifespan in days")
    median_days_to_first_harvest = models.IntegerField(null=True, blank=True, help_text="Median days to first harvest")
    median_days_to_last_harvest = models.IntegerField(null=True, blank=True, help_text="Median days to last harvest")
    
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

    class Meta:
        ordering = ['name', 'variety']


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
        the culture's days_to_harvest to the planting_date.
        
        Args:
            *args: Variable length argument list passed to parent save()
            **kwargs: Arbitrary keyword arguments passed to parent save()
        """
        if not self.harvest_date and self.planting_date and self.culture:
            self.harvest_date = self.planting_date + timedelta(days=self.culture.days_to_harvest)
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

