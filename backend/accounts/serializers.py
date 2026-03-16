from __future__ import annotations

import re
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils import translation
from django.utils.text import slugify
from django.utils.translation import gettext as _
from rest_framework import serializers

User = get_user_model()
_username_validator = UnicodeUsernameValidator()
_password_field_kwargs = {'write_only': True}
if getattr(settings, 'DJANGO_ENV', 'production') != 'development':
    _password_field_kwargs['min_length'] = 8


def _de(message: str) -> str:
    with translation.override('de'):
        return _(message)


def normalize_email_lower(email: str) -> str:
    return User.objects.normalize_email(email).lower().strip()


def build_username_from_email(email: str) -> str:
    local_part = email.split('@', 1)[0]
    base = slugify(local_part).replace('-', '_')
    if not base:
        base = 'user'

    base = re.sub(r'[^\w.@+-]', '', base)
    max_base_length = 150 - 9
    candidate = base[:max_base_length]

    while True:
        suffix = uuid.uuid4().hex[:8]
        username = f'{candidate}_{suffix}'
        try:
            _username_validator(username)
        except Exception:  # noqa: BLE001
            continue
        if not User.objects.filter(username=username).exists():
            return username


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'display_name', 'display_label', 'is_active')
        read_only_fields = fields

    def get_display_name(self, obj: User) -> str:
        full_name = f'{obj.first_name} {obj.last_name}'.strip()
        return full_name

    def get_display_label(self, obj: User) -> str:
        full_name = self.get_display_name(obj)
        return full_name or obj.email or obj.username


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    display_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(**_password_field_kwargs)
    password_confirm = serializers.CharField(**_password_field_kwargs)

    def validate_email(self, value: str) -> str:
        normalized = normalize_email_lower(value)
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError(_de(_('An account with this email already exists.')))
        return normalized

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': _de(_('Passwords do not match.'))})
        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data: dict[str, str]) -> User:
        display_name = validated_data.get('display_name', '').strip()
        return User.objects.create_user(
            username=build_username_from_email(validated_data['email']),
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=display_name,
            is_active=False,
        )


class ActivateSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ResendActivationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(**_password_field_kwargs)
    password_confirm = serializers.CharField(**_password_field_kwargs)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': _de(_('Passwords do not match.'))})
        validate_password(attrs['password'])
        return attrs
