from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager['User']):
    """Manager for email-based authentication users."""

    use_in_migrations = True

    def normalize_email_lower(self, email: str) -> str:
        return self.normalize_email(email).lower().strip()

    def _create_user(self, email: str, password: str | None, **extra_fields: object) -> 'User':
        if not email:
            raise ValueError('The email field must be set.')
        normalized_email = self.normalize_email_lower(email)
        user = self.model(email=normalized_email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields: object) -> 'User':
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields: object) -> 'User':
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model using email as the unique login identifier."""

    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ['email']

    def save(self, *args: object, **kwargs: object) -> None:
        self.email = User.objects.normalize_email_lower(self.email)
        super().save(*args, **kwargs)

    @property
    def display_label(self) -> str:
        return self.display_name or self.email

    def __str__(self) -> str:
        return self.display_label
