"""Accounts admin module."""

from django.contrib import admin

from .models import UserProjectSettings


@admin.register(UserProjectSettings)
class UserProjectSettingsAdmin(admin.ModelAdmin):
	"""Admin interface configuration for UserProjectSettings model."""

	list_display = ['user', 'default_project', 'last_project', 'updated_at']
	search_fields = ['user__email', 'user__username', 'default_project__name', 'last_project__name']
