"""Planning: planting plans and tasks."""

from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.db import models

from .base import TimestampedModel
from .cultures import Culture
from .projects import Project
from .structure import Bed


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

        if should_recalculate and self.planting_date and self.culture:
            self.recalculate_harvest_dates()
        
        super().save(*args, **kwargs)

    def recalculate_harvest_dates(self) -> None:
        """Calculate stored harvest dates from the current culture timing values."""
        if not self.planting_date or not self.culture:
            return

        if self.culture.growth_duration_days:
            self.harvest_date = self.planting_date + timedelta(
                days=self.culture.growth_duration_days
            )
        else:
            self.harvest_date = self.planting_date

        if self.culture.growth_duration_days and self.culture.harvest_duration_days:
            self.harvest_end_date = self.harvest_date + timedelta(
                days=self.culture.harvest_duration_days
            )
        else:
            self.harvest_end_date = self.harvest_date

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
