"""DTO serializers for the public-culture import preview/apply endpoints."""

from rest_framework import serializers


class CultureImportPreviewItemSerializer(serializers.Serializer):
    """Preview result for a single culture import item."""
    status = serializers.ChoiceField(
        choices=['create', 'update_candidate'],
        help_text='Whether this culture would be created or matches an existing one'
    )
    matched_culture_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='ID of matched culture (only for update_candidate status)'
    )
    diff = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='List of fields that would change (only for update_candidate)'
    )
    import_data = serializers.DictField(
        help_text='The culture data that would be imported'
    )


class CultureImportApplySummarySerializer(serializers.Serializer):
    """Summary of a culture import apply operation."""
    created_count = serializers.IntegerField(help_text='Number of cultures created')
    updated_count = serializers.IntegerField(help_text='Number of cultures updated')
    skipped_count = serializers.IntegerField(help_text='Number of cultures skipped')
    errors = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of errors encountered during import'
    )
