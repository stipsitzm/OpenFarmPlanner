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

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';
import {
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
} from '@mui/material';
import type { Culture } from '../api/api';
import { SearchableSelect } from '../components/inputs/SearchableSelect';
import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';

interface CultureDetailProps {
  cultures: Culture[];
  isLoading?: boolean;
  selectedCultureId?: number;
  onCultureSelect: (culture: Culture | null) => void;
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
  
  // If the result is a whole number, return as integer
  if (rounded === Math.floor(rounded)) {
    return rounded.toString();
  }
  
  return rounded.toString();
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
}: CultureDetailProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyFilter, setSelectedFamilyFilter] = useState('');
  const [selectedCultivationFilter, setSelectedCultivationFilter] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');

  const familyOptions = useMemo(
    () => Array.from(new Set(
      cultures
        .map((culture) => culture.crop_family?.trim())
        .filter((entry): entry is string => Boolean(entry))
    )).sort((left, right) => left.localeCompare(right, 'de')),
    [cultures]
  );

  const supplierOptions = useMemo(
    () => Array.from(new Set(
      cultures
        .map((culture) => culture.seed_supplier?.trim())
        .filter((entry): entry is string => Boolean(entry))
    )).sort((left, right) => left.localeCompare(right, 'de')),
    [cultures]
  );

  const filteredCultures = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return cultures.filter((culture) => {
      const cultureName = culture.name?.toLowerCase() ?? '';
      const nameMatches = normalizedQuery.length === 0 || cultureName.includes(normalizedQuery);
      const familyMatches = selectedFamilyFilter.length === 0 || culture.crop_family === selectedFamilyFilter;
      const supplierMatches = selectedSupplierFilter.length === 0 || culture.seed_supplier === selectedSupplierFilter;
      const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
        ? culture.cultivation_types
        : (culture.cultivation_type ? [culture.cultivation_type] : []);
      const cultivationMatches = (
        selectedCultivationFilter.length === 0
        || cultivationValues.includes(selectedCultivationFilter as 'direct_sowing' | 'pre_cultivation')
      );

      return nameMatches && familyMatches && supplierMatches && cultivationMatches;
    });
  }, [cultures, searchQuery, selectedFamilyFilter, selectedCultivationFilter, selectedSupplierFilter]);

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
        label: `${culture.name}${culture.variety ? ` - ${culture.variety}` : ''}${culture.seed_supplier ? ` | ${culture.seed_supplier}` : ''}`,
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
  const selectedSupplierRow = useMemo(() => {
    if (supplierRows.length === 0) {
      return null;
    }

    const preferredSupplierId = selectedCulture?.supplier?.id ?? selectedCulture?.selected_seed_demand_supplier ?? null;
    if (typeof preferredSupplierId === 'number') {
      const match = supplierRows.find((row) => (row.supplier?.id ?? row.supplier_id ?? null) === preferredSupplierId);
      if (match) {
        return match;
      }
    }

    return supplierRows[0];
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

  return (
    <Box sx={{ width: '100%' }}>
      {/* Searchable Dropdown */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
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
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
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
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
            <InputLabel id="culture-supplier-filter-label">{t('filters.supplier')}</InputLabel>
            <Select
              labelId="culture-supplier-filter-label"
              value={selectedSupplierFilter}
              label={t('filters.supplier')}
              onChange={(event) => setSelectedSupplierFilter(event.target.value)}
            >
              <MenuItem value="">{t('filters.all')}</MenuItem>
              {supplierOptions.map((supplier) => (
                <MenuItem key={supplier} value={supplier}>{supplier}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => {
              setSearchQuery('');
              setSelectedFamilyFilter('');
              setSelectedCultivationFilter('');
              setSelectedSupplierFilter('');
            }}
            sx={{ alignSelf: { xs: 'stretch', md: 'center' } }}
          >
            {t('filters.reset')}
          </Button>
        </Stack>
        <SearchableSelect
          options={cultureOptions}
          value={selectedOption}
          onChange={(option) => onCultureSelect(option?.data ?? null)}
          label={t('searchPlaceholder')}
          placeholder={t('searchInputPlaceholderEnhanced')}
          noOptionsText={t('noOptionsEnhanced')}
          textFieldSx={{ width: '100%' }}
          inputValue={searchQuery}
          onInputChange={setSearchQuery}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
          {t('searchHelperText', { count: filteredCultures.length })}
        </Typography>
      </Box>

      {/* Detail View */}
      {selectedCulture && (
        <Card>
          <CardContent>
            {/* Header with crop name and badge */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h4" component="h2">
                    {selectedCulture.name}
                  </Typography>
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
                {selectedCulture.display_color && (
                  <Box
                    sx={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: selectedCulture.display_color,
                      border: '1px solid #ccc',
                    }}
                  />
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* General Information Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Allgemeine Informationen
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
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
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
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
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
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
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
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
              </Box>
              <Box sx={{ mt: 3, ml: { xs: 0, sm: 2 } }}>
                <Typography variant="subtitle1" component="h3" gutterBottom>
                  {hasMultipleSupplierRows ? 'Saatgutdaten je Lieferant' : 'Lieferant'}
                </Typography>
                {hasMultipleSupplierRows && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Diese Angaben beziehen sich nur auf den ausgewählten Saatgutlieferanten.
                  </Typography>
                )}
                {selectedSupplierRow === null ? (
                  <Typography variant="body2" color="text.secondary">Keine Lieferantendaten vorhanden.</Typography>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">{selectedSupplierRow.supplier?.name || selectedSupplierRow.supplier_name || 'Lieferant'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedSupplierRow.supplier_product_name || '-'}
                    </Typography>
                    {selectedSupplierRow.supplier_product_url && (
                      <Link href={selectedSupplierRow.supplier_product_url} target="_blank" rel="noopener noreferrer" underline="hover">
                        {selectedSupplierRow.supplier_product_url}
                      </Link>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Packungsgrößen
                      </Typography>
                      <Typography variant="body1">
                        {formatPackageSizes(selectedSupplierRow.packaging_sizes, t)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Tausendkorngewicht
                      </Typography>
                      <Typography variant="body1">
                        {selectedSupplierRow.thousand_kernel_weight_g !== null && selectedSupplierRow.thousand_kernel_weight_g !== undefined
                          ? `${formatNumber(selectedSupplierRow.thousand_kernel_weight_g, t)} g`
                          : t('noData')}
                      </Typography>
                    </Box>
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
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
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
            <Box>
              <Typography variant="h6" gutterBottom>
                Notizen
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedCulture.notes && (
                  <Box>
                    <Box
                      sx={{
                        '& h3': { mt: 2, mb: 1, fontSize: '1.05rem' },
                        '& p': { mb: 1 },
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
      )}

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

      {!isLoading && !selectedCulture && filteredCultures.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              {t('selectPrompt')}
            </Typography>
          </CardContent>
        </Card>
      )}

      {!isLoading && !selectedCulture && filteredCultures.length === 0 && (
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
                  setSelectedSupplierFilter('');
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
