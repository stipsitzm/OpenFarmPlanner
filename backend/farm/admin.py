from django.contrib import admin
from .models import Location, Field, Bed, Culture, PlantingPlan, Task


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'address', 'created_at']
    search_fields = ['name', 'address']


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'area_sqm', 'created_at']
    list_filter = ['location']
    search_fields = ['name', 'location__name']


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ['name', 'field', 'length_m', 'width_m', 'created_at']
    list_filter = ['field__location', 'field']
    search_fields = ['name', 'field__name']


@admin.register(Culture)
class CultureAdmin(admin.ModelAdmin):
    list_display = ['name', 'variety', 'days_to_harvest', 'created_at']
    search_fields = ['name', 'variety']


@admin.register(PlantingPlan)
class PlantingPlanAdmin(admin.ModelAdmin):
    list_display = ['culture', 'bed', 'planting_date', 'harvest_date', 'quantity', 'created_at']
    list_filter = ['culture', 'bed__field__location']
    search_fields = ['culture__name', 'bed__name']
    date_hierarchy = 'planting_date'
    readonly_fields = ['harvest_date']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'due_date', 'planting_plan', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'description']
    date_hierarchy = 'due_date'

