import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';
import type { PublicCulture } from '../api/types';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { stripCitationMarkers } from '../components/data-grid/markdown';

interface PublicCultureLibraryDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  cultures: PublicCulture[];
  importingId: number | null;
  initialSelectedId?: number | null;
  initialQuery?: string;
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
  initialSelectedId = null,
  initialQuery = '',
  onClose,
  onSearch,
  onImport,
}: PublicCultureLibraryDialogProps) {
  const { t } = useTranslation('cultures');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [varietyFilter, setVarietyFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [nutrientFilter, setNutrientFilter] = useState('');
  const [cropFamilyFilter, setCropFamilyFilter] = useState('');
  const [mobileStep, setMobileStep] = useState<'list' | 'detail'>('list');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobileLandscape = useMediaQuery(`(orientation: landscape) and (max-height: 560px) and (max-width: 960px)`);
  const useMobileFilterLayout = isMobile || isMobileLandscape;

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedId(initialSelectedId);
      setVarietyFilter('');
      setSupplierFilter('');
      setNutrientFilter('');
      setCropFamilyFilter('');
      if (initialSelectedId && useMobileFilterLayout) {
        setMobileStep('detail');
      } else {
        setMobileStep('list');
      }
    }
  }, [initialQuery, initialSelectedId, open, useMobileFilterLayout]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setQuery('');
        setSelectedId(null);
        setVarietyFilter('');
        setSupplierFilter('');
        setNutrientFilter('');
        setCropFamilyFilter('');
        setMobileStep('list');
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
    if (loading || (initialSelectedId && selectedId === initialSelectedId && cultures.length === 0)) {
      return;
    }
    if (selectedId && !filteredCultures.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [cultures.length, filteredCultures, initialSelectedId, loading, selectedId]);

  const selectedCulture = useMemo(
    () => filteredCultures.find((entry) => entry.id === selectedId) ?? null,
    [filteredCultures, selectedId],
  );

  const handleDialogClose = (): void => {
    if (useMobileFilterLayout && mobileStep === 'detail') {
      setMobileStep('list');
      return;
    }
    onClose();
  };

  const filterControls = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: isMobileLandscape
          ? 'repeat(2, minmax(0, 1fr))'
          : { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
        gap: 1,
        mb: isMobileLandscape ? 1 : 2,
      }}
    >
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
  );

  return (
      <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth={useMobileFilterLayout ? false : 'md'}
      fullWidth
      fullScreen={useMobileFilterLayout && !isMobileLandscape}
      PaperProps={{
        sx: isMobileLandscape
          ? {
            width: 'calc(100vw - 32px)',
            maxWidth: 'none',
            height: 'calc(100vh - 24px)',
            maxHeight: 'calc(100vh - 24px)',
            m: 0,
          }
          : undefined,
      }}
    >
      <DialogTitle sx={{ py: isMobileLandscape ? 1 : 2, px: isMobileLandscape ? 1.5 : 3 }}>
        {t('library.dialogTitle')}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          minHeight: useMobileFilterLayout ? 'auto' : 560,
          px: isMobileLandscape ? 1.25 : useMobileFilterLayout ? 1.25 : 3,
          py: isMobileLandscape ? 1 : 2,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
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
          size={isMobileLandscape ? 'small' : 'medium'}
          sx={{ mb: isMobileLandscape ? 1 : 2 }}
        />

        {useMobileFilterLayout ? (
          <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1.25 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <TuneIcon fontSize="small" />
                <Typography variant="body2">{t('filters.title', { defaultValue: 'Filter' })}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0.75, pb: 1 }}>
              <Box sx={{ '& > *': { mb: 0 } }}>
                {filterControls}
              </Box>
            </AccordionDetails>
          </Accordion>
        ) : filterControls}

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: useMobileFilterLayout ? '1fr' : { xs: '1fr', md: '1.2fr 1fr' }, gap: isMobileLandscape ? 1 : 2, minHeight: 0, flex: 1 }}>
          {loading ? (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1 }}>
              <CircularProgress />
            </Box>
          ) : null}
          {(!useMobileFilterLayout || mobileStep === 'list') ? (
            <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, height: useMobileFilterLayout ? '100%' : 420, minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {filteredCultures.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2 }}>{t('library.empty')}</Typography>
            ) : filteredCultures.map((culture) => (
                <ListItemButton
                  key={culture.id}
                  selected={culture.id === selectedId}
                  onClick={() => {
                    setSelectedId(culture.id);
                    if (useMobileFilterLayout) {
                      setMobileStep('detail');
                    }
                  }}
                  alignItems="flex-start"
                  sx={{ py: 0.75, px: 1.25 }}
                >
                  <ListItemText
                    primary={culture.variety ? `${culture.name} (${culture.variety})` : culture.name}
                    secondary={culture.supplier_name || culture.seed_supplier || t('noData')}
                    primaryTypographyProps={{ fontSize: '0.92rem', lineHeight: 1.25 }}
                    secondaryTypographyProps={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.2 }}
                  />
                </ListItemButton>
              ))}
            </List>
          ) : null}

          {(!useMobileFilterLayout || mobileStep === 'detail') ? (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: isMobileLandscape ? 1.25 : useMobileFilterLayout ? 1.5 : 2, minHeight: useMobileFilterLayout ? '100%' : 420, maxHeight: useMobileFilterLayout ? 'none' : 420, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {selectedCulture ? (
              <>
                <Typography variant="h6">{selectedCulture.name}</Typography>
                {selectedCulture.variety ? (
                  <Typography color="text.secondary" sx={{ mb: 1 }}>{selectedCulture.variety}</Typography>
                ) : null}
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                  <Chip size="small" variant="outlined" label={`${t('library.versionLabel')} ${selectedCulture.version}`} />
                  {selectedCulture.created_by_label ? (
                    <Chip size="small" variant="outlined" label={`${t('library.createdByLabel')} ${selectedCulture.created_by_label}`} />
                  ) : null}
                </Box>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  <strong>{t('form.supplier')}:</strong> {selectedCulture.supplier_name || selectedCulture.seed_supplier || t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  <strong>{t('form.growthDurationDays')}:</strong> {selectedCulture.growth_duration_days ?? t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  <strong>{t('form.harvestDurationDays')}:</strong> {selectedCulture.harvest_duration_days ?? t('noData')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  <strong>{t('form.notes')}:</strong>
                </Typography>
                {selectedCulture.notes ? (
                  <Box
                    sx={{
                      '& h3': { mt: 1.5, mb: 0.5, fontSize: '0.9rem' },
                      '& p': { mb: 0.75, lineHeight: 1.45 },
                      '& ul': { pl: 2.5, mb: 0.75 },
                      '& li': { mb: 0.25 },
                      '& a': { color: 'primary.main' },
                      '& em': { color: 'text.secondary' },
                      fontSize: '0.875rem',
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {stripCitationMarkers(selectedCulture.notes)}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">{t('noData')}</Typography>
                )}
              </>
            ) : (
              <Typography color="text.secondary">{t('library.selectPrompt')}</Typography>
            )}
            </Box>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: isMobileLandscape ? 1.25 : isMobile ? 1.25 : 3, py: isMobileLandscape ? 0.75 : isMobile ? 1 : 1.5 }}>
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
