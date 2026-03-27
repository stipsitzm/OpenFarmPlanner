"""Django admin configuration for farm models.

This module configures the Django admin interface for all farm models,
providing customized list displays, filters, and search capabilities.
"""

from django.contrib import admin

from .models import Bed, Culture, Field, Location, PlantingPlan, Project, ProjectInvitation, ProjectMembership, Supplier, Task


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin interface configuration for Project model."""

    list_display = ['name', 'slug', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    """Admin interface configuration for ProjectMembership model."""

    list_display = ['user', 'project', 'role', 'created_at']
    list_filter = ['role', 'project']
    search_fields = ['user__email', 'user__username', 'project__name', 'project__slug']


@admin.register(ProjectInvitation)
class ProjectInvitationAdmin(admin.ModelAdmin):
    """Admin interface configuration for ProjectInvitation model."""

    list_display = ['email', 'project', 'role', 'status', 'invited_by', 'expires_at', 'created_at']
    list_filter = ['status', 'role', 'project']
    search_fields = ['email', 'email_normalized', 'project__name', 'project__slug']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    """Admin interface configuration for Supplier model.
    
    Provides a customized admin interface with search and display
    capabilities for seed suppliers.
    
    Attributes:
        list_display: Fields to display in the list view
        search_fields: Fields to include in the search functionality
        readonly_fields: Fields that cannot be edited in the admin
    """
    list_display = ['name', 'name_normalized', 'created_at']
    search_fields = ['name', 'name_normalized']
    readonly_fields = ['name_normalized']


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
    list_display = ['name', 'field', 'area_sqm', 'created_at']
    list_filter = ['field__location', 'field']
    search_fields = ['name', 'field__name']


@admin.register(Culture)
class CultureAdmin(admin.ModelAdmin):
    """Admin interface configuration for Culture model.
    
    Provides a customized admin interface with search and display
    capabilities for crop cultures.
    
    Attributes:
        list_display: Fields to display in the list view
        search_fields: Fields to include in the search functionality
    """
    list_display = [
        'name', 'variety',
        'seed_rate_value', 'seed_rate_unit',
        'sowing_calculation_safety_percent',
        'seeding_requirement', 'seeding_requirement_type',
        'created_at'
    ]
    search_fields = [
        'name', 'variety',
        'seed_rate_unit', 'seeding_requirement_type'
    ]


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

