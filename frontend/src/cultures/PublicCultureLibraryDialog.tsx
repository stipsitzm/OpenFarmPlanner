import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import type { PublicCulture } from '../api/types';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface PublicCultureLibraryDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  cultures: PublicCulture[];
  importingId: number | null;
  onClose: () => void;
  onSearch: (query: string) => void;
  onImport: (culture: PublicCulture) => void;
}

export function PublicCultureLibraryDialog({
  open,
  loading,
  error,
  cultures,
  importingId,
  onClose,
  onSearch,
  onImport,
}: PublicCultureLibraryDialogProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [varietyFilter, setVarietyFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [nutrientFilter, setNutrientFilter] = useState('');
  const [cropFamilyFilter, setCropFamilyFilter] = useState('');

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setQuery('');
        setSelectedId(null);
        setVarietyFilter('');
        setSupplierFilter('');
        setNutrientFilter('');
        setCropFamilyFilter('');
      });
    }
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const varietyOptions = useMemo(
    () => Array.from(new Set(cultures.map((entry) => entry.variety?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [cultures],
  );
  const supplierOptions = useMemo(
    () => Array.from(new Set(cultures.map((entry) => (entry.supplier_name || entry.seed_supplier || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [cultures],
  );
  const nutrientOptions = useMemo(
    () => Array.from(new Set(cultures.map((entry) => entry.nutrient_demand || '').filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [cultures],
  );
  const nutrientLabel = (value: string): string => {
    if (value === 'low') return t('form.nutrientDemandLow');
    if (value === 'medium') return t('form.nutrientDemandMedium');
    if (value === 'high') return t('form.nutrientDemandHigh');
    return value;
  };
  const cropFamilyOptions = useMemo(
    () => Array.from(new Set(cultures.map((entry) => entry.crop_family?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [cultures],
  );

  const filteredCultures = useMemo(() => cultures.filter((entry) => {
    const label = `${entry.name} ${entry.variety || ''} ${entry.supplier_name || entry.seed_supplier || ''} ${entry.crop_family || ''}`.toLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || label.includes(normalizedQuery);
    const matchesVariety = !varietyFilter || (entry.variety || '') === varietyFilter;
    const matchesSupplier = !supplierFilter || (entry.supplier_name || entry.seed_supplier || '') === supplierFilter;
    const matchesNutrient = !nutrientFilter || (entry.nutrient_demand || '') === nutrientFilter;
    const matchesCropFamily = !cropFamilyFilter || (entry.crop_family || '') === cropFamilyFilter;
    return matchesQuery && matchesVariety && matchesSupplier && matchesNutrient && matchesCropFamily;
  }), [cropFamilyFilter, cultures, normalizedQuery, nutrientFilter, supplierFilter, varietyFilter]);

  useEffect(() => {
    if (selectedId && !filteredCultures.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredCultures, selectedId]);

  const selectedCulture = useMemo(
    () => filteredCultures.find((entry) => entry.id === selectedId) ?? null,
    [filteredCultures, selectedId],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('library.dialogTitle')}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 560 }}>
        <TextField
          fullWidth
          label={t('library.searchLabel')}
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onSearch(nextValue);
          }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1, mb: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('library.filters.variety')}</InputLabel>
            <Select value={varietyFilter} label={t('library.filters.variety')} onChange={(event) => setVarietyFilter(event.target.value)}>
              <MenuItem value="">{t('filters.all')}</MenuItem>
              {varietyOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{t('library.filters.supplier')}</InputLabel>
            <Select value={supplierFilter} label={t('library.filters.supplier')} onChange={(event) => setSupplierFilter(event.target.value)}>
              <MenuItem value="">{t('filters.all')}</MenuItem>
              {supplierOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{t('library.filters.nutrientDemand')}</InputLabel>
            <Select value={nutrientFilter} label={t('library.filters.nutrientDemand')} onChange={(event) => setNutrientFilter(event.target.value)}>
              <MenuItem value="">{t('filters.all')}</MenuItem>
              {nutrientOptions.map((option) => (
                <MenuItem key={option} value={option}>{nutrientLabel(option)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{t('library.filters.cropFamily')}</InputLabel>
            <Select value={cropFamilyFilter} label={t('library.filters.cropFamily')} onChange={(event) => setCropFamilyFilter(event.target.value)}>
              <MenuItem value="">{t('filters.all')}</MenuItem>
              {cropFamilyOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 2, minHeight: 420 }}>
          {loading ? (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1 }}>
              <CircularProgress />
            </Box>
          ) : null}
          <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, height: 420, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {filteredCultures.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2 }}>{t('library.empty')}</Typography>
            ) : filteredCultures.map((culture) => (
                <ListItemButton
                  key={culture.id}
                  selected={culture.id === selectedId}
                  onClick={() => setSelectedId(culture.id)}
                  alignItems="flex-start"
                >
                  <ListItemText
                    primary={culture.variety ? `${culture.name} (${culture.variety})` : culture.name}
                    secondary={culture.supplier_name || culture.seed_supplier || t('noData')}
                  />
                </ListItemButton>
              ))}
          </List>

          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 420, maxHeight: 420, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {selectedCulture ? (
              <>
                <Typography variant="h6">{selectedCulture.name}</Typography>
                {selectedCulture.variety ? (
                  <Typography color="text.secondary" sx={{ mb: 1 }}>{selectedCulture.variety}</Typography>
                ) : null}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip size="small" label={`${t('library.versionLabel')} ${selectedCulture.version}`} />
                  {selectedCulture.created_by_label ? (
                    <Chip size="small" label={`${t('library.createdByLabel')} ${selectedCulture.created_by_label}`} />
                  ) : null}
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t('form.supplier')}:</strong> {selectedCulture.supplier_name || selectedCulture.seed_supplier || t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t('form.growthDurationDays')}:</strong> {selectedCulture.growth_duration_days ?? t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t('form.harvestDurationDays')}:</strong> {selectedCulture.harvest_duration_days ?? t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  <strong>{t('form.notes')}:</strong> {selectedCulture.notes || t('noData')}
                </Typography>
              </>
            ) : (
              <Typography color="text.secondary">{t('library.selectPrompt')}</Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('form.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => selectedCulture && onImport(selectedCulture)}
          disabled={!selectedCulture || importingId === selectedCulture?.id}
        >
          {importingId === selectedCulture?.id ? t('library.importing') : t('library.importButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
