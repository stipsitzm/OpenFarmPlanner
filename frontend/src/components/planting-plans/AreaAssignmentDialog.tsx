import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from '../../i18n';
import type { Bed, Field, Location } from '../../api/types';

const AREA_LABEL_SEPARATOR = ' · ';

interface AreaAssignmentDialogProps {
  bedId: number | null;
  beds: Bed[];
  fields: Field[];
  locations: Location[];
  locale: string;
  onApply: (bedId: number) => Promise<void> | void;
  compactLabel: string;
}

interface AssignmentState {
  locationId: number | null;
  fieldId: number | null;
  bedId: number | null;
}

const formatArea = (value: number, locale: string): string =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} m²`;

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const normalizeState = (
  bedId: number | null,
  bedsWithLocation: Array<Bed & { fieldId: number; locationId: number }>,
): AssignmentState => {
  const selectedBed = bedsWithLocation.find((item) => item.id === bedId);
  if (!selectedBed) {
    return { locationId: null, fieldId: null, bedId: bedId ?? null };
  }

  return {
    locationId: selectedBed.locationId,
    fieldId: selectedBed.fieldId,
    bedId: selectedBed.id ?? null,
  };
};

export function AreaAssignmentDialog({
  bedId,
  beds,
  fields,
  locations,
  locale,
  onApply,
  compactLabel,
}: AreaAssignmentDialogProps): React.ReactElement {
  const { t } = useTranslation('plantingPlans');
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<AssignmentState>({ locationId: null, fieldId: null, bedId: bedId ?? null });
  const locationSelectRef = useRef<HTMLDivElement | null>(null);
  const fieldSelectRef = useRef<HTMLDivElement | null>(null);
  const bedSelectRef = useRef<HTMLDivElement | null>(null);

  const stopGridEnterPropagation = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.stopPropagation();
    }
  };

  const fieldsById = useMemo(() => new Map(fields.filter((item) => item.id !== undefined).map((item) => [item.id as number, item])), [fields]);

  const bedsWithLocation = useMemo(
    () => beds
      .filter((item): item is Bed & { id: number } => item.id !== undefined)
      .map((item) => {
        const relatedField = fieldsById.get(item.field);
        if (!relatedField || relatedField.id === undefined) {
          return null;
        }

        return {
          ...item,
          fieldId: relatedField.id,
          locationId: relatedField.location,
        };
      })
      .filter((item): item is Bed & { id: number; fieldId: number; locationId: number } => item !== null),
    [beds, fieldsById],
  );

  const eligibleFieldIds = useMemo(() => new Set(bedsWithLocation.map((item) => item.fieldId)), [bedsWithLocation]);
  const eligibleLocationIds = useMemo(
    () => new Set(fields.filter((item) => item.id !== undefined && eligibleFieldIds.has(item.id)).map((item) => item.location)),
    [eligibleFieldIds, fields],
  );

  const selectableLocations = useMemo(
    () => locations.filter((item) => item.id !== undefined && eligibleLocationIds.has(item.id)),
    [eligibleLocationIds, locations],
  );
  const hasSingleLocation = selectableLocations.length <= 1;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextState = normalizeState(bedId, bedsWithLocation);
    if (hasSingleLocation && selectableLocations[0]?.id !== undefined) {
      nextState.locationId = selectableLocations[0].id;
    }
    setDraft(nextState);
  }, [bedId, bedsWithLocation, hasSingleLocation, isOpen, selectableLocations]);

  const selectableFields = useMemo(() => {
    if (!draft.locationId) {
      return fields.filter((item) => item.id !== undefined && eligibleFieldIds.has(item.id));
    }
    return fields.filter((item) => item.id !== undefined && item.location === draft.locationId && eligibleFieldIds.has(item.id));
  }, [draft.locationId, eligibleFieldIds, fields]);

  const selectableBeds = useMemo(() => {
    if (draft.fieldId) {
      return bedsWithLocation.filter((item) => item.fieldId === draft.fieldId);
    }
    if (draft.locationId) {
      return bedsWithLocation.filter((item) => item.locationId === draft.locationId);
    }
    return bedsWithLocation;
  }, [bedsWithLocation, draft.fieldId, draft.locationId]);

  const handleLocationChange = (value: number): void => {
    const nextFields = fields.filter((item) => item.id !== undefined && item.location === value && eligibleFieldIds.has(item.id));
    const nextFieldIds = new Set(nextFields.map((item) => item.id as number));
    const nextBeds = bedsWithLocation.filter((item) => item.locationId === value);
    const nextBedIds = new Set(nextBeds.map((item) => item.id));

    setDraft((previous) => ({
      locationId: value,
      fieldId: previous.fieldId && nextFieldIds.has(previous.fieldId) ? previous.fieldId : null,
      bedId: previous.bedId && nextBedIds.has(previous.bedId) ? previous.bedId : null,
    }));
  };

  const handleFieldChange = (value: number): void => {
    const selectedField = fieldsById.get(value);
    const nextBeds = bedsWithLocation.filter((item) => item.fieldId === value);
    const nextBedIds = new Set(nextBeds.map((item) => item.id));

    setDraft((previous) => ({
      locationId: selectedField?.location ?? previous.locationId,
      fieldId: value,
      bedId: previous.bedId && nextBedIds.has(previous.bedId) ? previous.bedId : null,
    }));
  };

  const handleBedChange = (value: number): void => {
    const selectedBed = bedsWithLocation.find((item) => item.id === value);
    setDraft((previous) => ({
      locationId: selectedBed?.locationId ?? previous.locationId,
      fieldId: selectedBed?.fieldId ?? previous.fieldId,
      bedId: value,
    }));
  };

  const handleApply = async (): Promise<void> => {
    if (!draft.bedId) {
      return;
    }
    await onApply(draft.bedId);
    setIsOpen(false);
  };

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>{compactLabel}</Typography>
        <IconButton
          aria-label={t('areaAssignment.editButton')}
          size="small"
          onClick={() => setIsOpen(true)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('areaAssignment.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2.5}>
              {!hasSingleLocation && (
                <FormControl fullWidth size="small">
                  <InputLabel id="assignment-location-label">{t('columns.location')}</InputLabel>
                  <Select
                    ref={locationSelectRef}
                    id="assignment-location"
                    labelId="assignment-location-label"
                    value={draft.locationId ?? ''}
                    label={t('columns.location')}
                    onKeyDown={stopGridEnterPropagation}
                    onChange={(event) => {
                      handleLocationChange(Number(event.target.value));
                      requestAnimationFrame(() => locationSelectRef.current?.focus());
                    }}
                    MenuProps={{
                      MenuListProps: {
                        onKeyDown: stopGridEnterPropagation,
                      },
                    }}
                  >
                    {selectableLocations.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth size="small">
                <InputLabel id="assignment-field-label">{t('columns.field')}</InputLabel>
                <Select
                  ref={fieldSelectRef}
                  id="assignment-field"
                  labelId="assignment-field-label"
                  value={draft.fieldId ?? ''}
                  label={t('columns.field')}
                  onKeyDown={stopGridEnterPropagation}
                  onChange={(event) => {
                    handleFieldChange(Number(event.target.value));
                    requestAnimationFrame(() => fieldSelectRef.current?.focus());
                  }}
                  MenuProps={{
                    MenuListProps: {
                      onKeyDown: stopGridEnterPropagation,
                    },
                  }}
                >
                  {selectableFields.map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="assignment-bed-label">{t('columns.bed')}</InputLabel>
                <Select
                  ref={bedSelectRef}
                  id="assignment-bed"
                  labelId="assignment-bed-label"
                  value={draft.bedId ?? ''}
                  label={t('columns.bed')}
                  onKeyDown={stopGridEnterPropagation}
                  onChange={(event) => {
                    handleBedChange(Number(event.target.value));
                    requestAnimationFrame(() => bedSelectRef.current?.focus());
                  }}
                  MenuProps={{
                    MenuListProps: {
                      onKeyDown: stopGridEnterPropagation,
                    },
                  }}
                >
                  {selectableBeds.map((item) => {
                    const areaSqm = toNumericValue(item.area_sqm);
                    const prefix = item.field_name ? `${item.field_name}${AREA_LABEL_SEPARATOR}` : '';
                    const label = areaSqm === null
                      ? `${prefix}${item.name}`
                      : `${prefix}${item.name} (${formatArea(areaSqm, locale)})`;
                    return (
                      <MenuItem key={item.id} value={item.id}>{label}</MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button type="button" data-dialog-action="cancel" onClick={() => setIsOpen(false)}>{t('areaAssignment.cancel')}</Button>
          <Button type="button" data-dialog-action="apply" variant="contained" onClick={handleApply} disabled={!draft.bedId}>{t('areaAssignment.apply')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
