"""DRF serializers for the farm app API."""

from rest_framework import serializers

from .models import Project, ProjectInvitation, ProjectMembership


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'slug', 'description', 'is_active', 'deleted_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'is_active', 'deleted_at', 'created_at', 'updated_at']


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_display_name = serializers.CharField(source='user.display_name', read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ['id', 'user', 'user_email', 'user_display_name', 'project', 'role', 'created_at']
        read_only_fields = ['id', 'created_at', 'project']


class ProjectInvitationSerializer(serializers.ModelSerializer):
    resolved_status = serializers.CharField(read_only=True)

    class Meta:
        model = ProjectInvitation
        fields = [
            'id',
            'project',
            'email',
            'email_normalized',
            'role',
            'token',
            'status',
            'resolved_status',
            'invited_by',
            'accepted_by',
            'accepted_at',
            'expires_at',
            'revoked_at',
            'revoked_by',
            'message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'token',
            'status',
            'email_normalized',
            'accepted_by',
            'accepted_at',
            'expires_at',
            'revoked_at',
            'revoked_by',
            'created_at',
            'updated_at',
            'project',
            'invited_by',
        ]


class InvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField()
