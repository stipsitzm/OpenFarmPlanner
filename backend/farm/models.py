from django.db import models
from datetime import timedelta


class Location(models.Model):
    """A physical location where farming occurs"""
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Field(models.Model):
    """A field within a location"""
    name = models.CharField(max_length=200)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='fields')
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.location.name} - {self.name}"

    class Meta:
        ordering = ['location', 'name']


class Bed(models.Model):
    """A bed within a field"""
    name = models.CharField(max_length=200)
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='beds')
    length_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    width_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.field.name} - {self.name}"

    class Meta:
        ordering = ['field', 'name']


class Culture(models.Model):
    """A crop or plant type that can be grown"""
    name = models.CharField(max_length=200)
    variety = models.CharField(max_length=200, blank=True)
    days_to_harvest = models.IntegerField(help_text="Average days from planting to harvest")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name

    class Meta:
        ordering = ['name', 'variety']


class PlantingPlan(models.Model):
    """A plan for planting a specific culture in a specific bed"""
    culture = models.ForeignKey(Culture, on_delete=models.CASCADE, related_name='planting_plans')
    bed = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='planting_plans')
    planting_date = models.DateField()
    harvest_date = models.DateField(blank=True, null=True)
    quantity = models.IntegerField(null=True, blank=True, help_text="Number of plants or seeds")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        """Auto-calculate harvest_date if not set"""
        if not self.harvest_date and self.planting_date and self.culture:
            self.harvest_date = self.planting_date + timedelta(days=self.culture.days_to_harvest)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.culture.name} in {self.bed.name} - {self.planting_date}"

    class Meta:
        ordering = ['-planting_date']


class Task(models.Model):
    """A task related to farm management"""
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

    def __str__(self):
        return f"{self.title} ({self.status})"

    class Meta:
        ordering = ['due_date', '-created_at']

