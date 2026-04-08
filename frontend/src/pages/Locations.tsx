import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, plantingPlanAPI, type Bed, type Culture, type Field, type Location, type PlantingPlan } from '../api/api';
import PageHelp from '../components/help/PageHelp';
import PageHeader from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import { useTranslation } from '../i18n';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { deriveLocationTasks, type DerivedLocationTask } from './locationDerivedTasks';

type SoilType = NonNullable<Location['soil_type']>;
type Exposure = NonNullable<Location['exposure']>;

interface LocationFormState {
  name: string;
  latitude: string;
  longitude: string;
  address: string;
  description: string;
  soil_type: SoilType | '';
  exposure: Exposure | '';
  notes: string;
}

const SOIL_OPTIONS: Array<{ value: SoilType; labelKey: string }> = [
  { value: 'sand', labelKey: 'sand' },
  { value: 'loam', labelKey: 'loam' },
  { value: 'clay', labelKey: 'clay' },
];

const EXPOSURE_OPTIONS: Array<{ value: Exposure; labelKey: string }> = [
  { value: 'north', labelKey: 'north' },
  { value: 'south', labelKey: 'south' },
  { value: 'east', labelKey: 'east' },
  { value: 'west', labelKey: 'west' },
  { value: 'flat', labelKey: 'flat' },
];

const emptyForm: LocationFormState = {
  name: '',
  latitude: '',
  longitude: '',
  address: '',
  description: '',
  soil_type: '',
  exposure: '',
  notes: '',
};

const parseCoordinateInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateCoordinateRange = (value: number | null, min: number, max: number): boolean =>
  value === null || (value >= min && value <= max);

const formatCoordinate = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);

const formatTaskDate = (value: string, locale: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
};

const toFormState = (location: Location | null): LocationFormState => ({
  name: location?.name ?? '',
  latitude: typeof location?.latitude === 'number' ? String(location.latitude) : '',
  longitude: typeof location?.longitude === 'number' ? String(location.longitude) : '',
  address: location?.address ?? '',
  description: location?.description ?? '',
  soil_type: location?.soil_type ?? '',
  exposure: location?.exposure ?? '',
  notes: location?.notes ?? '',
});

function Locations(): React.ReactElement {
  const { t, i18n } = useTranslation(['locations', 'common']);
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formState, setFormState] = useState<LocationFormState>(emptyForm);
  const [formError, setFormError] = useState<string>('');

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [locationsResponse, fieldsResponse, bedsResponse, plansResponse, culturesResponse] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
        plantingPlanAPI.list(),
        cultureAPI.list(),
      ]);
      setLocations(locationsResponse.data.results);
      setFields(fieldsResponse.data.results);
      setBeds(bedsResponse.data.results);
      setPlantingPlans(plansResponse.data.results);
      setCultures(culturesResponse.data.results);
    } catch {
      setError(t('locations:errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tasksByLocation = useMemo(
    () =>
      deriveLocationTasks({
        locations,
        fields,
        beds,
        plantingPlans,
        cultures,
      }),
    [beds, cultures, fields, locations, plantingPlans],
  );

  const openCreateDialog = (): void => {
    setEditingLocation(null);
    setFormState(emptyForm);
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (location: Location): void => {
    setEditingLocation(location);
    setFormState(toFormState(location));
    setFormError('');
    setDialogOpen(true);
  };

  const closeDialog = (): void => {
    setDialogOpen(false);
    setEditingLocation(null);
    setFormState(emptyForm);
    setFormError('');
  };

  const validateForm = (): { latitude: number | null; longitude: number | null } | null => {
    if (!formState.name.trim()) {
      setFormError(t('locations:validation.nameRequired'));
      return null;
    }
    const latitude = parseCoordinateInput(formState.latitude);
    const longitude = parseCoordinateInput(formState.longitude);
    if (formState.latitude.trim() && latitude === null) {
      setFormError(t('locations:validation.coordinateInvalid', { field: t('locations:columns.latitude') }));
      return null;
    }
    if (formState.longitude.trim() && longitude === null) {
      setFormError(t('locations:validation.coordinateInvalid', { field: t('locations:columns.longitude') }));
      return null;
    }
    if (!validateCoordinateRange(latitude, -90, 90)) {
      setFormError(t('locations:validation.latitudeRange'));
      return null;
    }
    if (!validateCoordinateRange(longitude, -180, 180)) {
      setFormError(t('locations:validation.longitudeRange'));
      return null;
    }
    return { latitude, longitude };
  };

  const saveLocation = async (): Promise<void> => {
    const parsed = validateForm();
    if (!parsed) return;
    const payload: Location = {
      name: formState.name.trim(),
      latitude: parsed.latitude ?? undefined,
      longitude: parsed.longitude ?? undefined,
      address: formState.address.trim(),
      description: formState.description.trim(),
      soil_type: formState.soil_type || null,
      exposure: formState.exposure || null,
      notes: formState.notes.trim(),
    };

    try {
      if (editingLocation?.id) {
        await locationAPI.update(editingLocation.id, payload);
      } else {
        await locationAPI.create(payload);
      }
      closeDialog();
      await loadData();
    } catch {
      setFormError(t('locations:errors.save'));
    }
  };

  const deleteLocation = async (locationId: number): Promise<void> => {
    if (!window.confirm(t('locations:confirmDelete'))) return;
    try {
      await locationAPI.delete(locationId);
      await loadData();
    } catch {
      setError(t('locations:errors.delete'));
    }
  };

  const renderTaskLine = (task: DerivedLocationTask): string => {
    const taskTitle = t(`locations:taskTitles.${task.type}`);
    const culture = task.cultureName ? ` – ${task.cultureName}` : '';
    return `${formatTaskDate(task.date, numberLocale)} – ${taskTitle}${culture}`;
  };

  return (
    <PageContainer>
      <Box sx={{ width: '100%' }}>
        <PageHeader
          title={t('locations:title')}
          actions={(
            <>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                {t('locations:addButton')}
              </Button>
              <PageHelp pageKey="locations" />
            </>
          )}
        />

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? <Typography>{t('common:messages.loading')}</Typography> : null}

        {!loading && locations.length === 0 ? (
          <Alert severity="info">{t('locations:emptyState')}</Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: 2,
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            {locations.map((location) => {
              const hasCoordinates =
                typeof location.latitude === 'number' && typeof location.longitude === 'number';
              const mapLink = hasCoordinates
                ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
                : null;
              const taskPreview = (location.id ? tasksByLocation[location.id] : []) ?? [];

              return (
                <Box
                  key={location.id}
                  sx={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" mb={1}>{location.name}</Typography>

                      <Stack spacing={1}>
                        <Typography variant="body2">
                          <strong>{t('locations:columns.coordinates')}:</strong>{' '}
                          {hasCoordinates && mapLink ? (
                            <Link href={mapLink} target="_blank" rel="noreferrer" underline="hover">
                              {`${formatCoordinate(location.latitude!, numberLocale)}; ${formatCoordinate(location.longitude!, numberLocale)}`}
                            </Link>
                          ) : '—'}
                        </Typography>
                        <Typography variant="body2"><strong>{t('locations:columns.address')}:</strong> {location.address || '—'}</Typography>
                        <Typography variant="body2"><strong>{t('locations:columns.soilType')}:</strong> {location.soil_type ? t(`locations:soilType.${location.soil_type}`) : '—'}</Typography>
                        <Typography variant="body2"><strong>{t('locations:columns.exposure')}:</strong> {location.exposure ? t(`locations:exposure.${location.exposure}`) : '—'}</Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          <strong>{t('locations:columns.description')}:</strong> {location.description || '—'}
                        </Typography>
                      </Stack>

                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('locations:upcomingTasks')}
                        </Typography>
                        {taskPreview.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            {t('locations:noUpcomingTasks')}
                          </Typography>
                        ) : (
                          <Stack spacing={0.5}>
                            {taskPreview.slice(0, 3).map((task) => (
                              <Chip key={`${task.type}-${task.date}-${task.planId ?? 'na'}`} label={renderTaskLine(task)} size="small" />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', mt: 'auto' }}>
                      <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditDialog(location)}>
                        {t('common:actions.edit')}
                      </Button>
                      {location.id ? (
                        <Button
                          color="error"
                          size="small"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => void deleteLocation(location.id!)}
                        >
                          {t('common:actions.delete')}
                        </Button>
                      ) : null}
                    </CardActions>
                  </Card>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingLocation ? t('locations:editTitle') : t('locations:addButton')}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            required
            label={t('common:fields.name')}
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            error={Boolean(formError)}
            helperText={formError || ' '}
          />
          <TextField
            label={t('locations:columns.latitude')}
            value={formState.latitude}
            onChange={(event) => setFormState((prev) => ({ ...prev, latitude: event.target.value }))}
            placeholder={t('locations:placeholders.latitude')}
          />
          <TextField
            label={t('locations:columns.longitude')}
            value={formState.longitude}
            onChange={(event) => setFormState((prev) => ({ ...prev, longitude: event.target.value }))}
            placeholder={t('locations:placeholders.longitude')}
          />
          <TextField
            label={t('locations:columns.address')}
            value={formState.address}
            onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
          />
          <TextField
            label={t('locations:columns.description')}
            value={formState.description}
            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            minRows={2}
          />
          <TextField
            select
            label={t('locations:columns.soilType')}
            value={formState.soil_type}
            onChange={(event) => setFormState((prev) => ({ ...prev, soil_type: event.target.value as SoilType | '' }))}
            helperText={t('locations:helpers.optionalField')}
          >
            <MenuItem value="">{t('common:messages.noData')}</MenuItem>
            {SOIL_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {t(`locations:soilType.${option.labelKey}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('locations:columns.exposure')}
            value={formState.exposure}
            onChange={(event) => setFormState((prev) => ({ ...prev, exposure: event.target.value as Exposure | '' }))}
            helperText={t('locations:helpers.optionalField')}
          >
            <MenuItem value="">{t('common:messages.noData')}</MenuItem>
            {EXPOSURE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {t(`locations:exposure.${option.labelKey}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('common:fields.notes')}
            value={formState.notes}
            onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t('common:actions.cancel')}</Button>
          <Button variant="contained" onClick={() => void saveLocation()}>{t('common:actions.save')}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default Locations;
