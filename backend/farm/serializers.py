"""DRF serializers for the farm app API."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .enum_normalization import normalize_seed_rate_unit
from .seed_units import (
    SEED_PACKAGE_UNIT_GRAMS,
    SEED_PACKAGE_UNIT_SEEDS,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
    SEED_RATE_UNITS,
)

from .models import (
    Bed,
    BedLayout,
    FieldLayout,
    Culture,
    CultureSupplierData,
    Field,
    Location,
    MediaFile,
    NoteAttachment,
    PlantingPlan,
    Supplier,
    Task,
    SeedPackage,
    PublicCulture,
    Project,
    ProjectMembership,
    ProjectInvitation,
    is_supplier_domain,
)


def _resolve_active_project_from_serializer(serializer) -> Project | None:
    """Resolve active project from serializer context or bound instance."""
    request = serializer.context.get('request')
    if request is not None:
        active_project = getattr(request, 'active_project', None)
        if active_project is not None:
            return active_project
    instance = getattr(serializer, 'instance', None)
    if instance is not None and hasattr(instance, 'project'):
        return instance.project
    return None


class AuditUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    display_name = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()

    def get_display_name(self, obj) -> str:
        full_name = f'{obj.first_name or ""} {obj.last_name or ""}'.strip()
        return full_name or obj.username

    def get_display_label(self, obj) -> str:
        full_name = self.get_display_name(obj)
        if full_name:
            return f'{full_name} ({obj.email})'
        return obj.email or obj.username


class CentimetersField(serializers.FloatField):
    """Expose meter-based model fields as centimeters in the API."""
    
    def to_representation(self, value):
        if value is None:
            return None
        return float(value) * 100.0
    
    def to_internal_value(self, data):
        cm_value = super().to_internal_value(data)
        return cm_value / 100.0


class LocalizedDecimalField(serializers.DecimalField):
    """Decimal field that accepts comma decimals and returns float JSON values."""

    default_error_messages = {
        'invalid': 'Please enter a valid numeric value, e.g. 3.9.',
    }

    def to_internal_value(self, data):
        normalized = data
        if isinstance(data, str):
            normalized = data.strip().replace(',', '.')
        return super().to_internal_value(normalized)

    def to_representation(self, value):
        decimal_value = super().to_representation(value)
        if decimal_value is None:
            return None
        return float(decimal_value)



class LocationSerializer(serializers.ModelSerializer):
    @staticmethod
    def _parse_coordinate(value, field_name: str):
        if value in (None, ''):
            return None
        if isinstance(value, str):
            value = value.strip().replace(',', '.')
            if value == '':
                return None
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError({field_name: f'{field_name.capitalize()} must be a valid number.'}) from exc

    def to_internal_value(self, data):
        payload = data.copy() if isinstance(data, dict) else data
        if isinstance(payload, dict):
            if 'latitude' in payload:
                payload['latitude'] = self._parse_coordinate(payload.get('latitude'), 'latitude')
            if 'longitude' in payload:
                payload['longitude'] = self._parse_coordinate(payload.get('longitude'), 'longitude')
        return super().to_internal_value(payload)

    def validate_latitude(self, value):
        if value is None:
            return value
        if not (-90 <= value <= 90):
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value):
        if value is None:
            return value
        if not (-180 <= value <= 180):
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Location
        fields = '__all__'
        extra_kwargs = {'project': {'required': False}}


class SupplierSerializer(serializers.ModelSerializer):
    created = serializers.BooleanField(read_only=True, default=False)
    homepage_url = serializers.CharField(required=False, allow_blank=True, max_length=200)
    
    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    def validate_allowed_domains(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Bitte geben Sie eine Liste von Domains an.')
        normalized = Supplier.normalize_allowed_domains(value)
        invalid = [domain for domain in normalized if not Supplier._is_valid_domain(Supplier._normalize_domain(domain))]
        if invalid:
            raise serializers.ValidationError('Domains müssen gültige Hostnamen ohne Schema oder Pfad sein.')
        return normalized

    def validate_homepage_url(self, value):
        homepage_url = (value or '').strip()
        if not homepage_url:
            return ''
        if not homepage_url.startswith(('http://', 'https://')):
            homepage_url = f'https://{homepage_url}'
        from django.core.validators import URLValidator

        try:
            URLValidator()(homepage_url)
        except ValidationError as exc:
            raise serializers.ValidationError('Bitte geben Sie eine gültige URL ein.') from exc
        return homepage_url

    def validate_name(self, value):
        from .utils import normalize_supplier_name

        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('Dieses Feld ist erforderlich.')
        project = _resolve_active_project_from_serializer(self)
        if project is None:
            return name
        normalized = normalize_supplier_name(name) or ''
        queryset = Supplier.objects.filter(project=project, name_normalized=normalized)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ein Lieferant mit diesem Namen existiert bereits.')
        return name


    class Meta:
        model = Supplier
        fields = ['id', 'name', 'homepage_url', 'slug', 'allowed_domains', 'created_at', 'updated_at', 'created']
        read_only_fields = ['created_at', 'updated_at', 'slug']


class FieldSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Field
        fields = '__all__'
        extra_kwargs = {
            'project': {'required': False},
            'name': {'label': 'Parzelle'},
        }
    
    def validate_area_sqm(self, value):
        if value is not None:
            if value < Field.MIN_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must be at least {Field.MIN_AREA_SQM} sqm.'
                )
            if value > Field.MAX_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must not exceed {Field.MAX_AREA_SQM} sqm (100 hectares).'
                )
            if value.as_tuple().exponent < -1:
                raise serializers.ValidationError('Area must have at most one decimal place for fields.')
        return value

    def validate_length_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Length must be greater than or equal to 0.')
        return value

    def validate_width_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Width must be greater than or equal to 0.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if project is not None and location is not None and location.project_id != project.id:
            raise serializers.ValidationError({'location': 'Location does not belong to the active project.'})
        return attrs


class BedSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Bed
        fields = '__all__'
        extra_kwargs = {
            'project': {'required': False},
            'field': {'label': 'Parzelle'},
        }

    def validate_area_sqm(self, value):
        if value is not None:
            if value < Bed.MIN_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must be at least {Bed.MIN_AREA_SQM} sqm.'
                )
            if value > Bed.MAX_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must not exceed {Bed.MAX_AREA_SQM} sqm (1 hectare).'
                )
            if value.as_tuple().exponent < -1:
                raise serializers.ValidationError('Area must have at most one decimal place for beds.')
        return value

    def validate_length_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Length must be greater than or equal to 0.')
        return value

    def validate_width_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Width must be greater than or equal to 0.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        field = attrs.get('field') or getattr(self.instance, 'field', None)
        if project is not None and field is not None and field.project_id != project.id:
            raise serializers.ValidationError({'field': 'Field does not belong to the active project.'})
        return attrs


class FieldLayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldLayout
        fields = [
            'id',
            'field',
            'location',
            'x',
            'y',
            'version',
            'scale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        field = attrs.get('field') or getattr(self.instance, 'field', None)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if field and location and field.location_id != location.id:
            raise serializers.ValidationError('Layout location must match the field location.')
        return attrs


class BedLayoutSerializer(serializers.ModelSerializer):
    field_id = serializers.IntegerField(source='bed.field_id', read_only=True)

    class Meta:
        model = BedLayout
        fields = [
            'id',
            'bed',
            'location',
            'field_id',
            'x',
            'y',
            'version',
            'scale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'field_id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bed = attrs.get('bed') or getattr(self.instance, 'bed', None)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if bed and location and bed.field.location_id != location.id:
            raise serializers.ValidationError('Layout location must match the bed location.')
        return attrs


class SeedPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeedPackage
        fields = [
            'id',
            'culture',
            'size_value',
            'size_unit',
            'evidence_text',
            'last_seen_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []
        extra_kwargs = {'culture': {'required': False}, 'size_unit': {'default': SeedPackage.UNIT_GRAMS}}






    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)

        culture = attrs.get('culture')
        if culture is None and self.instance is not None:
            culture = self.instance.culture
        size_value = attrs.get('size_value')
        size_unit = attrs.get('size_unit')

        if project is not None and culture is not None and culture.project_id != project.id:
            raise serializers.ValidationError({'culture': 'Culture does not belong to the active project.'})

        if culture is None or size_value is None or size_unit is None:
            return attrs

        existing = SeedPackage.objects.filter(
            culture=culture,
            size_value=size_value,
            size_unit=size_unit,
        )

        raw_initial_data = getattr(self, 'initial_data', None)
        incoming_id = raw_initial_data.get('id') if isinstance(raw_initial_data, dict) else None
        if incoming_id is not None:
            try:
                incoming_id = int(incoming_id)
            except (TypeError, ValueError):
                incoming_id = None

        if incoming_id is not None:
            existing = existing.exclude(pk=incoming_id)
        elif self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        elif raw_initial_data is None:
            # Nested serializer items in Culture updates do not reliably include initial_data.
            # CultureSerializer handles de-duplication before replacing packages, so skip here.
            return attrs

        if existing.exists():
            raise serializers.ValidationError('The fields culture, size_value, size_unit must make a unique set.')

        return attrs


class CultureSupplierDataSerializer(serializers.ModelSerializer):
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='supplier',
        write_only=True,
        required=False,
        allow_null=True,
    )
    supplier_name_input = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CultureSupplierData
        fields = [
            'id',
            'culture',
            'project',
            'supplier',
            'supplier_id',
            'supplier_name',
            'supplier_name_input',
            'supplier_url',
            'supplier_product_name',
            'supplier_product_url',
            'packaging_sizes',
            'germination_rate',
            'price',
            'notes',
            'source_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'project']
        extra_kwargs = {'culture': {'required': False}}
        validators = []

    def _resolve_culture_for_validation(self, attrs):
        culture = attrs.get('culture')
        if culture is not None:
            return culture
        if self.instance is not None:
            return self.instance.culture
        return self.context.get('parent_culture')

    def _validate_unique_culture_supplier(self, attrs):
        culture = self._resolve_culture_for_validation(attrs)
        supplier = attrs.get('supplier') or (self.instance.supplier if self.instance is not None else None)
        if culture is None or supplier is None:
            return

        queryset = CultureSupplierData.objects.filter(culture=culture, supplier=supplier)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError({
                'supplier_id': 'Supplier data for this culture already exists.',
            })

    def validate(self, attrs):
        attrs = super().validate(attrs)
        raw_initial_data = getattr(self, 'initial_data', None)
        if isinstance(raw_initial_data, dict) and 'thousand_kernel_weight_g' in raw_initial_data:
            raise serializers.ValidationError({
                'thousand_kernel_weight_g': 'Supplier-specific thousand-kernel weight is no longer supported.',
            })
        project = _resolve_active_project_from_serializer(self)
        culture = self._resolve_culture_for_validation(attrs)
        supplier = attrs.get('supplier') or (self.instance.supplier if self.instance is not None else None)
        if project is not None and culture is not None and culture.project_id != project.id:
            raise serializers.ValidationError({'culture': 'Culture does not belong to the active project.'})
        if project is not None and supplier is not None and supplier.project_id != project.id:
            raise serializers.ValidationError({'supplier_id': 'Supplier does not belong to the active project.'})
        supplier_name_input = attrs.pop('supplier_name_input', None)
        if not attrs.get('supplier') and supplier_name_input:
            from .utils import normalize_supplier_name

            project = _resolve_active_project_from_serializer(self)
            if project is None:
                raise serializers.ValidationError({'supplier': 'Supplier is required.'})

            normalized = normalize_supplier_name(supplier_name_input) or ''
            try:
                with transaction.atomic():
                    supplier, _ = Supplier.objects.get_or_create(
                        project=project,
                        name_normalized=normalized,
                        defaults={
                            'name': supplier_name_input.strip(),
                            'homepage_url': 'https://example.invalid',
                            'project': project,
                        },
                    )
            except IntegrityError as exc:
                supplier = Supplier.objects.filter(project=project, name_normalized=normalized).first()
                if supplier is None:
                    raise serializers.ValidationError({'supplier': 'Lieferant konnte nicht gespeichert werden.'}) from exc
            attrs['supplier'] = supplier
            attrs['supplier_name'] = supplier.name

        self._validate_unique_culture_supplier(attrs)
        return attrs



class PublicCultureSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'name',
            'variety',
            'notes',
            'seed_supplier',
            'supplier_name',
            'crop_family',
            'nutrient_demand',
            'cultivation_types',
            'cultivation_type',
            'growth_duration_days',
            'harvest_duration_days',
            'propagation_duration_days',
            'harvest_method',
            'expected_yield',
            'allow_deviation_delivery_weeks',
            'distance_within_row_m',
            'row_spacing_m',
            'sowing_depth_m',
            'seed_rate_value',
            'seed_rate_unit',
            'seed_rate_by_cultivation',
            'sowing_calculation_safety_percent',
            'thousand_kernel_weight_g',
            'seeding_requirement',
            'seeding_requirement_type',
            'display_color',
            'seed_packages',
            'version',
            'published_at',
            'created_at',
            'updated_at',
            'created_by_label',
            'source_project_culture',
            'source_project',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCulture) -> str:
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name().strip() or obj.created_by.username or obj.created_by.email or ''


class CultureSerializer(serializers.ModelSerializer):
    """Serializer for culture data with unit conversion and supplier helpers."""
    variety = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text='Culture variety (optional)'
    )
    distance_within_row_cm = CentimetersField(
        source='distance_within_row_m',
        required=False,
        allow_null=True,
        help_text='Distance within row in centimeters'
    )
    row_spacing_cm = CentimetersField(
        source='row_spacing_m',
        required=False,
        allow_null=True,
        help_text='Row spacing in centimeters'
    )
    sowing_depth_cm = CentimetersField(
        source='sowing_depth_m',
        required=False,
        allow_null=True,
        help_text='Sowing depth in centimeters'
    )
    
    image_file = serializers.SerializerMethodField()
    image_file_id = serializers.PrimaryKeyRelatedField(
        queryset=MediaFile.objects.all(),
        source='image_file',
        write_only=True,
        required=False,
        allow_null=True,
    )

    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='supplier',
        write_only=True,
        required=False,
        allow_null=True,
        help_text='Supplier ID (alternative to supplier_name)'
    )
    supplier_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text='Supplier name for get-or-create (alternative to supplier_id)'
    )

    origin_type = serializers.CharField(required=False, allow_blank=True)
    seed_rate_value = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Seed rate value (per m², per meter, or per plant, depending on unit)'
    )
    seed_rate_unit = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Unit for seed rate (e.g. 'g/m²', 'seeds/m', 'seeds_per_plant')"
    )
    cultivation_types = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=False,
    )
    seed_rate_by_cultivation = serializers.JSONField(required=False, allow_null=True)
    sowing_calculation_safety_percent = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Safety margin for seeding calculation in percent (0-100)'
    )
    seed_rate_direct_value = serializers.FloatField(required=False, allow_null=True)
    seed_rate_direct_unit = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sowing_calculation_safety_percent_direct = serializers.FloatField(required=False, allow_null=True)
    seed_rate_pre_cultivation_value = serializers.FloatField(required=False, allow_null=True)
    seed_rate_pre_cultivation_unit = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sowing_calculation_safety_percent_pre_cultivation = serializers.FloatField(required=False, allow_null=True)
    thousand_kernel_weight_g = LocalizedDecimalField(
        max_digits=6,
        decimal_places=2,
        required=False,
        allow_null=True,
        help_text='Weight of 1000 kernels in grams'
    )
    seeding_requirement = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Total seeding requirement (g or seeds, depending on type)'
    )
    seeding_requirement_type = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Type of seeding requirement (e.g. 'g', 'seeds')"
    )
    seed_packages = SeedPackageSerializer(many=True, required=False)
    supplier_data = serializers.SerializerMethodField()
    supplier_data_input = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )

    plants_per_m2 = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
        help_text='Calculated plants per square meter based on spacing (read-only)'
    )
    owned_public_culture_id = serializers.SerializerMethodField()
    
    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    def get_supplier_data(self, obj):
        rows = obj.supplier_data.all()
        return CultureSupplierDataSerializer(rows, many=True).data

    class Meta:
        model = Culture
        fields = '__all__'
        extra_kwargs = {'project': {'required': False}}
    
    def get_owned_public_culture_id(self, obj: Culture) -> int | None:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None

        if obj.source_public_culture_id:
            if obj.source_public_culture and obj.source_public_culture.created_by_id == user.id:
                return obj.source_public_culture_id
            return None

        linked_public = PublicCulture.objects.filter(
            source_project_culture=obj,
            created_by=user,
            status=PublicCulture.STATUS_PUBLISHED,
        ).order_by('-updated_at', '-id').values_list('id', flat=True).first()
        return linked_public



    def validate_seed_packages(self, value):
        seen: set[str] = set()
        normalized_packages = []
        quantum = Decimal('0.1')

        for idx, item in enumerate(value):
            raw_size_value = item.get('size_value')
            size_unit = item.get('size_unit') or SeedPackage.UNIT_GRAMS

            try:
                size_value = Decimal(str(raw_size_value))
            except (InvalidOperation, TypeError):
                raise serializers.ValidationError({idx: 'size_value must be a valid number.'})

            if size_value <= 0:
                raise serializers.ValidationError({idx: 'size_value must be > 0'})
            if size_unit not in {SEED_PACKAGE_UNIT_GRAMS, SEED_PACKAGE_UNIT_SEEDS}:
                raise serializers.ValidationError({idx: 'Unsupported package size unit.'})

            normalized_size = size_value
            if size_unit == SEED_PACKAGE_UNIT_GRAMS:
                normalized_size = size_value.quantize(quantum, rounding=ROUND_HALF_UP)
                if size_value != normalized_size:
                    raise serializers.ValidationError({idx: 'Gram package sizes must have at most one decimal place.'})

            uniqueness_key = f"{size_unit}:{normalized_size}"
            if uniqueness_key in seen:
                raise serializers.ValidationError({idx: 'Duplicate package size.'})
            seen.add(uniqueness_key)

            normalized_item = dict(item)
            normalized_item['size_unit'] = size_unit
            normalized_item['size_value'] = normalized_size
            normalized_item.pop('culture', None)
            normalized_packages.append(normalized_item)

        return normalized_packages

    def create(self, validated_data):
        supplier_data_input = validated_data.pop('supplier_data_input', [])
        seed_packages = validated_data.pop('seed_packages', [])
        culture = super().create(validated_data)
        if isinstance(supplier_data_input, list):
            for row in supplier_data_input:
                if not isinstance(row, dict):
                    continue
                row_data = dict(row)
                serializer = CultureSupplierDataSerializer(
                    data=row_data,
                    context={**self.context, 'parent_culture': culture},
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(culture=culture, project=culture.project)
        if isinstance(seed_packages, list):
            for package_data in seed_packages:
                if isinstance(package_data, dict):
                    package_data = dict(package_data)
                    package_data.pop('culture', None)
                    package_data.setdefault('project', culture.project)
                    SeedPackage.objects.create(culture=culture, **package_data)
        return culture

    def update(self, instance, validated_data):
        supplier_data_input = validated_data.pop('supplier_data_input', None)
        seed_packages = validated_data.pop('seed_packages', None)
        culture = super().update(instance, validated_data)
        if supplier_data_input is not None:
            existing_by_id = {row.id: row for row in culture.supplier_data.all()}
            seen_ids: set[int] = set()
            if isinstance(supplier_data_input, list):
                for row in supplier_data_input:
                    if not isinstance(row, dict):
                        continue
                    row_data = dict(row)
                    raw_row_id = row_data.get('id')
                    try:
                        row_id = int(raw_row_id)
                    except (TypeError, ValueError):
                        row_id = None
                    instance_row = existing_by_id.get(row_id) if row_id is not None else None
                    serializer = CultureSupplierDataSerializer(
                        instance=instance_row,
                        data=row_data,
                        context={**self.context, 'parent_culture': culture},
                        partial=instance_row is not None,
                    )
                    serializer.is_valid(raise_exception=True)
                    saved_row = serializer.save(culture=culture, project=culture.project)
                    seen_ids.add(saved_row.id)

            ids_to_delete = [row_id for row_id in existing_by_id if row_id not in seen_ids]
            if ids_to_delete:
                CultureSupplierData.objects.filter(id__in=ids_to_delete).delete()
        if seed_packages is not None:
            culture.seed_packages.all().delete()
            if isinstance(seed_packages, list):
                for package_data in seed_packages:
                    if isinstance(package_data, dict):
                        package_data = dict(package_data)
                        package_data.pop('culture', None)
                        package_data.setdefault('project', culture.project)
                        SeedPackage.objects.create(culture=culture, **package_data)
        return culture

    def validate_origin_type(self, value):
        if value in {None, ''}:
            if self.instance and self.instance.source_public_culture_id:
                return Culture.ORIGIN_IMPORTED
            return Culture.ORIGIN_MANUAL

        normalized = str(value).strip().lower()
        if normalized == Culture.ORIGIN_MANUAL:
            return Culture.ORIGIN_MANUAL
        if normalized == Culture.ORIGIN_IMPORTED or normalized.startswith('import'):
            return Culture.ORIGIN_IMPORTED
        return Culture.ORIGIN_MANUAL

    def validate_seed_rate_unit(self, value):
        """Normalize legacy seed rate unit values and validate supported units."""
        if value is None or value == '':
            return value

        normalized_value = normalize_seed_rate_unit(value)
        if normalized_value:
            value = normalized_value

        allowed_values = SEED_RATE_UNITS
        if value not in allowed_values:
            raise serializers.ValidationError('Unsupported seed rate unit.')
        return value
    def validate_growth_duration_days(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Growth duration must be non-negative.')
        return value
    
    def validate_harvest_duration_days(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Harvest duration must be non-negative.')
        return value
    
    def validate_germination_rate(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Germination rate must be between 0 and 100.')
        return value
    
    def validate_safety_margin(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Safety margin must be between 0 and 100.')
        return value
    
    def validate(self, attrs):
        """Validate cross-field rules and supplier get-or-create."""
        errors = {}
        from .utils import normalize_text

        raw_name = attrs.get(
            'name',
            getattr(self.instance, 'name', None) if self.instance else None,
        )
        normalized_name = normalize_text(raw_name)
        if not normalized_name:
            errors['name'] = 'Name is required.'
        else:
            attrs['name'] = ' '.join(str(raw_name).split())
            request = self.context.get('request')
            project = attrs.get('project')
            if project is None and request is not None:
                project = getattr(request, 'active_project', None)
            if project is None and self.instance is not None:
                project = self.instance.project

            if project is not None:
                instance_name_normalized = None
                if self.instance is not None:
                    instance_name_normalized = normalize_text(getattr(self.instance, 'name', None))

                # Keep existing duplicate records editable when the normalized name
                # is unchanged on update. This preserves compatibility with legacy
                # data that may already contain duplicates.
                if self.instance is not None and instance_name_normalized == normalized_name:
                    pass
                else:
                    existing_name_query = Culture.all_objects.filter(
                        project=project,
                        deleted_at__isnull=True,
                        name_normalized=normalized_name,
                    )
                    if self.instance is not None:
                        existing_name_query = existing_name_query.exclude(pk=self.instance.pk)
                    if existing_name_query.exists():
                        errors['name'] = 'A culture with this name already exists.'

        cultivation_types = attrs.get(
            'cultivation_types',
            getattr(self.instance, 'cultivation_types', None) if self.instance else None,
        )
        legacy_cultivation_type = attrs.get(
            'cultivation_type',
            getattr(self.instance, 'cultivation_type', '') if self.instance else '',
        )
        if cultivation_types is None:
            cultivation_types = [legacy_cultivation_type] if legacy_cultivation_type else []
        if not isinstance(cultivation_types, list):
            errors['cultivation_types'] = 'Cultivation types must be a list.'
        else:
            normalized_types = [str(item).strip() for item in cultivation_types if str(item).strip()]
            allowed_types = {'pre_cultivation', 'direct_sowing'}
            if not normalized_types:
                normalized_types = ['pre_cultivation']
            if len(set(normalized_types)) != len(normalized_types):
                errors['cultivation_types'] = 'Cultivation types must be unique.'
            elif any(item not in allowed_types for item in normalized_types):
                errors['cultivation_types'] = 'Cultivation types contain unsupported values.'
            else:
                attrs['cultivation_types'] = normalized_types
                attrs['cultivation_type'] = normalized_types[0]

        seed_rate_by_cultivation = attrs.get(
            'seed_rate_by_cultivation',
            getattr(self.instance, 'seed_rate_by_cultivation', None) if self.instance else None,
        )
        if seed_rate_by_cultivation is not None:
            if not isinstance(seed_rate_by_cultivation, dict):
                errors['seed_rate_by_cultivation'] = 'Seed rate by cultivation must be an object.'
            else:
                target_types = set(attrs.get('cultivation_types') or cultivation_types or [])
                if not set(seed_rate_by_cultivation.keys()).issubset(target_types):
                    errors['seed_rate_by_cultivation'] = 'Seed rate keys must be subset of cultivation_types.'
                else:
                    for method, payload in seed_rate_by_cultivation.items():
                        if not isinstance(payload, dict):
                            errors['seed_rate_by_cultivation'] = 'Seed rate entries must be objects.'
                            break
                        value = payload.get('value')
                        unit = payload.get('unit')
                        try:
                            parsed_value = float(value)
                        except (TypeError, ValueError):
                            errors['seed_rate_by_cultivation'] = 'Seed rate values must be numeric.'
                            break
                        if parsed_value <= 0:
                            errors['seed_rate_by_cultivation'] = 'Seed rate values must be positive.'
                            break
                        if method == 'pre_cultivation' and unit not in {
                            SEED_RATE_UNIT_G_PER_M2,
                            SEED_RATE_UNIT_G_PER_LFM,
                            SEED_RATE_UNIT_SEEDS_PER_M2,
                            SEED_RATE_UNIT_SEEDS_PER_LFM,
                            SEED_RATE_UNIT_SEEDS_PER_PLANT,
                        }:
                            errors['seed_rate_by_cultivation'] = 'Pre-cultivation seed rate unit is unsupported.'
                            break
                        if method == 'direct_sowing' and unit not in {
                            SEED_RATE_UNIT_G_PER_M2,
                            SEED_RATE_UNIT_G_PER_LFM,
                            SEED_RATE_UNIT_SEEDS_PER_M2,
                            SEED_RATE_UNIT_SEEDS_PER_LFM,
                        }:
                            errors['seed_rate_by_cultivation'] = 'Direct sowing seed rate unit is unsupported.'
                            break

                if 'seed_rate_by_cultivation' not in errors:
                    if 'pre_cultivation' in seed_rate_by_cultivation:
                        primary = seed_rate_by_cultivation['pre_cultivation']
                    elif 'direct_sowing' in seed_rate_by_cultivation:
                        primary = seed_rate_by_cultivation['direct_sowing']
                    else:
                        primary = None
                    if isinstance(primary, dict):
                        attrs['seed_rate_value'] = float(primary.get('value'))
                        attrs['seed_rate_unit'] = primary.get('unit')

        direct_value = attrs.get(
            'seed_rate_direct_value',
            getattr(self.instance, 'seed_rate_direct_value', None) if self.instance else None,
        )
        direct_unit = attrs.get(
            'seed_rate_direct_unit',
            getattr(self.instance, 'seed_rate_direct_unit', None) if self.instance else None,
        )
        pre_value = attrs.get(
            'seed_rate_pre_cultivation_value',
            getattr(self.instance, 'seed_rate_pre_cultivation_value', None) if self.instance else None,
        )
        pre_unit = attrs.get(
            'seed_rate_pre_cultivation_unit',
            getattr(self.instance, 'seed_rate_pre_cultivation_unit', None) if self.instance else None,
        )
        active_types = set(attrs.get('cultivation_types') or cultivation_types or [])

        if 'direct_sowing' in active_types and direct_value is None and direct_unit:
            errors['seed_rate_direct_value'] = 'Direct sowing seed rate value is required when direct sowing unit is set.'
        if 'direct_sowing' in active_types and direct_value is not None and not direct_unit:
            errors['seed_rate_direct_unit'] = 'Direct sowing seed rate unit is required when direct sowing value is set.'
        if direct_value is not None and direct_value <= 0:
            errors['seed_rate_direct_value'] = 'Direct sowing seed rate value must be greater than zero.'
        if direct_unit and direct_unit not in {
            SEED_RATE_UNIT_G_PER_M2,
            SEED_RATE_UNIT_G_PER_LFM,
            SEED_RATE_UNIT_SEEDS_PER_M2,
            SEED_RATE_UNIT_SEEDS_PER_LFM,
        }:
            errors['seed_rate_direct_unit'] = 'Direct sowing seed rate unit is unsupported.'

        if 'pre_cultivation' in active_types and pre_value is not None and not pre_unit:
            errors['seed_rate_pre_cultivation_unit'] = 'Pre-cultivation seed rate unit is required when pre-cultivation value is set.'
        if pre_value is not None and pre_value <= 0:
            errors['seed_rate_pre_cultivation_value'] = 'Pre-cultivation seed rate value must be greater than zero.'
        if pre_unit and pre_unit not in {
            SEED_RATE_UNIT_G_PER_M2,
            SEED_RATE_UNIT_G_PER_LFM,
            SEED_RATE_UNIT_SEEDS_PER_M2,
            SEED_RATE_UNIT_SEEDS_PER_LFM,
            SEED_RATE_UNIT_SEEDS_PER_PLANT,
        }:
            errors['seed_rate_pre_cultivation_unit'] = 'Pre-cultivation seed rate unit is unsupported.'

        # Handle supplier_name via get-or-create to keep imports ergonomic.
        # If supplier_id was explicitly provided (including null), respect it and
        # do not implicitly override from supplier_name.
        supplier_name = attrs.pop('supplier_name', None)
        supplier_explicitly_set = 'supplier' in attrs
        if supplier_name and not supplier_explicitly_set and not attrs.get('supplier'):
            from .utils import normalize_supplier_name
            project = attrs.get('project')
            if self.instance is not None:
                project = self.instance.project
            if project is None:
                request = self.context.get('request')
                project = getattr(request, 'active_project', None)
            if project is None:
                project, _ = Project.objects.get_or_create(
                    slug='gelawi-zwiebelzopf',
                    defaults={'name': 'Gelawi Zwiebelzopf', 'description': '', 'is_active': True},
                )
            normalized = normalize_supplier_name(supplier_name) or ''
            try:
                with transaction.atomic():
                    supplier, _created = Supplier.objects.get_or_create(
                        name_normalized=normalized,
                        project=project,
                        defaults={
                            'name': supplier_name,
                            'homepage_url': 'https://example.invalid',
                            'project': project,
                        },
                    )
            except IntegrityError as exc:
                supplier = Supplier.objects.filter(project=project, name_normalized=normalized).first()
                if supplier is None:
                    raise serializers.ValidationError({'supplier': 'Lieferant konnte nicht gespeichert werden.'}) from exc
            attrs['supplier'] = supplier

        # Keep variety optional for compatibility with existing API/tests.
        if 'variety' not in attrs and not self.instance:
            attrs['variety'] = ''
        elif 'variety' in attrs:
            attrs['variety'] = (attrs.get('variety') or '').strip()

        if errors:
            raise serializers.ValidationError(errors)

        supplier = attrs.get('supplier', getattr(self.instance, 'supplier', None) if self.instance else None)
        project = attrs.get('project') or _resolve_active_project_from_serializer(self)
        if project is not None and supplier is not None and supplier.project_id != project.id:
            errors['supplier'] = 'Supplier does not belong to the active project.'
        selected_supplier = attrs.get(
            'selected_seed_demand_supplier',
            getattr(self.instance, 'selected_seed_demand_supplier', None) if self.instance else None,
        )
        if project is not None and selected_supplier is not None and selected_supplier.project_id != project.id:
            errors['selected_seed_demand_supplier'] = 'Selected supplier does not belong to the active project.'
        supplier_product_url = attrs.get(
            'supplier_product_url',
            getattr(self.instance, 'supplier_product_url', None) if self.instance else None,
        )
        if supplier_product_url:
            if not supplier or not is_supplier_domain(supplier_product_url, supplier):
                errors['supplier_product_url'] = {
                    'code': 'supplier_product_url_domain_mismatch',
                    'message': 'Supplier product URL must match supplier allowed domains.',
                }

        if errors:
            raise serializers.ValidationError(errors)

        seeding_requirement = attrs.get('seeding_requirement', getattr(self.instance, 'seeding_requirement', None) if self.instance else None)
        seeding_requirement_type = attrs.get('seeding_requirement_type', getattr(self.instance, 'seeding_requirement_type', '') if self.instance else '')
        if seeding_requirement is None and seeding_requirement_type:
            errors['seeding_requirement'] = 'Seeding requirement value is required when seeding requirement type is set.'
        if seeding_requirement is not None and not seeding_requirement_type:
            errors['seeding_requirement_type'] = 'Seeding requirement type is required when seeding requirement is set.'

        if errors:
            raise serializers.ValidationError(errors)

        try:
            model_field_names = {field.name for field in Culture._meta.fields}

            if self.instance:
                temp_attrs = {}
                for field_name in model_field_names:
                    if field_name in attrs:
                        temp_attrs[field_name] = attrs[field_name]
                    elif hasattr(self.instance, field_name):
                        temp_attrs[field_name] = getattr(self.instance, field_name)
                temp_instance = Culture(**temp_attrs)
                temp_instance.pk = self.instance.pk
            else:
                temp_instance = Culture(**{k: v for k, v in attrs.items() if k in model_field_names})
            
            # Validate without mutating the real instance.
            temp_instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict) from e
        
        return attrs


class PlantingPlanSerializer(serializers.ModelSerializer):
    culture_name = serializers.CharField(source='culture.name', read_only=True)
    culture_variety = serializers.CharField(source='culture.variety', read_only=True, allow_blank=True)
    culture_display_color = serializers.CharField(source='culture.display_color', read_only=True, allow_blank=True)
    culture_propagation_duration_days = serializers.IntegerField(source='culture.propagation_duration_days', read_only=True, allow_null=True)
    culture_cultivation_type = serializers.CharField(source='culture.cultivation_type', read_only=True, allow_blank=True)
    culture_cultivation_types = serializers.ListField(source='culture.cultivation_types', child=serializers.CharField(), read_only=True)
    bed_name = serializers.CharField(source='bed.name', read_only=True)
    plants_count = serializers.SerializerMethodField(read_only=True)
    note_attachment_count = serializers.IntegerField(read_only=True)
    created_by_user = AuditUserSerializer(source='created_by', read_only=True)
    updated_by_user = AuditUserSerializer(source='updated_by', read_only=True)
    
    # Write-only fields for area input
    area_input_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        write_only=True,
        required=False,
        help_text='Area value to input (m² or plant count depending on unit)'
    )
    area_input_unit = serializers.ChoiceField(
        choices=[('M2', 'm²'), ('PLANTS', 'Plants')],
        write_only=True,
        required=False,
        help_text='Unit for area input: M2 (square meters) or PLANTS (plant count)'
    )

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['project', 'harvest_date', 'harvest_end_date', 'created_by', 'updated_by']
    
    def get_plants_count(self, obj):
        """Compute plant count from area and culture spacing."""
        if not obj.area_usage_sqm or not obj.culture:
            return None
        plants_per_m2 = obj.culture.plants_per_m2
        if not plants_per_m2 or plants_per_m2 <= 0:
            return None
        return round(obj.area_usage_sqm * plants_per_m2)

    def validate(self, attrs):
        project = _resolve_active_project_from_serializer(self)
        culture = attrs.get('culture') or (self.instance.culture if self.instance else None)
        bed = attrs.get('bed') or (self.instance.bed if self.instance else None)
        if project is not None and culture is not None and culture.project_id != project.id:
            raise serializers.ValidationError({'culture': 'Culture does not belong to the active project.'})
        if project is not None and bed is not None and bed.project_id != project.id:
            raise serializers.ValidationError({'bed': 'Bed does not belong to the active project.'})
        
        # Handle area input conversion
        area_input_value = attrs.pop('area_input_value', None)
        area_input_unit = attrs.pop('area_input_unit', None)
        
        # Validate area input fields
        if area_input_value is not None:
            # Value must be positive
            if area_input_value <= 0:
                raise serializers.ValidationError({
                    'area_input_value': 'Area input value must be greater than 0.'
                })
            
            # Unit is required when value is provided
            if not area_input_unit:
                raise serializers.ValidationError({
                    'area_input_unit': (
                        'Area input unit is required when '
                        'area_input_value is provided.'
                    )
                })
            
            # Get culture (could be from attrs for create, or from instance for update)
            culture = attrs.get('culture')
            if not culture and self.instance:
                culture = self.instance.culture
            
            # Convert based on unit
            if area_input_unit == 'M2':
                # Direct assignment
                attrs['area_usage_sqm'] = area_input_value
            elif area_input_unit == 'PLANTS':
                # Validate culture is present
                if not culture:
                    raise serializers.ValidationError({
                        'area_input_unit': 'Culture must be selected to input area as plant count.'
                    })
                
                # Validate culture has valid spacing
                plants_per_m2 = culture.plants_per_m2
                if plants_per_m2 is None or plants_per_m2 <= 0:
                    raise serializers.ValidationError({
                        'area_input_unit': (
                            'Culture spacing data is missing or invalid. '
                            'Cannot calculate area from plant count.'
                        )
                    })
                
                # Calculate area in m²: plants / (plants_per_m2)
                attrs['area_usage_sqm'] = area_input_value / plants_per_m2
        
        model_field_names = {field.name for field in PlantingPlan._meta.fields}
        if self.instance:
            validation_attrs = {}
            for field_name in model_field_names:
                if field_name in attrs:
                    validation_attrs[field_name] = attrs[field_name]
                elif hasattr(self.instance, field_name):
                    validation_attrs[field_name] = getattr(self.instance, field_name)
            instance = PlantingPlan(
                **{name: value for name, value in validation_attrs.items() if name in model_field_names}
            )
            instance.pk = self.instance.pk
        else:
            instance = PlantingPlan(**{name: value for name, value in attrs.items() if name in model_field_names})

        if not instance.culture_id or not instance.bed_id:
            return attrs

        try:
            instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict) from e
        
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    planting_plan_name = serializers.CharField(source='planting_plan.__str__', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Task
        fields = '__all__'

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        planting_plan = attrs.get('planting_plan') or getattr(self.instance, 'planting_plan', None)
        if project is not None and planting_plan is not None and planting_plan.project_id != project.id:
            raise serializers.ValidationError({'planting_plan': 'Planting plan does not belong to the active project.'})
        return attrs


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


class SeedDemandPackageSelectionSerializer(serializers.Serializer):
    size_value = serializers.FloatField()
    size_unit = serializers.CharField()
    count = serializers.IntegerField()


class SeedDemandPackageSuggestionSerializer(serializers.Serializer):
    selection = SeedDemandPackageSelectionSerializer(many=True)
    total_amount = serializers.FloatField()
    overage = serializers.FloatField()
    pack_count = serializers.IntegerField()
    unit = serializers.CharField(required=False)


class SeedDemandSerializer(serializers.Serializer):
    """Read-only serializer for aggregated seed demand per culture."""
    culture_id = serializers.IntegerField()
    culture_name = serializers.CharField()
    variety = serializers.CharField(allow_blank=True, allow_null=True)
    supplier = serializers.CharField(allow_blank=True, allow_null=True)
    selected_supplier_id = serializers.IntegerField(allow_null=True, required=False)
    supplier_options = serializers.ListField(child=serializers.DictField(), required=False)
    required_amount_value = serializers.FloatField(allow_null=True)
    required_amount_unit = serializers.CharField(allow_null=True)
    total_grams = serializers.FloatField(allow_null=True)
    seed_packages = serializers.ListField(child=serializers.DictField(), required=False)
    package_suggestion = SeedDemandPackageSuggestionSerializer(allow_null=True, required=False)
    packages_needed = serializers.IntegerField(allow_null=True, required=False)
    warning = serializers.CharField(allow_null=True)


class NoteAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for note image attachments."""

    image_url = serializers.SerializerMethodField()
    created_by_user = AuditUserSerializer(source='created_by', read_only=True)
    updated_by_user = AuditUserSerializer(source='updated_by', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = NoteAttachment
        fields = [
            "id",
            "planting_plan",
            "image",
            "image_url",
            "caption",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "created_by_user",
            "updated_by_user",
            "width",
            "height",
            "size_bytes",
            "mime_type",
        ]
        read_only_fields = [
            "id",
            "planting_plan",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "width",
            "height",
            "size_bytes",
            "mime_type",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


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


class CultureRestoreSerializer(serializers.Serializer):
    history_id = serializers.IntegerField()


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'slug', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'is_active', 'created_at', 'updated_at']


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
