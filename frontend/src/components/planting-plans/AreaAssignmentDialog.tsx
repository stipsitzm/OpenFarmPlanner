import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import EmptyStateCard from '../project/EmptyStateCard';
import {
  collectHierarchyAvailability,
  filterFieldOptionsByLocation,
} from './areaHierarchySelection';

interface AreaAssignmentDialogProps {
  bedId: number | null;
  beds: Bed[];
  fields: Field[];
  locations: Location[];
  locale: string;
  onApply: (bedId: number) => Promise<void> | void;
  compactLabel: string;
  hasFocus?: boolean;
}

interface AssignmentState {
  locationId: number | null;
  fieldId: number | null;
  bedId: number | null;
}

type BedWithHierarchy = Bed & { id: number; fieldId: number; locationId: number };
interface DialogKeyboardControl {
  root: HTMLElement | null;
  focusTarget: HTMLElement | null;
  disabled: boolean;
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
  bedsWithLocation: BedWithHierarchy[],
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
  hasFocus = false,
}: AreaAssignmentDialogProps): React.ReactElement {
  const { t } = useTranslation('plantingPlans');
  const [isOpen, setIsOpen] = useState(false);
  const [openSelect, setOpenSelect] = useState<'location' | 'field' | 'bed' | null>(null);
  const [draft, setDraft] = useState<AssignmentState>({ locationId: null, fieldId: null, bedId: bedId ?? null });
  const locationSelectRef = useRef<HTMLDivElement | null>(null);
  const fieldSelectRef = useRef<HTMLDivElement | null>(null);
  const bedSelectRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const applyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!hasFocus || isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [hasFocus, isOpen]);

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

  const hierarchyAvailability = useMemo(
    () => collectHierarchyAvailability(fields, bedsWithLocation),
    [bedsWithLocation, fields],
  );

  const fieldsByLocationId = useMemo(() => {
    const grouped = new Map<number, Field[]>();
    locations
      .filter((location): location is Location & { id: number } => location.id !== undefined)
      .forEach((location) => {
        grouped.set(
          location.id,
          filterFieldOptionsByLocation(location.id, fields, hierarchyAvailability.fieldIdsWithBeds),
        );
      });
    return grouped;
  }, [fields, hierarchyAvailability.fieldIdsWithBeds, locations]);

  const bedsByFieldId = useMemo(() => {
    const grouped = new Map<number, BedWithHierarchy[]>();
    bedsWithLocation.forEach((item) => {
      const list = grouped.get(item.fieldId) ?? [];
      list.push(item);
      grouped.set(item.fieldId, list);
    });
    return grouped;
  }, [bedsWithLocation]);

  const selectableLocations = useMemo(
    () => locations.filter((item) => item.id !== undefined && hierarchyAvailability.locationIdsWithBeds.has(item.id)),
    [hierarchyAvailability.locationIdsWithBeds, locations],
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
      return [];
    }
    return fieldsByLocationId.get(draft.locationId) ?? [];
  }, [draft.locationId, fieldsByLocationId]);

  const selectableBeds = useMemo(() => {
    if (!draft.fieldId) {
      return [];
    }
    return bedsByFieldId.get(draft.fieldId) ?? [];
  }, [bedsByFieldId, draft.fieldId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft((previous) => {
      const locationStillValid = previous.locationId !== null
        && selectableLocations.some((item) => item.id === previous.locationId);
      const nextLocationId = locationStillValid ? previous.locationId : null;
      const nextFields = nextLocationId ? fieldsByLocationId.get(nextLocationId) ?? [] : [];
      const fieldStillValid = previous.fieldId !== null
        && nextFields.some((item) => item.id === previous.fieldId);
      const nextFieldId = fieldStillValid ? previous.fieldId : null;
      const nextBeds = nextFieldId ? bedsByFieldId.get(nextFieldId) ?? [] : [];
      const bedStillValid = previous.bedId !== null
        && nextBeds.some((item) => item.id === previous.bedId);

      const nextState = {
        locationId: nextLocationId,
        fieldId: nextFieldId,
        bedId: bedStillValid ? previous.bedId : null,
      };

      if (
        nextState.locationId === previous.locationId
        && nextState.fieldId === previous.fieldId
        && nextState.bedId === previous.bedId
      ) {
        return previous;
      }

      return nextState;
    });
  }, [bedsByFieldId, fieldsByLocationId, isOpen, selectableLocations]);

  const handleLocationChange = useCallback((value: number): void => {
    const nextFields = fieldsByLocationId.get(value) ?? [];
    const selectedFieldId = draft.fieldId && nextFields.some((item) => item.id === draft.fieldId)
      ? draft.fieldId
      : null;

    setDraft({
      locationId: value,
      fieldId: selectedFieldId,
      bedId: null,
    });
  }, [draft.fieldId, fieldsByLocationId]);

  const handleFieldChange = useCallback((value: number): void => {
    if (!draft.locationId) {
      return;
    }

    const selectedField = fieldsByLocationId
      .get(draft.locationId)
      ?.find((item) => item.id === value);
    if (!selectedField) {
      return;
    }

    const nextBeds = bedsByFieldId.get(value) ?? [];
    const selectedBedId = draft.bedId && nextBeds.some((item) => item.id === draft.bedId)
      ? draft.bedId
      : null;

    setDraft({
      locationId: draft.locationId,
      fieldId: value,
      bedId: selectedBedId,
    });
  }, [bedsByFieldId, draft.bedId, draft.locationId, fieldsByLocationId]);

  const handleBedChange = useCallback((value: number): void => {
    if (!draft.fieldId) {
      return;
    }

    const selectedBed = (bedsByFieldId.get(draft.fieldId) ?? []).find((item) => item.id === value);
    if (!selectedBed) {
      return;
    }

    setDraft((previous) => ({
      ...previous,
      bedId: value,
    }));
  }, [bedsByFieldId, draft.fieldId]);

  const renderBedLabel = (item: BedWithHierarchy): string => {
    const areaSqm = toNumericValue(item.area_sqm);
    const label = areaSqm === null
      ? item.name
      : `${item.name} (${formatArea(areaSqm, locale)})`;
    return label;
  };

  const isFieldSelectDisabled = !draft.locationId || selectableFields.length === 0;
  const isBedSelectDisabled = !draft.fieldId || selectableBeds.length === 0;
  const isApplyDisabled = !draft.bedId || bedsWithLocation.length === 0;

  const handleApply = async (): Promise<void> => {
    if (isApplyDisabled || !draft.bedId) {
      return;
    }
    await onApply(draft.bedId);
    setIsOpen(false);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleApply();
  };

  const getSelectFocusTarget = (root: HTMLDivElement | null): HTMLElement | null =>
    root?.querySelector<HTMLElement>('[role="combobox"]') ?? root;

  const getKeyboardControls = useCallback((): DialogKeyboardControl[] => [
    {
      root: locationSelectRef.current,
      focusTarget: getSelectFocusTarget(locationSelectRef.current),
      disabled: selectableLocations.length === 0,
    },
    {
      root: fieldSelectRef.current,
      focusTarget: getSelectFocusTarget(fieldSelectRef.current),
      disabled: isFieldSelectDisabled,
    },
    {
      root: bedSelectRef.current,
      focusTarget: getSelectFocusTarget(bedSelectRef.current),
      disabled: isBedSelectDisabled,
    },
    {
      root: cancelButtonRef.current,
      focusTarget: cancelButtonRef.current,
      disabled: false,
    },
    {
      root: applyButtonRef.current,
      focusTarget: applyButtonRef.current,
      disabled: isApplyDisabled,
    },
  ].filter((control) => control.root && control.focusTarget && !control.disabled), [
    isApplyDisabled,
    isBedSelectDisabled,
    isFieldSelectDisabled,
    selectableLocations.length,
  ]);

  const focusDialogControl = useCallback((control: DialogKeyboardControl | undefined): void => {
    if (!control?.focusTarget) {
      return;
    }

    requestAnimationFrame(() => {
      control.focusTarget?.focus();
    });
  }, []);

  const handleNativeTabKeyDown = useCallback((event: globalThis.KeyboardEvent): void => {
    if (!isOpen || openSelect !== null || event.key !== 'Tab') {
      return;
    }

    const controls = getKeyboardControls();
    if (controls.length === 0) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = controls.findIndex((control) => (
      Boolean(activeElement)
      && (control.root === activeElement || control.focusTarget === activeElement || control.root?.contains(activeElement))
    ));
    const fallbackIndex = event.shiftKey ? controls.length : -1;
    const normalizedIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const nextIndex = event.shiftKey
      ? (normalizedIndex - 1 + controls.length) % controls.length
      : (normalizedIndex + 1) % controls.length;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focusDialogControl(controls[nextIndex]);
  }, [focusDialogControl, getKeyboardControls, isOpen, openSelect]);

  const handleCancel = (): void => {
    setOpenSelect(null);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.addEventListener('keydown', handleNativeTabKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleNativeTabKeyDown, true);
    };
  }, [handleNativeTabKeyDown, isOpen]);

  return (
    <>
      <Box
        ref={triggerRef}
        role="button"
        tabIndex={hasFocus ? 0 : -1}
        aria-label={t('areaAssignment.editButton')}
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(true);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          width: '100%',
          overflow: 'hidden',
          cursor: 'pointer',
          borderRadius: 0.5,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '1px',
          },
        }}
      >
        <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>{compactLabel}</Typography>
        <IconButton
          size="small"
          tabIndex={-1}
          aria-hidden
          onClick={() => setIsOpen(true)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
      <Dialog
        open={isOpen}
        onClose={handleCancel}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={handleFormSubmit}>
          <DialogTitle>{t('areaAssignment.title')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
            {bedsWithLocation.length === 0 ? (
              <EmptyStateCard
                title={t('areaAssignment.emptyStateTitle')}
                description={t('areaAssignment.emptyStateDescription')}
                actions={[{ label: t('areaAssignment.emptyStateAction'), to: '/app/fields-beds' }]}
              />
            ) : null}
            <Stack spacing={1.5} sx={{ mt: bedsWithLocation.length === 0 ? 0 : 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: -0.25 }}>
                  {t('areaAssignment.hierarchyHint')}
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel id="assignment-location-label">{t('columns.location')}</InputLabel>
                  <Select
                    ref={locationSelectRef}
                    id="assignment-location"
                    labelId="assignment-location-label"
                    value={draft.locationId ?? ''}
                    label={t('columns.location')}
                    disabled={selectableLocations.length === 0}
                    onOpen={() => setOpenSelect('location')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleLocationChange(Number(event.target.value));
                      requestAnimationFrame(() => locationSelectRef.current?.focus());
                    }}
                  >
                    {selectableLocations.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="assignment-field-label">{t('columns.field')}</InputLabel>
                  <Select
                    ref={fieldSelectRef}
                    id="assignment-field"
                    labelId="assignment-field-label"
                    value={draft.fieldId ?? ''}
                    label={t('columns.field')}
                    disabled={isFieldSelectDisabled}
                    onOpen={() => setOpenSelect('field')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleFieldChange(Number(event.target.value));
                      requestAnimationFrame(() => fieldSelectRef.current?.focus());
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
                    disabled={isBedSelectDisabled}
                    onOpen={() => setOpenSelect('bed')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleBedChange(Number(event.target.value));
                      requestAnimationFrame(() => {
                        applyButtonRef.current?.focus();
                      });
                    }}
                  >
                    {selectableBeds.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{renderBedLabel(item)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
            </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button ref={cancelButtonRef} type="button" data-dialog-action="cancel" onClick={handleCancel}>{t('areaAssignment.cancel')}</Button>
            <Button ref={applyButtonRef} type="submit" data-dialog-action="apply" variant="contained" disabled={isApplyDisabled}>{t('areaAssignment.apply')}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
