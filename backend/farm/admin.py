"""Django admin configuration for farm models.

This module configures the Django admin interface for all farm models,
providing customized list displays, filters, and search capabilities.
"""

from django.contrib import admin
from .models import Location, Field, Bed, Culture, PlantingPlan, Task


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    """Admin interface configuration for Location model.
    
    Provides a customized admin interface with search and display
    capabilities for farm locations.
    
    Attributes:
        list_display: Fields to display in the list view
        search_fields: Fields to include in the search functionality
    """
    list_display = ['name', 'address', 'created_at']
    search_fields = ['name', 'address']


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    """Admin interface configuration for Field model.
    
    Provides a customized admin interface with filtering, search,
    and display capabilities for fields.
    
    Attributes:
        list_display: Fields to display in the list view
        list_filter: Fields to use for filtering the list
        search_fields: Fields to include in the search functionality
    """
    list_display = ['name', 'location', 'area_sqm', 'created_at']
    list_filter = ['location']
    search_fields = ['name', 'location__name']


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    """Admin interface configuration for Bed model.
    
    Provides a customized admin interface with hierarchical filtering,
    search, and display capabilities for beds.
    
    Attributes:
        list_display: Fields to display in the list view
        list_filter: Fields to use for filtering the list (includes location hierarchy)
        search_fields: Fields to include in the search functionality
    """
    list_display = ['name', 'field', 'length_m', 'width_m', 'created_at']
    list_filter = ['field__location', 'field']
    search_fields = ['name', 'field__name']


@admin.register(Culture)
class CultureAdmin(admin.ModelAdmin):
    """Admin interface configuration for Culture model.
    
    Provides a customized admin interface with search, filtering,
    and display capabilities for crop cultures. Supports both
    traditional and OpenFarm-imported cultures.
    
    Attributes:
        list_display: Fields to display in the list view
        list_filter: Fields to use for filtering the list
        search_fields: Fields to include in the search functionality
        fieldsets: Organization of fields in the detail view
        readonly_fields: Fields that cannot be edited
    """
    list_display = ['name', 'variety', 'binomial_name', 'maturity_days', 'openfarm_id', 'created_at']
    list_filter = ['taxon', 'sun_requirements', 'sowing_method']
    search_fields = ['name', 'variety', 'binomial_name', 'openfarm_id', 'description']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'variety', 'description', 'notes')
        }),
        ('Growing Requirements', {
            'fields': ('maturity_days', 'days_to_harvest', 'sun_requirements', 'sowing_method')
        }),
        ('Spacing & Dimensions', {
            'fields': ('plant_spacing_cm', 'row_spacing_cm', 'spread_cm', 'height_cm')
        }),
        ('Labor & Yield', {
            'fields': ('yield_kg_per_m2', 'planting_labor_min_per_m2', 
                      'harvest_labor_min_per_m2', 'hilling_labor_min_per_m2'),
            'classes': ('collapse',)
        }),
        ('OpenFarm Data', {
            'fields': ('openfarm_id', 'openfarm_slug', 'binomial_name', 'common_names',
                      'taxon', 'growing_degree_days'),
            'classes': ('collapse',)
        }),
        ('Raw Data', {
            'fields': ('openfarm_raw',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PlantingPlan)
class PlantingPlanAdmin(admin.ModelAdmin):
    """Admin interface configuration for PlantingPlan model.
    
    Provides a customized admin interface with date hierarchy, filtering,
    search, and display capabilities for planting plans. The harvest_date
    field is read-only as it's auto-calculated.
    
    Attributes:
        list_display: Fields to display in the list view
        list_filter: Fields to use for filtering the list
        search_fields: Fields to include in the search functionality
        date_hierarchy: Field to use for date-based navigation
        readonly_fields: Fields that cannot be edited in the admin
    """
    list_display = ['culture', 'bed', 'planting_date', 'harvest_date', 'quantity', 'created_at']
    list_filter = ['culture', 'bed__field__location']
    search_fields = ['culture__name', 'bed__name']
    date_hierarchy = 'planting_date'
    readonly_fields = ['harvest_date']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Admin interface configuration for Task model.
    
    Provides a customized admin interface with date hierarchy, status filtering,
    search, and display capabilities for farm tasks.
    
    Attributes:
        list_display: Fields to display in the list view
        list_filter: Fields to use for filtering the list
        search_fields: Fields to include in the search functionality
        date_hierarchy: Field to use for date-based navigation
    """
    list_display = ['title', 'status', 'due_date', 'planting_plan', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'description']
    date_hierarchy = 'due_date'

