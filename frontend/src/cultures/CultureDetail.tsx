/**
 * Culture Detail component with searchable dropdown and detailed crop information view.
 * 
 * UI text is in German as per requirements.
 * 
 * @param props - Component properties
 * @param props.cultures - Array of culture objects to display in dropdown
 * @param props.selectedCultureId - Currently selected culture ID
 * @param props.onCultureSelect - Callback when a culture is selected
 * @returns JSX element rendering the culture selector and detail view
 */

import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';
import TuneIcon from '@mui/icons-material/Tune';
import EditIcon from '@mui/icons-material/Edit';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PublicIcon from '@mui/icons-material/Public';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Badge,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Chip,
  Divider,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  List,
  ListItemButton,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
  IconButton,
  Popover,
  TextField,
  Menu,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import type { Culture } from '../api/api';
import { SearchableSelect } from '../components/inputs/SearchableSelect';
import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';
import { UI_LABEL_SEPARATOR } from '../utils/uiLabelSeparator';
import EmptyStateCard from '../components/project/EmptyStateCard';

interface CultureDetailProps {
  cultures: Culture[];
  isLoading?: boolean;
  selectedCultureId?: number;
  onCultureSelect: (culture: Culture | null) => void;
  onCreateCulture?: () => void;
  onOpenPublicLibrary?: () => void;
  onEditCulture?: (culture: Culture) => void;
  onCreatePlan?: () => void;
  onOpenHistory?: () => void;
  onPublishCulture?: () => void;
  onDeleteCulture?: (culture: Culture) => void;
  canCreatePlan?: boolean;
  isPublishingCulture?: boolean;
  publishActionLabel?: string;
}

const CULTURE_FILTERS_STORAGE_KEY = 'culturesDetailFiltersV1';

interface PersistedCultureFilters {
  searchQuery?: string;
  selectedFamilyFilter?: string;
  selectedCultivationFilter?: string;
  selectedNutrientFilter?: string;
  growthDaysMin?: string;
  growthDaysMax?: string;
  yieldMin?: string;
  yieldMax?: string;
  selectedSowingMonths?: number[];
}

/**
 * Formats a number with fallback for null/undefined values
 * Handles floating point precision issues by rounding to 2 decimal places
 */
function formatNumber(value: number | null | undefined, t: (key: string) => string): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }
  
  // Round to 2 decimal places to avoid floating point precision issues
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Formats a distance value (rounds to whole numbers since no one measures more precisely than 1cm)
 */
function formatDistance(value: number | null | undefined, t: (key: string) => string, decimals = 0): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }

  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toFixed(decimals);
}

function formatSeedUnitLabel(unit: string | null | undefined): string {
  if (unit === 'g_per_m2') return 'g / m²';
  if (unit === 'g_per_lfm') return 'g / lfm';
  if (unit === 'seeds_per_m2') return 'Korn / m²';
  if (unit === 'seeds_per_lfm') return 'Korn / lfm';
  if (unit === 'seeds_per_plant') return 'Korn / Pflanze';
  return unit ?? '';
}

function formatPackageSizes(
  packageSizes: Array<{ size_value?: number | null; size_unit?: string | null }> | null | undefined,
  t: (key: string) => string,
): string {
  if (!Array.isArray(packageSizes) || packageSizes.length === 0) {
    return t('noData');
  }

  const normalized = packageSizes
    .filter((entry) => entry && typeof entry.size_value === 'number' && Number.isFinite(entry.size_value) && entry.size_value > 0)
    .map((entry) => `${formatNumber(entry.size_value ?? null, t)} ${entry.size_unit === 'seeds' ? 'Korn' : 'g'}`);

  if (normalized.length === 0) {
    return t('noData');
  }

  return normalized.join(', ');
}


export function CultureDetail({
  cultures,
  isLoading = false,
  selectedCultureId,
  onCultureSelect,
  onCreateCulture,
  onOpenPublicLibrary,
  onEditCulture,
  onCreatePlan,
  onOpenHistory,
  onPublishCulture,
  onDeleteCulture,
  canCreatePlan = true,
  isPublishingCulture = false,
  publishActionLabel,
}: CultureDetailProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const theme = useTheme();
  const isTabletLayout = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobileLandscapeLayout = useMediaQuery(
    `${theme.breakpoints.between('sm', 'md')} and (orientation: landscape) and (max-height: 560px)`,
  );
  const useUnifiedMobileLayout = isMobileLayout || isMobileLandscapeLayout;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyFilter, setSelectedFamilyFilter] = useState('');
  const [selectedCultivationFilter, setSelectedCultivationFilter] = useState('');
  const [selectedNutrientFilter, setSelectedNutrientFilter] = useState('');
  const [growthDaysMin, setGrowthDaysMin] = useState('');
  const [growthDaysMax, setGrowthDaysMax] = useState('');
  const [yieldMin, setYieldMin] = useState('');
  const [yieldMax, setYieldMax] = useState('');
  const [selectedSowingMonths, setSelectedSowingMonths] = useState<number[]>([]);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const isFilterPopoverOpen = Boolean(filterAnchorEl);
  const isHeaderMenuOpen = Boolean(headerMenuAnchorEl);
  const headerActionButtonSx = {
    width: useUnifiedMobileLayout ? 30 : 34,
    height: useUnifiedMobileLayout ? 30 : 34,
    borderRadius: useUnifiedMobileLayout ? 0.75 : 0,
    border: 'none',
    backgroundColor: 'transparent',
    transition: 'background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
    '&:hover': {
      backgroundColor: 'rgba(15, 23, 42, 0.08)',
      boxShadow: useUnifiedMobileLayout ? 'none' : '0 2px 6px rgba(15, 23, 42, 0.10)',
      transform: useUnifiedMobileLayout ? 'none' : 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: '2px solid rgba(37, 111, 42, 0.28)',
      outlineOffset: 1,
    },
  } as const;

  const activeFilterCount = useMemo(
    () => [
      selectedFamilyFilter,
      selectedCultivationFilter,
      selectedNutrientFilter,
      growthDaysMin,
      growthDaysMax,
      yieldMin,
      yieldMax,
      selectedSowingMonths.length > 0 ? 'months' : '',
    ].filter((value) => value.length > 0).length,
    [
      growthDaysMax,
      growthDaysMin,
      selectedCultivationFilter,
      selectedFamilyFilter,
      selectedNutrientFilter,
      selectedSowingMonths.length,
      yieldMax,
      yieldMin,
    ],
  );

  const familyOptions = useMemo(
    () => Array.from(new Set(
      cultures
        .map((culture) => culture.crop_family?.trim())
        .filter((entry): entry is string => Boolean(entry))
    )).sort((left, right) => left.localeCompare(right, 'de')),
    [cultures]
  );

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { month: 'short' }),
    [],
  );

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: monthFormatter.format(new Date(2026, index, 1)),
    })),
    [monthFormatter],
  );

  useEffect(() => {
    const raw = window.sessionStorage.getItem(CULTURE_FILTERS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PersistedCultureFilters;
      setSearchQuery(parsed.searchQuery ?? '');
      setSelectedFamilyFilter(parsed.selectedFamilyFilter ?? '');
      setSelectedCultivationFilter(parsed.selectedCultivationFilter ?? '');
      setSelectedNutrientFilter(parsed.selectedNutrientFilter ?? '');
      setGrowthDaysMin(parsed.growthDaysMin ?? '');
      setGrowthDaysMax(parsed.growthDaysMax ?? '');
      setYieldMin(parsed.yieldMin ?? '');
      setYieldMax(parsed.yieldMax ?? '');
      setSelectedSowingMonths(Array.isArray(parsed.selectedSowingMonths) ? parsed.selectedSowingMonths : []);
    } catch {
      window.sessionStorage.removeItem(CULTURE_FILTERS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedCultureFilters = {
      searchQuery,
      selectedFamilyFilter,
      selectedCultivationFilter,
      selectedNutrientFilter,
      growthDaysMin,
      growthDaysMax,
      yieldMin,
      yieldMax,
      selectedSowingMonths,
    };
    window.sessionStorage.setItem(CULTURE_FILTERS_STORAGE_KEY, JSON.stringify(payload));
  }, [
    growthDaysMax,
    growthDaysMin,
    searchQuery,
    selectedCultivationFilter,
    selectedFamilyFilter,
    selectedNutrientFilter,
    selectedSowingMonths,
    yieldMax,
    yieldMin,
  ]);

  const filteredCultures = useMemo(() => {
    const parsedGrowthDaysMin = growthDaysMin ? Number(growthDaysMin) : null;
    const parsedGrowthDaysMax = growthDaysMax ? Number(growthDaysMax) : null;
    const parsedYieldMin = yieldMin ? Number(yieldMin) : null;
    const parsedYieldMax = yieldMax ? Number(yieldMax) : null;

    const getSowingMonths = (culture: Culture): number[] => {
      const dynamicCulture = culture as Culture & {
        sowing_month?: number | null;
        sowing_months?: number[] | null;
        sowing_start_month?: number | null;
        sowing_end_month?: number | null;
      };
      if (Array.isArray(dynamicCulture.sowing_months)) {
        return dynamicCulture.sowing_months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
      }
      if (typeof dynamicCulture.sowing_month === 'number') {
        return dynamicCulture.sowing_month >= 1 && dynamicCulture.sowing_month <= 12 ? [dynamicCulture.sowing_month] : [];
      }
      if (typeof dynamicCulture.sowing_start_month === 'number' && typeof dynamicCulture.sowing_end_month === 'number') {
        const start = Math.min(dynamicCulture.sowing_start_month, dynamicCulture.sowing_end_month);
        const end = Math.max(dynamicCulture.sowing_start_month, dynamicCulture.sowing_end_month);
        return Array.from({ length: end - start + 1 }, (_, index) => start + index).filter((month) => month >= 1 && month <= 12);
      }
      return [];
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    return cultures.filter((culture) => {
      const cultureName = culture.name?.toLowerCase() ?? '';
      const nameMatches = normalizedQuery.length === 0 || cultureName.includes(normalizedQuery);
      const familyMatches = selectedFamilyFilter.length === 0 || culture.crop_family === selectedFamilyFilter;
      const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
        ? culture.cultivation_types
        : (culture.cultivation_type ? [culture.cultivation_type] : []);
      const cultivationMatches = (
        selectedCultivationFilter.length === 0
        || (selectedCultivationFilter === 'both'
          ? cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
          : cultivationValues.includes(selectedCultivationFilter as 'direct_sowing' | 'pre_cultivation'))
      );
      const growthValue = typeof culture.growth_duration_days === 'number' ? culture.growth_duration_days : null;
      const growthMatches = (
        (parsedGrowthDaysMin === null || (growthValue !== null && growthValue >= parsedGrowthDaysMin))
        && (parsedGrowthDaysMax === null || (growthValue !== null && growthValue <= parsedGrowthDaysMax))
      );
      const nutrientMatches = selectedNutrientFilter.length === 0 || culture.nutrient_demand === selectedNutrientFilter;
      const yieldValue = typeof culture.expected_yield === 'number' ? culture.expected_yield : null;
      const yieldMatches = (
        (parsedYieldMin === null || (yieldValue !== null && yieldValue >= parsedYieldMin))
        && (parsedYieldMax === null || (yieldValue !== null && yieldValue <= parsedYieldMax))
      );
      const sowingMonths = getSowingMonths(culture);
      const sowingMatches = selectedSowingMonths.length === 0
        || selectedSowingMonths.some((month) => sowingMonths.includes(month));

      return nameMatches
        && familyMatches
        && cultivationMatches
        && growthMatches
        && nutrientMatches
        && yieldMatches
        && sowingMatches;
    });
  }, [
    cultures,
    growthDaysMax,
    growthDaysMin,
    searchQuery,
    selectedCultivationFilter,
    selectedFamilyFilter,
    selectedNutrientFilter,
    selectedSowingMonths,
    yieldMax,
    yieldMin,
  ]);

  const cultureOptions: SearchableSelectOption<Culture>[] = useMemo(
    () => {
      const selectedCultureFromAll = selectedCultureId !== undefined
        ? cultures.find((culture) => culture.id === selectedCultureId)
        : undefined;
      const optionCultures = [...filteredCultures];
      if (
        selectedCultureFromAll
        && !optionCultures.some((culture) => culture.id === selectedCultureFromAll.id)
      ) {
        optionCultures.unshift(selectedCultureFromAll);
      }

      return optionCultures
        .filter((culture) => culture.id !== undefined)
        .map((culture) => ({
        value: culture.id!,
        label: `${culture.name}${culture.variety ? `${UI_LABEL_SEPARATOR}${culture.variety}` : ''}${culture.seed_supplier ? ` | ${culture.seed_supplier}` : ''}`,
        data: culture,
      }));
    },
    [cultures, filteredCultures, selectedCultureId]
  );

  const selectedOption = useMemo(
    () => cultureOptions.find((option) => option.value === selectedCultureId) ?? null,
    [cultureOptions, selectedCultureId]
  );

  const selectedCulture = selectedOption?.data ?? null;
  const supplierRows = selectedCulture?.supplier_data ?? [];
  const orderedSupplierRows = useMemo(() => {
    if (supplierRows.length <= 1) {
      return supplierRows;
    }

    const preferredSupplierId = selectedCulture?.supplier?.id ?? selectedCulture?.selected_seed_demand_supplier ?? null;
    if (typeof preferredSupplierId !== 'number') {
      return supplierRows;
    }

    const preferredIndex = supplierRows.findIndex((row) => (row.supplier?.id ?? row.supplier_id ?? null) === preferredSupplierId);
    if (preferredIndex <= 0) {
      return supplierRows;
    }

    return [supplierRows[preferredIndex], ...supplierRows.filter((_row, index) => index !== preferredIndex)];
  }, [selectedCulture?.selected_seed_demand_supplier, selectedCulture?.supplier?.id, supplierRows]);
  const hasMultipleSupplierRows = supplierRows.length > 1;
  const activeCultivationTypes = useMemo(
    () => (
      selectedCulture
        ? (
          selectedCulture.cultivation_types && selectedCulture.cultivation_types.length > 0
            ? selectedCulture.cultivation_types
            : (selectedCulture.cultivation_type ? [selectedCulture.cultivation_type] : [])
        ).filter((item): item is 'direct_sowing' | 'pre_cultivation' => (
          item === 'direct_sowing' || item === 'pre_cultivation'
        ))
        : []
    ),
    [selectedCulture]
  );
  const seedRateRows = useMemo(() => {
    if (!selectedCulture) {
      return [];
    }
    const isDirectActive = activeCultivationTypes.includes('direct_sowing');
    const isPreCultivationActive = activeCultivationTypes.includes('pre_cultivation');

    const rows: Array<{ method: 'direct_sowing' | 'pre_cultivation'; value: number; unit: string; safety: number | null }> = [];
    if (
      isDirectActive
      && selectedCulture.seed_rate_direct_value !== null
      && selectedCulture.seed_rate_direct_value !== undefined
      && selectedCulture.seed_rate_direct_unit
    ) {
      rows.push({
        method: 'direct_sowing',
        value: selectedCulture.seed_rate_direct_value,
        unit: selectedCulture.seed_rate_direct_unit,
        safety: selectedCulture.sowing_calculation_safety_percent_direct ?? null,
      });
    }
    if (
      isPreCultivationActive
      && selectedCulture.seed_rate_pre_cultivation_value !== null
      && selectedCulture.seed_rate_pre_cultivation_value !== undefined
      && selectedCulture.seed_rate_pre_cultivation_unit
    ) {
      rows.push({
        method: 'pre_cultivation',
        value: selectedCulture.seed_rate_pre_cultivation_value,
        unit: selectedCulture.seed_rate_pre_cultivation_unit,
        safety: selectedCulture.sowing_calculation_safety_percent_pre_cultivation ?? null,
      });
    }

    if (rows.length > 0) {
      return rows;
    }

    if (selectedCulture.seed_rate_by_cultivation && Object.keys(selectedCulture.seed_rate_by_cultivation).length > 0) {
      return Object.entries(selectedCulture.seed_rate_by_cultivation)
        .filter(([method, payload]) => (
          activeCultivationTypes.includes(method as 'direct_sowing' | 'pre_cultivation')
          && (
          (method === 'direct_sowing' || method === 'pre_cultivation')
          && payload
          && typeof payload.value === 'number'
          && typeof payload.unit === 'string'
          )
        ))
        .map(([method, payload]) => ({
          method: method as 'direct_sowing' | 'pre_cultivation',
          value: payload.value,
          unit: payload.unit,
          safety: null,
        }));
    }

    if (
      activeCultivationTypes.length > 0
      && selectedCulture.seed_rate_value !== null
      && selectedCulture.seed_rate_value !== undefined
      && selectedCulture.seed_rate_unit
    ) {
      return [{
        method: activeCultivationTypes.includes('direct_sowing') ? 'direct_sowing' : 'pre_cultivation',
        value: selectedCulture.seed_rate_value,
        unit: selectedCulture.seed_rate_unit,
        safety: selectedCulture.sowing_calculation_safety_percent ?? null,
      }];
    }

    return [];
  }, [activeCultivationTypes, selectedCulture]);

  const selectorControl = cultures.length > 0 ? (
      <Box sx={{ width: '100%', p: 1.25, borderBottom: '1px solid #e5e7eb', bgcolor: '#fcfdfc' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <SearchableSelect
              options={cultureOptions}
              value={selectedOption}
              onChange={(option) => onCultureSelect(option?.data ?? null)}
              label={t('searchPlaceholder')}
              placeholder={t('searchInputPlaceholderEnhanced')}
              noOptionsText={t('noOptionsEnhanced')}
              textFieldSx={{
                width: '100%',
              }}
              inputValue={searchQuery}
              onInputChange={setSearchQuery}
              endAdornment={(
                <IconButton
                  size="small"
                  onClick={(event) => setFilterAnchorEl(event.currentTarget)}
                  aria-expanded={isFilterPopoverOpen}
                  aria-haspopup="dialog"
                  aria-controls={isFilterPopoverOpen ? 'culture-filters-popover' : undefined}
                  aria-label="Erweiterte Filter öffnen"
                  sx={{ bgcolor: activeFilterCount > 0 ? 'action.selected' : 'transparent' }}
                >
                  <Badge color="primary" badgeContent={activeFilterCount > 0 ? activeFilterCount : null}>
                    <TuneIcon fontSize="small" />
                  </Badge>
                </IconButton>
              )}
            />
          </Box>
        </Stack>

        <Popover
          id="culture-filters-popover"
          open={isFilterPopoverOpen}
          anchorEl={filterAnchorEl}
          onClose={() => setFilterAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { width: { xs: 'min(92vw, 360px)', sm: 360 }, p: 1.5 } }}
        >
          <Stack
            direction="column"
            spacing={1}
            sx={{ pt: 0.5, pb: 0.5 }}
          >
            <FormControl size="small" sx={{ minWidth: '100%' }}>
              <InputLabel id="culture-family-filter-label">{t('filters.cropFamily')}</InputLabel>
              <Select
                labelId="culture-family-filter-label"
                value={selectedFamilyFilter}
                label={t('filters.cropFamily')}
                onChange={(event) => setSelectedFamilyFilter(event.target.value)}
              >
                <MenuItem value="">{t('filters.all')}</MenuItem>
                {familyOptions.map((family) => (
                  <MenuItem key={family} value={family}>{family}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: '100%' }}>
              <InputLabel id="culture-method-filter-label">{t('filters.cultivationType')}</InputLabel>
              <Select
                labelId="culture-method-filter-label"
                value={selectedCultivationFilter}
                label={t('filters.cultivationType')}
                onChange={(event) => setSelectedCultivationFilter(event.target.value)}
              >
                <MenuItem value="">{t('filters.all')}</MenuItem>
                <MenuItem value="direct_sowing">{t('filters.directSowing')}</MenuItem>
                <MenuItem value="pre_cultivation">{t('filters.preCultivation')}</MenuItem>
                <MenuItem value="both">{t('filters.both')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: '100%' }}>
              <InputLabel id="culture-nutrient-filter-label">{t('filters.nutrientDemand')}</InputLabel>
              <Select
                labelId="culture-nutrient-filter-label"
                value={selectedNutrientFilter}
                label={t('filters.nutrientDemand')}
                onChange={(event) => setSelectedNutrientFilter(event.target.value)}
              >
                <MenuItem value="">{t('filters.all')}</MenuItem>
                <MenuItem value="low">{t('filters.nutrientLow')}</MenuItem>
                <MenuItem value="medium">{t('filters.nutrientMedium')}</MenuItem>
                <MenuItem value="high">{t('filters.nutrientHigh')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label={t('filters.growthDaysMin')}
              value={growthDaysMin}
              onChange={(event) => setGrowthDaysMin(event.target.value)}
              sx={{ minWidth: '100%' }}
            />
            <TextField
              size="small"
              type="number"
              label={t('filters.growthDaysMax')}
              value={growthDaysMax}
              onChange={(event) => setGrowthDaysMax(event.target.value)}
              sx={{ minWidth: '100%' }}
            />
            <FormControl size="small" sx={{ minWidth: '100%' }}>
              <InputLabel id="culture-sowing-month-filter-label">{t('filters.sowingMonths')}</InputLabel>
              <Select
                multiple
                labelId="culture-sowing-month-filter-label"
                value={selectedSowingMonths}
                label={t('filters.sowingMonths')}
                onChange={(event) => setSelectedSowingMonths(event.target.value as number[])}
                renderValue={(selected) => (
                  (selected as number[])
                    .map((value) => monthOptions.find((option) => option.value === value)?.label ?? value)
                    .join(', ')
                )}
              >
                {monthOptions.map((month) => (
                  <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label={t('filters.yieldMin')}
              value={yieldMin}
              onChange={(event) => setYieldMin(event.target.value)}
              sx={{ minWidth: '100%' }}
            />
            <TextField
              size="small"
              type="number"
              label={t('filters.yieldMax')}
              value={yieldMax}
              onChange={(event) => setYieldMax(event.target.value)}
              sx={{ minWidth: '100%' }}
            />
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSearchQuery('');
                setSelectedFamilyFilter('');
                setSelectedCultivationFilter('');
                setSelectedNutrientFilter('');
                setGrowthDaysMin('');
                setGrowthDaysMax('');
                setYieldMin('');
                setYieldMax('');
                setSelectedSowingMonths([]);
                setFilterAnchorEl(null);
              }}
              sx={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
            >
              {t('filters.reset')}
            </Button>
          </Stack>
        </Popover>
      </Box>
  ) : null;

  return (
    <Box sx={{ width: '100%' }}>

      {/* Detail View */}
      {!isLoading && cultures.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: useUnifiedMobileLayout
              ? 'minmax(0, 1fr)'
              : {
                xs: '1fr',
                sm: '220px minmax(0, 1fr)',
                md: '230px minmax(0, 1fr)',
                lg: '300px minmax(0, 1fr)',
                xl: '330px minmax(0, 1fr)',
              },
            gap: { xs: 1.25, lg: 1.5 },
            alignItems: 'start',
          }}
        >
          {!useUnifiedMobileLayout ? (<Card
            sx={{
              width: '100%',
              flexShrink: 0,
              maxHeight: { md: 'calc(100vh - 210px)' },
              overflow: 'hidden',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
              borderRadius: 2,
            }}
          >
            {selectorControl}
            <List
              dense
              sx={{
                py: { xs: 0.5, lg: 0.75 },
                px: { xs: 0.5, lg: 0.75 },
                overflowY: 'auto',
                maxHeight: { sm: 'calc(100vh - 290px)' },
              }}
            >
              {filteredCultures.map((culture) => {
                const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
                  ? culture.cultivation_types
                  : (culture.cultivation_type ? [culture.cultivation_type] : []);
                const cultivationLabel = cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
                  ? t('filters.both')
                  : cultivationValues.includes('direct_sowing')
                    ? t('filters.directSowing')
                    : cultivationValues.includes('pre_cultivation')
                      ? t('filters.preCultivation')
                      : '';
                const secondaryParts = isTabletLayout
                  ? [culture.variety]
                  : [culture.variety, cultivationLabel, culture.seed_supplier].filter(Boolean);
                const secondary = secondaryParts.filter(Boolean).join(' • ');

                return (
                  <ListItemButton
                    key={culture.id}
                    selected={selectedCulture?.id === culture.id}
                    onClick={() => onCultureSelect(culture)}
                    sx={{
                      borderRadius: 1.5,
                      px: { xs: 0.875, lg: 1 },
                      py: { xs: 0.5, lg: 0.75 },
                      mb: { xs: 0.375, lg: 0.5 },
                      alignItems: 'flex-start',
                      border: '1px solid transparent',
                      '&:hover': { bgcolor: '#f4f8f4', borderColor: '#d6e6d8' },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(37, 111, 42, 0.12)',
                        borderColor: 'rgba(37, 111, 42, 0.32)',
                      },
                      '&.Mui-selected:hover': { bgcolor: 'rgba(37, 111, 42, 0.16)' },
                    }}
                  >
                    <ListItemText
                      primary={culture.name}
                      primaryTypographyProps={{ fontSize: { xs: '0.9rem', lg: '0.95rem' }, fontWeight: 600, lineHeight: 1.25 }}
                      secondary={secondary || culture.crop_family || undefined}
                      secondaryTypographyProps={{ fontSize: { xs: '0.76rem', lg: '0.8rem' }, color: 'text.secondary', lineHeight: 1.25 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Card>) : null}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            {selectedCulture ? (
              <Card sx={{ width: '100%', maxWidth: useUnifiedMobileLayout ? '100%' : { sm: 960, lg: 1220, xl: 1400 } }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2, lg: 3 } }}>
            {/* Header with crop name and badge */}
                  <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1, sm: 2 }, mb: 0.75 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.75 }}>
                    {selectedCulture.display_color ? (
                      <Box
                        sx={{
                          width: 4,
                          borderRadius: 1,
                          backgroundColor: selectedCulture.display_color,
                          opacity: 0.75,
                          my: 0.5,
                          alignSelf: 'stretch',
                          flexShrink: 0,
                        }}
                        aria-label="Kulturfarbe"
                        title={selectedCulture.display_color}
                      />
                    ) : null}
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                      {useUnifiedMobileLayout ? (
                        <Box
                          component="button"
                          type="button"
                          onClick={() => setMobileSelectorOpen(true)}
                          sx={{
                            appearance: 'none',
                            border: 'none',
                            background: 'transparent',
                            p: 0,
                            m: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                            color: 'inherit',
                            textAlign: 'left',
                            borderRadius: 0.75,
                            '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.04)' },
                            '&:focus-visible': { outline: '2px solid rgba(37, 111, 42, 0.28)', outlineOffset: 2 },
                          }}
                          aria-label="Kultur auswählen"
                        >
                          <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1.2, fontWeight: 600 }}>
                            {selectedCulture.name}
                          </Typography>
                          <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </Box>
                      ) : (
                        <Typography component="h2" sx={{ fontSize: { xs: '1.25rem', sm: '2rem' }, lineHeight: 1.2, fontWeight: 600 }}>
                          {selectedCulture.name}
                        </Typography>
                      )}
                      {selectedCulture.variety && (
                        <Typography variant="body2" color="text.secondary">
                          {selectedCulture.variety}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          color={selectedCulture.origin_type === 'imported' ? 'secondary' : 'default'}
                          label={selectedCulture.origin_type === 'imported' ? t('library.badges.imported') : t('library.badges.local')}
                        />
                        {selectedCulture.is_modified_from_source ? (
                          <Chip size="small" color="warning" label={t('library.badges.modified')} />
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    borderRadius: useUnifiedMobileLayout ? 1 : 1.5,
                    backgroundColor: useUnifiedMobileLayout ? 'rgba(15, 23, 42, 0.02)' : 'rgba(15, 23, 42, 0.03)',
                    boxShadow: useUnifiedMobileLayout ? 'none' : '0 1px 3px rgba(15, 23, 42, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <Tooltip title={t('buttons.edit')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => onEditCulture?.(selectedCulture)}
                        disabled={!onEditCulture}
                        sx={{
                          ...headerActionButtonSx,
                          color: 'rgba(37, 111, 42, 0.86)',
                          borderRight: '1px solid rgba(15, 23, 42, 0.08)',
                          '&:hover': { backgroundColor: 'rgba(37, 111, 42, 0.12)' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: useUnifiedMobileLayout ? 16 : 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={canCreatePlan ? t('buttons.createPlantingPlan') : t('buttons.createPlantingPlanMissingBedsTooltip')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => onCreatePlan?.()}
                        disabled={!canCreatePlan || !onCreatePlan}
                        sx={{
                          ...headerActionButtonSx,
                          color: 'success.main',
                          borderRight: '1px solid rgba(15, 23, 42, 0.08)',
                          '&:hover': { backgroundColor: 'rgba(37, 111, 42, 0.10)' },
                        }}
                      >
                        <AgricultureIcon sx={{ fontSize: useUnifiedMobileLayout ? 16 : 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={(event) => setHeaderMenuAnchorEl(event.currentTarget)}
                    aria-label="Weitere Aktionen"
                    sx={{
                      ...headerActionButtonSx,
                      color: 'text.secondary',
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: useUnifiedMobileLayout ? 16 : 18 }} />
                  </IconButton>
                </Box>
              </Box>
              <Menu
                anchorEl={headerMenuAnchorEl}
                open={isHeaderMenuOpen}
                onClose={() => setHeaderMenuAnchorEl(null)}
              >
                <MenuItem onClick={() => { setHeaderMenuAnchorEl(null); onOpenHistory?.(); }}>
                  <HistoryIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                  Versionen
                </MenuItem>
                <MenuItem
                  onClick={() => { setHeaderMenuAnchorEl(null); onPublishCulture?.(); }}
                  disabled={isPublishingCulture}
                  sx={{ color: 'text.primary' }}
                >
                  <PublicIcon sx={{ fontSize: 18, mr: 1, color: 'rgba(37, 111, 42, 0.78)' }} />
                  {publishActionLabel ?? t('library.publishButton')}
                </MenuItem>
                <MenuItem onClick={() => { setHeaderMenuAnchorEl(null); onDeleteCulture?.(selectedCulture); }} sx={{ color: 'error.main' }}>
                  <DeleteIcon sx={{ fontSize: 18, mr: 1, color: 'error.main' }} />
                  {t('buttons.delete')}
                </MenuItem>
              </Menu>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* General Information Section */}
            <Box sx={{ mb: 4, p: 2.5, border: '1px solid #e5e7eb', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Allgemeine Informationen
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                {selectedCulture.crop_family && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Pflanzenfamilie
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.crop_family}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.nutrient_demand && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Nährstoffbedarf
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.nutrient_demand === 'low'
                        ? 'Niedrig'
                        : selectedCulture.nutrient_demand === 'medium'
                          ? 'Mittel'
                          : 'Hoch'}
                    </Typography>
                  </Box>
                )}
                {(selectedCulture.cultivation_types && selectedCulture.cultivation_types.length > 0) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Anbauart
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedCulture.cultivation_types.map((item) => (
                        <Chip
                          key={item}
                          size="small"
                          label={item === 'pre_cultivation' ? 'Pflanzung' : 'Direktsaat'}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Timing Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Zeitplanung
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Wachstumszeitraum
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.growth_duration_days, t)} Tage
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Erntezeitraum
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.harvest_duration_days, t)} Tage
                  </Typography>
                </Box>
                {selectedCulture.propagation_duration_days && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Anzuchtdauer
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.propagation_duration_days, t)} Tage
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Spacing Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Abstände
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                {selectedCulture.distance_within_row_cm !== null && selectedCulture.distance_within_row_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Abstand in der Reihe
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.distance_within_row_cm, t)} cm
                    </Typography>
                  </Box>
                )}
                {selectedCulture.row_spacing_cm !== null && selectedCulture.row_spacing_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Reihenabstand
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.row_spacing_cm, t)} cm
                    </Typography>
                  </Box>
                )}
                {selectedCulture.sowing_depth_cm !== null && selectedCulture.sowing_depth_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Saattiefe
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.sowing_depth_cm, t, 1)} cm
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Seeding Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Saatgut
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                {seedRateRows.length > 0 && activeCultivationTypes.length <= 1 && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="body2" color="text.secondary">Menge</Typography>
                    <Typography variant="body1">
                      {formatNumber(seedRateRows[0].value, t)} {formatSeedUnitLabel(seedRateRows[0].unit)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Sicherheitszuschlag Saatgut
                    </Typography>
                    <Typography variant="body1">
                      {seedRateRows[0].safety !== null ? `${formatNumber(seedRateRows[0].safety, t)} %` : '-'}
                    </Typography>
                  </Box>
                )}
                {seedRateRows.length > 0 && activeCultivationTypes.length > 1 && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="body2" color="text.secondary">Saatgutmenge nach Anbauart</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Methode</TableCell>
                          <TableCell>Menge</TableCell>
                          <TableCell>Einheit</TableCell>
                          <TableCell>Sicherheitszuschlag (%)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {seedRateRows.map((row) => (
                          <TableRow key={`${row.method}-${row.unit}-${row.value}`}>
                            <TableCell>{row.method === 'pre_cultivation' ? 'Pflanzung' : 'Direktsaat'}</TableCell>
                            <TableCell>{formatNumber(row.value, t)}</TableCell>
                            <TableCell>{formatSeedUnitLabel(row.unit)}</TableCell>
                            <TableCell>{row.safety !== null ? `${formatNumber(row.safety, t)} %` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
                {seedRateRows.length === 0 && selectedCulture.sowing_calculation_safety_percent !== undefined && selectedCulture.sowing_calculation_safety_percent !== null && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Sicherheitszuschlag Saatgut
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.sowing_calculation_safety_percent} %
                    </Typography>
                  </Box>
                )}
                {selectedCulture.seeding_requirement !== undefined && selectedCulture.seeding_requirement !== null && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Saatgutbedarf
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.seeding_requirement}
                      {selectedCulture.seeding_requirement_type === 'per_sqm'
                        ? ' / m²'
                        : selectedCulture.seeding_requirement_type === 'per_plant'
                          ? ' / Pflanze'
                          : ''}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    1000-Korn-Gewicht (g)
                  </Typography>
                  <Typography variant="body1">
                    {selectedCulture.thousand_kernel_weight_g !== null && selectedCulture.thousand_kernel_weight_g !== undefined
                      ? `${formatNumber(selectedCulture.thousand_kernel_weight_g, t)} g`
                      : t('noData')}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  mt: 3,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <Typography variant="subtitle1" component="h3" gutterBottom>
                  {hasMultipleSupplierRows ? 'Saatgutdaten je Lieferant' : 'Lieferant'}
                </Typography>
                {hasMultipleSupplierRows && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Diese Angaben werden je Lieferant dargestellt.
                  </Typography>
                )}
                {orderedSupplierRows.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Keine Lieferantendaten vorhanden.</Typography>
                ) : (
                  <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
                    {orderedSupplierRows.map((row, index) => (
                      <Box key={row.id ?? `${row.supplier?.id ?? row.supplier_id ?? 'supplier'}-${index}`}>
                        {hasMultipleSupplierRows && index > 0 ? <Divider sx={{ mb: 2 }} /> : null}
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">{row.supplier?.name || row.supplier_name || 'Lieferant'}</Typography>
                          {row.supplier_product_name ? (
                            <Box>
                              <Typography variant="body2" color="text.secondary">Artikelbezeichnung</Typography>
                              <Typography variant="body1">{row.supplier_product_name}</Typography>
                            </Box>
                          ) : null}
                          {row.supplier_product_url && (
                            <Link href={row.supplier_product_url} target="_blank" rel="noopener noreferrer" underline="hover">
                              {row.supplier_product_url}
                            </Link>
                          )}
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Packungsgrößen
                            </Typography>
                            <Typography variant="body1">
                              {formatPackageSizes(row.packaging_sizes, t)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />
            {/* Harvest Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Ernte
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                {selectedCulture.harvest_method && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Erntemethode
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.harvest_method === 'per_plant' ? 'Pro Pflanze' : 'Pro m²'}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.expected_yield && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Erwarteter Ertrag
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.expected_yield, t)} kg
                    </Typography>
                  </Box>
                )}
                {selectedCulture.allow_deviation_delivery_weeks && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Abweichung Lieferwochen
                    </Typography>
                    <Chip
                      label="Ja"
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Notes Section */}
            <Box sx={{ p: 2.5, border: '1px solid #e5e7eb', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Notizen
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: { xs: '100%', xl: 1180 } }}>
                {selectedCulture.notes && (
                  <Box>
                    <Box
                      sx={{
                        '& h3': { mt: 2, mb: 1, fontSize: '1.05rem' },
                        '& p': { mb: 1, maxWidth: '95ch' },
                        '& ul': { pl: 3, mb: 1 },
                        '& li': { mb: 0.5 },
                        '& a': { color: 'primary.main' },
                        '& em': { color: 'text.secondary' },
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ children, ...props }) => (
                            <Link target="_blank" rel="noreferrer" {...props}>
                              {children}
                            </Link>
                          ),
                        }}
                      >
                        {selectedCulture.notes}
                      </ReactMarkdown>
                    </Box>
                  </Box>
                )}
              </Box>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  {useUnifiedMobileLayout ? (
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => setMobileSelectorOpen(true)}
                      sx={{ border: 'none', background: 'transparent', p: 0, m: 0, color: 'text.secondary', textAlign: 'left', cursor: 'pointer' }}
                    >
                      Kultur auswählen ▼
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('selectPrompt')}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </Box>
      ) : null}


      {useUnifiedMobileLayout ? (
        <Dialog fullScreen open={mobileSelectorOpen} onClose={() => setMobileSelectorOpen(false)}>
          <DialogTitle>Kultur auswählen</DialogTitle>
          <DialogContent sx={{ px: 1.5, pb: 2 }}>
            {selectorControl}
            <List dense sx={{ py: 0.5, px: 0.25, overflowY: 'auto' }}>
              {filteredCultures.map((culture) => {
                const secondary = [culture.variety].filter(Boolean).join(' • ');
                return (
                  <ListItemButton
                    key={`mobile-${culture.id}`}
                    selected={selectedCulture?.id === culture.id}
                    onClick={() => {
                      onCultureSelect(culture);
                      setMobileSelectorOpen(false);
                    }}
                    sx={{ borderRadius: 1.25, mb: 0.375 }}
                  >
                    <ListItemText
                      primary={culture.name}
                      secondary={secondary || culture.crop_family || undefined}
                      primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 600 }}
                      secondaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Empty State */}
      {isLoading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('messages.loadingCultures')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {!isLoading && !selectedCulture && cultures.length === 0 && (
        <EmptyStateCard
          title={t('emptyOnboarding.title')}
          description={t('emptyOnboarding.description')}
          actions={[
            { label: t('emptyOnboarding.createAction'), onClick: onCreateCulture },
            { label: t('emptyOnboarding.openLibraryAction'), onClick: onOpenPublicLibrary },
          ]}
        />
      )}

      {!isLoading && !selectedCulture && cultures.length > 0 && filteredCultures.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" sx={{ mb: 1 }}>
              {t('emptySearch.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              {t('emptySearch.description')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFamilyFilter('');
                  setSelectedCultivationFilter('');
                }}
              >
                {t('emptySearch.resetAction')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
