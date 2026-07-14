"""DRF serializers for history/revision API payloads."""

from rest_framework import serializers


class CultureHistoryEntrySerializer(serializers.Serializer):
    history_id = serializers.IntegerField()
    culture_id = serializers.IntegerField(required=False)
    history_date = serializers.DateTimeField()
    history_type = serializers.CharField()
    history_user = serializers.CharField(allow_null=True)
    summary = serializers.CharField()
    object_type = serializers.CharField(required=False, allow_blank=True)
    object_display_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    action = serializers.CharField(required=False, allow_blank=True)
    actor_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_current_version = serializers.BooleanField(required=False)
    changes = serializers.ListField(child=serializers.DictField(), required=False)


class CultureRestoreSerializer(serializers.Serializer):
    history_id = serializers.IntegerField()
