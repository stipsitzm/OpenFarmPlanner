/**
 * BasicInfoSection: Name, Variety, Supplier, Crop Family, Nutrient Demand
 * @remarks Presentational, no internal state
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Autocomplete, Button, Stack, Typography } from '@mui/material';
import { fieldSx } from './styles.tsx';
import type { Culture, Supplier } from '../../api/types';
import type { TFunction } from 'i18next';
import { supplierAPI } from '../../api/api';
import { useNavigate } from 'react-router-dom';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function BasicInfoSection({ formData, errors, onChange, t }: BasicInfoSectionProps) {
  const navigate = useNavigate();
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierLoaded, setSupplierLoaded] = useState(false);

  useEffect(() => {
    const loadSuppliers = async () => {
      setSupplierLoading(true);
      try {
        const response = await supplierAPI.list();
        setSupplierOptions(response.data.results || []);
      } catch (error) {
        console.error('Error loading suppliers:', error);
        setSupplierOptions([]);
      } finally {
        setSupplierLoading(false);
        setSupplierLoaded(true);
      }
    };
    void loadSuppliers();
  }, []);

  useEffect(() => {
    if (!supplierLoaded || formData.supplier?.id || !formData.supplier?.name) {
      return;
    }
    const normalizedCurrentName = formData.supplier.name.trim().toLowerCase();
    const matchingSupplier = supplierOptions.find(
      (option) => option.name.trim().toLowerCase() === normalizedCurrentName,
    );
    if (matchingSupplier) {
      onChange('supplier', matchingSupplier);
    }
  }, [formData.supplier, onChange, supplierLoaded, supplierOptions]);

  // Handle supplier autocomplete input change
  const handleSupplierInputChange = async (_event: React.SyntheticEvent, value: string) => {
    if (value.length < 2) {
      if (!supplierLoaded) {
        return;
      }
      try {
        const response = await supplierAPI.list();
        setSupplierOptions(response.data.results || []);
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
      return;
    }

    setSupplierLoading(true);
    try {
      const response = await supplierAPI.list(value);
      setSupplierOptions(response.data.results || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSupplierOptions([]);
    } finally {
      setSupplierLoading(false);
    }
  };

  const handleCreateSupplierClick = () => {
    navigate('/app/suppliers?create=1');
  };

  const newSupplierOption = useMemo<Supplier>(
    () => ({ id: -1, name: t('form.newSupplierOption', { defaultValue: '+ Neuer Lieferant' }), allowed_domains: [] }),
    [t],
  );

  const availableSupplierOptions = useMemo(
    () => (supplierOptions.length > 0 ? [...supplierOptions, newSupplierOption] : []),
    [newSupplierOption, supplierOptions],
  );

  // Handle supplier selection
  const handleSupplierChange = (_event: React.SyntheticEvent, value: Supplier | null) => {
    if (!value) {
      onChange('supplier', null);
      return;
    }

    if (value.id === -1) {
      handleCreateSupplierClick();
      return;
    }

    onChange('supplier', value);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          sx={fieldSx}
          required
          label={t('form.name')}
          placeholder={t('form.namePlaceholder')}
          value={formData.name}
          onChange={e => onChange('name', e.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name}
        />
        <TextField
          sx={fieldSx}
          required
          label={t('form.variety')}
          placeholder={t('form.varietyPlaceholder')}
          value={formData.variety}
          onChange={e => onChange('variety', e.target.value)}
          error={Boolean(errors.variety)}
          helperText={errors.variety}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Autocomplete
          sx={{ ...fieldSx, width: '100%' }}
          options={availableSupplierOptions}
          value={formData.supplier || null}
          onChange={handleSupplierChange}
          onInputChange={handleSupplierInputChange}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={supplierLoading}
          fullWidth
          noOptionsText={t('form.noSuppliers', { defaultValue: 'Keine Lieferanten vorhanden' })}
          renderInput={(params) => (
            <TextField
              {...params}
              required
              label={t('form.supplier', { defaultValue: 'Saatgutlieferant' })}
              placeholder={t('form.supplierPlaceholder', { defaultValue: 'Lieferant auswählen' })}
              helperText={errors.supplier || t('form.supplierHelp', { defaultValue: 'Lieferant aus der Liste auswählen' })}
              error={Boolean(errors.supplier)}
            />
          )}
        />
        {!supplierLoading && supplierLoaded && supplierOptions.length === 0 && (
          <Stack sx={{ ...fieldSx, width: '100%' }} spacing={1}>
            <Typography variant="body2">{t('form.noSuppliers', { defaultValue: 'Keine Lieferanten vorhanden' })}</Typography>
            <Button variant="outlined" fullWidth onClick={handleCreateSupplierClick}>
              {t('form.createSuppliers', { defaultValue: 'Lieferanten anlegen' })}
            </Button>
          </Stack>
        )}
        <TextField
          sx={fieldSx}
          label={t('form.supplierHomepage', { defaultValue: 'Lieferanten-Homepage' })}
          value={formData.supplier?.homepage_url || ''}
          InputProps={{ readOnly: true }}
          helperText={(formData.supplier?.allowed_domains || []).length > 0 ? `Domains: ${(formData.supplier?.allowed_domains || []).join(', ')}` : ''}
        />
        <TextField
          sx={fieldSx}
          label={t('form.cropFamily')}
          placeholder={t('form.cropFamilyPlaceholder')}
          value={formData.crop_family}
          onChange={e => onChange('crop_family', e.target.value)}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={fieldSx}>
          <InputLabel>{t('form.nutrientDemand')}</InputLabel>
          <Select
            value={formData.nutrient_demand || ''}
            onChange={e => onChange('nutrient_demand', e.target.value)}
            label={t('form.nutrientDemand')}
            fullWidth
          >
            <MenuItem value="">{t('noData')}</MenuItem>
            <MenuItem value="low">{t('form.nutrientDemandLow')}</MenuItem>
            <MenuItem value="medium">{t('form.nutrientDemandMedium')}</MenuItem>
            <MenuItem value="high">{t('form.nutrientDemandHigh')}</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </>
  );
}
