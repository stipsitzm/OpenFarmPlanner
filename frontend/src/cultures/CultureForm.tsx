/**
 * Culture Form component for creating and editing cultures.
 * 
 * Provides a comprehensive form with validation for all culture fields.
 * All fields are visible without collapsible sections.
 * UI text is in German, code comments remain in English.
 * 
 * @param props - Component properties
 * @param props.culture - Existing culture for editing (optional)
 * @param props.onSave - Callback when culture is saved
 * @param props.onCancel - Callback when form is cancelled
 * @returns JSX element rendering the culture form
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from '../i18n';
import type { Culture, Supplier } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Button,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { supplierAPI } from '../api/api';
import { validateCulture } from './validation';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { TimingSection } from './sections/TimingSection';
import { HarvestSection } from './sections/HarvestSection';
import { SpacingSection } from './sections/SpacingSection';
import { SeedingSection } from './sections/SeedingSection';
import { ColorSection } from './sections/ColorSection';
import { NotesSection } from './sections/NotesSection';

interface CultureFormProps {
  culture?: Culture;
  onSave: (culture: Culture) => Promise<void>;
  onCancel: () => void;
}

// Default color for display color picker
const DEFAULT_DISPLAY_COLOR = '#3498db';

// Empty culture template
const EMPTY_CULTURE: Partial<Culture> = {
  name: '',
  variety: '',
  crop_family: '',
  nutrient_demand: '',
  cultivation_type: 'pre_cultivation',
  cultivation_types: ['pre_cultivation'],
  notes: '',
  growth_duration_days: undefined,
  harvest_duration_days: undefined,
  propagation_duration_days: undefined,
  expected_yield: undefined,
  allow_deviation_delivery_weeks: false,
  distance_within_row_cm: undefined,
  row_spacing_cm: undefined,
  sowing_depth_cm: undefined,
  display_color: '',
  sowing_calculation_safety_percent: 0,
  sowing_calculation_safety_percent_direct: undefined,
  sowing_calculation_safety_percent_pre_cultivation: undefined,
  thousand_kernel_weight_g: undefined,
  seeding_requirement: undefined,
  seeding_requirement_type: '',
  seed_rate_value: null,
  seed_rate_unit: null,
  seed_rate_by_cultivation: null,
  seed_rate_direct_value: null,
  seed_rate_direct_unit: null,
  seed_rate_pre_cultivation_value: null,
  seed_rate_pre_cultivation_unit: null,
  seed_packages: [],
};

const buildInitialFormData = (culture?: Culture): Partial<Culture> => {
  if (!culture) {
    return EMPTY_CULTURE;
  }

  const normalizedSpacingValues: Partial<Culture> = {
    distance_within_row_cm:
      typeof culture.distance_within_row_cm === 'number'
        ? Math.round(culture.distance_within_row_cm)
        : culture.distance_within_row_cm,
    row_spacing_cm:
      typeof culture.row_spacing_cm === 'number'
        ? Math.round(culture.row_spacing_cm)
        : culture.row_spacing_cm,
  };

  if (culture.supplier || !culture.seed_supplier) {
    return {
      ...culture,
      ...normalizedSpacingValues,
    };
  }

  return {
    ...culture,
    ...normalizedSpacingValues,
    supplier: {
      name: culture.seed_supplier,
      allowed_domains: [],
    },
  };
};

/**
 * Renders the CultureForm as a modal dialog. The dialog can only be closed via Save or Cancel.
 *
 * @remarks
 * Prevents closing by clicking outside.
 */
export function CultureForm({
  culture,
  onSave,
  onCancel,
}: CultureFormProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const isEdit = Boolean(culture);
  const [saveError, setSaveError] = useState<string>('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierDialogError, setSupplierDialogError] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState({ name: '', homepage_url: '' });

  // --- Validation now imported from ../cultures/validation ---

  // Save function for the autosave hook
  const saveCulture = async (draft: Partial<Culture>): Promise<Partial<Culture>> => {
    const dataToSave: Culture = {
      ...(draft as Culture),
    };
    await onSave(dataToSave);
    return dataToSave;
  };

  // Local form state (no autosave)
  const [formData, setFormData] = useState<Partial<Culture>>(buildInitialFormData(culture));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const supplierOptionsRef = useRef<Supplier[]>([]);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await supplierAPI.list();
      const nextSuppliers = response.data.results || [];
      const previousIds = new Set(supplierOptionsRef.current.map((supplier) => supplier.id).filter((id): id is number => typeof id === 'number'));
      const newestSupplier = [...nextSuppliers].reverse().find((supplier) => typeof supplier.id === 'number' && !previousIds.has(supplier.id));

      supplierOptionsRef.current = nextSuppliers;
      setSupplierOptions(nextSuppliers);

      if (newestSupplier?.id) {
        setFormData((prev) => {
          const rows = prev.supplier_data ?? [];
          let hasChanges = false;
          const nextRows = rows.map((row) => {
            const hasSupplier = typeof row.supplier_id === 'number' || typeof row.supplier?.id === 'number';
            if (hasSupplier) {
              return row;
            }
            hasChanges = true;
            return {
              ...row,
              supplier_id: newestSupplier.id,
              supplier_name: newestSupplier.name,
              supplier_name_input: undefined,
            };
          });

          if (!hasChanges) {
            return prev;
          }

          return {
            ...prev,
            supplier_data: nextRows,
          };
        });
      }
    } catch {
      supplierOptionsRef.current = [];
      setSupplierOptions([]);
    }
  }, []);

  useEffect(() => {
    setFormData(buildInitialFormData(culture));
    setErrors({});
    setIsDirty(false);
    setIsValid(true);
    setSaveError('');
  }, [culture]);

  useEffect(() => {
    void loadSuppliers();

    const onWindowFocus = () => {
      void loadSuppliers();
    };

    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, [loadSuppliers]);

  // Validate on every change
  const validateAndSet = (draft: Partial<Culture>) => {
    const result = validateCulture(draft, t);
    setErrors(result.errors);
    setIsValid(result.isValid);
    return result.isValid;
  };

  // Handle field changes
  // Strongly typed change handler
  const handleChange = <K extends keyof Culture>(name: K, value: Culture[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      setIsDirty(true);
      validateAndSet(updated);
      return updated;
    });
  };

  // Handle manual save (for Save button)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAndSet(formData)) return;
    setIsSaving(true);
    try {
      await saveCulture(formData);
      setSaveError('');
      setIsDirty(false);
    } catch (error) {
      setSaveError(extractApiErrorMessage(error, t, t('messages.updateError')));
    } finally {
      setIsSaving(false);
    }
  };

  const supplierRows = formData.supplier_data ?? [];
  const updateSupplierRow = (index: number, patch: Record<string, unknown>) => {
    const nextRows = supplierRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    handleChange('supplier_data', nextRows);
  };
  const addSupplierRow = () => {
    handleChange('supplier_data', [...supplierRows, { supplier_name_input: '', packaging_sizes: [] }]);
  };
  const removeSupplierRow = (index: number) => {
    handleChange('supplier_data', supplierRows.filter((_row, rowIndex) => rowIndex !== index));
  };
  const addPackageRow = (supplierIndex: number) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    updateSupplierRow(supplierIndex, { packaging_sizes: [...currentPackages, { size_value: 0, size_unit: 'g' }] });
  };
  const updatePackageRow = (supplierIndex: number, packageIndex: number, patch: Record<string, unknown>) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    const nextPackages = currentPackages.map((pkg, index) => (index === packageIndex ? { ...pkg, ...patch } : pkg));
    updateSupplierRow(supplierIndex, { packaging_sizes: nextPackages });
  };
  const removePackageRow = (supplierIndex: number, packageIndex: number) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    updateSupplierRow(supplierIndex, { packaging_sizes: currentPackages.filter((_pkg, index) => index !== packageIndex) });
  };

  const openCreateSupplierDialog = () => {
    setSupplierDraft({ name: '', homepage_url: '' });
    setSupplierDialogError('');
    setSupplierDialogOpen(true);
  };

  const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleCreateSupplier = async (): Promise<void> => {
    const normalizedName = supplierDraft.name.trim();
    const normalizedUrl = normalizeUrl(supplierDraft.homepage_url);
    if (!normalizedName || !normalizedUrl) {
      return;
    }
    if (!isValidUrl(normalizedUrl)) {
      setSupplierDialogError(t('form.supplierHomepageInvalid'));
      return;
    }

    try {
      setSupplierDialogError('');
      setIsCreatingSupplier(true);
      const response = await supplierAPI.create(normalizedName, normalizedUrl, []);
      const createdSupplier = response.data;
      await loadSuppliers();
      setFormData((prev) => {
        const rows = prev.supplier_data ?? [];
        if (rows.length === 0) {
          return {
            ...prev,
            supplier_data: [{
              supplier_id: createdSupplier.id,
              supplier_name: createdSupplier.name,
              packaging_sizes: [],
            }],
          };
        }

        const nextRows = rows.map((row) => {
          const hasSupplier = typeof row.supplier_id === 'number' || typeof row.supplier?.id === 'number';
          if (hasSupplier) {
            return row;
          }
          return {
            ...row,
            supplier_id: createdSupplier.id,
            supplier_name: createdSupplier.name,
            supplier_name_input: undefined,
          };
        });
        return {
          ...prev,
          supplier_data: nextRows,
        };
      });
      setIsDirty(true);
      setSupplierDialogOpen(false);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as { homepage_url?: string; name?: string };
        setSupplierDialogError(errorData.homepage_url || errorData.name || t('form.supplierCreateError'));
      } else {
        setSupplierDialogError(t('form.supplierCreateError'));
      }
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const handleDialogContentScrollKey = (event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault: () => void }, contentElement: HTMLDivElement) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const key = event.key;
    let delta = 0;

    if (key === 'ArrowDown') {
      delta = 40;
    } else if (key === 'ArrowUp') {
      delta = -40;
    } else if (key === 'PageDown') {
      delta = Math.max(200, Math.floor(contentElement.clientHeight * 0.9));
    } else if (key === 'PageUp') {
      delta = -Math.max(200, Math.floor(contentElement.clientHeight * 0.9));
    } else if (key === 'Home') {
      contentElement.scrollTo({ top: 0, behavior: 'auto' });
      event.preventDefault();
      return;
    } else if (key === 'End') {
      contentElement.scrollTo({ top: contentElement.scrollHeight, behavior: 'auto' });
      event.preventDefault();
      return;
    } else {
      return;
    }

    contentElement.scrollBy({ top: delta, behavior: 'auto' });
    event.preventDefault();
  };

  const handleDialogContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    handleDialogContentScrollKey(event, event.currentTarget);
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const contentElement = dialogContentRef.current;
      if (!contentElement) {
        return;
      }

      const activeElement = document.activeElement;
      const isNoElementFocused = !activeElement || activeElement === document.body || activeElement === document.documentElement;
      const dialogElement = contentElement.closest('[role="dialog"]');
      const isFocusInsideDialog = Boolean(dialogElement && activeElement && dialogElement.contains(activeElement));
      if (!isNoElementFocused && !contentElement.contains(activeElement) && !isFocusInsideDialog) {
        return;
      }

      handleDialogContentScrollKey(event, contentElement);
    };

    window.addEventListener('keydown', onWindowKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onWindowKeyDown, { capture: true });
  }, []);

  return (
    <Dialog
      open
      onClose={(_event, reason) => {
        if (reason === 'backdropClick') return;
        onCancel();
      }}
      aria-labelledby="culture-form-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle id="culture-form-dialog-title">
          {isEdit ? t('form.editTitle') : t('form.createTitle')}
        </DialogTitle>
        <DialogContent ref={dialogContentRef} dividers sx={{ maxHeight: '70vh' }} onKeyDownCapture={handleDialogContentKeyDown}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <Typography variant="h6">{t('form.generalInfoSectionTitle')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('form.generalInfoSectionDescription')}
            </Typography>
            <BasicInfoSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <TimingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <HarvestSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <SpacingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <SeedingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <ColorSection formData={formData} errors={errors} onChange={handleChange} t={t} defaultColor={DEFAULT_DISPLAY_COLOR} />
            <NotesSection formData={formData} onChange={handleChange} t={t} errors={errors} />
            <Typography variant="h6" sx={{ mt: 1 }}>{t('form.supplierDataSectionTitle')}</Typography>
            {supplierOptions.length === 0 ? (
              <div style={{ border: '1px dashed #cfd8dc', borderRadius: 8, padding: 16 }}>
                <Typography variant="body1" color="text.secondary">
                  {t('form.supplierDataEmptyStateDescription')}
                </Typography>
                <Button variant="contained" sx={{ mt: 2 }} onClick={openCreateSupplierDialog}>
                  {t('form.createSuppliers')}
                </Button>
              </div>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('form.supplierDataSectionDescription')}
                </Typography>
                {supplierRows.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('form.noSupplierDataRows')}
                  </Typography>
                ) : null}
                {supplierRows.map((row, supplierIndex) => (
              <div key={`supplier-row-${supplierIndex}`} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const selectedSupplierId = row.supplier_id ?? row.supplier?.id ?? null;
                  const availableSupplierIds = new Set(supplierOptions.map((supplier) => supplier.id));
                  const hasSelectedSupplier = typeof selectedSupplierId === 'number';
                  const isSelectedSupplierAvailable = hasSelectedSupplier && availableSupplierIds.has(selectedSupplierId);
                  const selectValue = isSelectedSupplierAvailable ? String(selectedSupplierId) : '';
                  const showUnavailableSelectedSupplier = hasSelectedSupplier && !isSelectedSupplierAvailable;
                  const unavailableSupplierLabel = row.supplier_name || row.supplier?.name || `${t('seedDemand.columns.supplier')} #${selectedSupplierId}`;

                  return (
                    <Select
                      value={selectValue}
                      onChange={(event) => {
                        const selectedValue = String(event.target.value ?? '');

                        if (selectedValue === '') {
                          updateSupplierRow(supplierIndex, {
                            supplier_id: null,
                            supplier_name: undefined,
                            supplier_name_input: undefined,
                          });
                          return;
                        }

                        if (selectedValue === '-1') {
                          openCreateSupplierDialog();
                          return;
                        }

                        const parsedSupplierId = Number(selectedValue);
                        const selectedSupplier = supplierOptions.find((supplier) => supplier.id === parsedSupplierId);
                        updateSupplierRow(supplierIndex, {
                          supplier_id: parsedSupplierId,
                          supplier_name_input: selectedSupplier ? undefined : row.supplier_name_input,
                          supplier_name: selectedSupplier?.name ?? row.supplier_name,
                        });
                      }}
                      displayEmpty
                      size="small"
                    >
                      <MenuItem value="">{t('form.supplierPlaceholder')}</MenuItem>
                      {supplierOptions.map((supplier) => (
                        <MenuItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</MenuItem>
                      ))}
                      {showUnavailableSelectedSupplier ? (
                        <MenuItem value={String(selectedSupplierId)} disabled>
                          {unavailableSupplierLabel}
                        </MenuItem>
                      ) : null}
                      <MenuItem value="-1">{t('form.newSupplierOption')}</MenuItem>
                    </Select>
                  );
                })()}
                <TextField
                  label={t('form.supplierProductNameLabel') }
                  value={row.supplier_product_name ?? ''}
                  onChange={(event) => updateSupplierRow(supplierIndex, { supplier_product_name: event.target.value })}
                  fullWidth
                />
                <TextField
                  label={t('form.thousandKernelWeightLabel')}
                  type="number"
                  value={row.thousand_kernel_weight_g ?? ''}
                  onChange={(event) => updateSupplierRow(supplierIndex, { thousand_kernel_weight_g: event.target.value ? Number(event.target.value) : null })}
                  fullWidth
                />
                <Typography variant="subtitle2">{t('form.seedPackagesLabel')}</Typography>
                {(row.packaging_sizes ?? []).map((pkg, packageIndex) => (
                  <div key={`pkg-${supplierIndex}-${packageIndex}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <TextField
                      label={t('form.seedAmountLabel')}
                      type="number"
                      value={pkg.size_value}
                      onChange={(event) => updatePackageRow(supplierIndex, packageIndex, { size_value: Number(event.target.value) || 0 })}
                    />
                    <Select
                      value={pkg.size_unit}
                      onChange={(event) => updatePackageRow(supplierIndex, packageIndex, { size_unit: event.target.value })}
                      size="small"
                    >
                      <MenuItem value="g">{t('form.packageUnitGram')}</MenuItem>
                      <MenuItem value="seeds">{t('form.packageUnitSeeds')}</MenuItem>
                    </Select>
                    <IconButton onClick={() => removePackageRow(supplierIndex, packageIndex)} aria-label={t('form.removeSeedPackageAriaLabel')}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="outlined" onClick={() => addPackageRow(supplierIndex)}>{t('form.addSeedPackage')}</Button>
                  <Button variant="outlined" color="error" onClick={() => removeSupplierRow(supplierIndex)}>{t('form.removeSupplierData')}</Button>
                </div>
              </div>
                ))}
                <Button variant="outlined" onClick={addSupplierRow}>{t('form.addSupplierData')}</Button>
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
          {saveError ? (
            <Alert severity="error" sx={{ width: '100%' }}>
              {saveError}
            </Alert>
          ) : null}
          {isDirty && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {isValid
                ? t('messages.unsavedChanges', { defaultValue: 'Ungespeicherte Änderungen' })
                : t('messages.fixErrors', { defaultValue: 'Bitte beheben Sie die Validierungsfehler' })}
            </Typography>
          )}
          <Button onClick={onCancel} disabled={isSaving}>
            {t('form.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving || !isValid}
          >
            {isSaving
              ? t('messages.saving', { defaultValue: 'Speichern...' })
              : isEdit ? t('form.save') : t('form.create')}
          </Button>
        </DialogActions>
      </form>

      <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('form.createSuppliers')}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            fullWidth
            label={t('form.supplierNameLabel')}
            value={supplierDraft.name}
            onChange={(event) =>
              setSupplierDraft((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <TextField
            margin="dense"
            fullWidth
            label={t('form.supplierHomepage')}
            value={supplierDraft.homepage_url}
            onChange={(event) =>
              setSupplierDraft((prev) => ({ ...prev, homepage_url: event.target.value }))
            }
          />
          {supplierDialogError ? <Alert severity="error" sx={{ mt: 2 }}>{supplierDialogError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSupplierDialogOpen(false)}>{t('form.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateSupplier()}
            disabled={!supplierDraft.name.trim() || !supplierDraft.homepage_url.trim() || isCreatingSupplier}
          >
            {t('form.createSuppliers')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
