import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Link,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { seedDemandAPI, type SeedDemand } from '../api/api';
import { bedAPI, cultureAPI, locationAPI, plantingPlanAPI } from '../api/api';
import { useTranslation } from '../i18n';
import { useCommandContextTag } from '../commands/useCommandContext';
import PageHelp from '../components/help/PageHelp';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';

const formatUnit = (unit: 'g' | 'seeds', t: (key: string) => string): string => (
  unit === 'seeds' ? t('seedDemand.unitSeeds') : t('seedDemand.unitGrams')
);

const formatPackageSelection = (row: SeedDemand, t: (key: string) => string): string => {
  if (!row.package_suggestion || row.package_suggestion.selection.length === 0) {
    return t('seedDemand.noPackagesAvailable');
  }

  return row.package_suggestion.selection
    .map((item) => `${item.size_value} ${formatUnit(item.size_unit, t)}${item.count > 1 ? ` × ${item.count}` : ''}`)
    .join(' + ');
};

export default function SeedDemandPage(): React.ReactElement {
  useCommandContextTag('seedDemand');
  const { t } = useTranslation('cultures');
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cultureCount, setCultureCount] = useState(0);
  const [planCount, setPlanCount] = useState(0);
  const [hasCulturesWithSeedData, setHasCulturesWithSeedData] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [bedCount, setBedCount] = useState(0);
  const hasPlans = planCount > 0;
  const hasSeedData = hasCulturesWithSeedData;
  const canCalculateSeedDemand = locationCount > 0 && bedCount > 0 && cultureCount > 0 && hasPlans && hasSeedData;
  const missingRequirement = useMemo(() => {
    if (locationCount === 0) {
      return {
        title: t('seedDemand.progressive.locations.title'),
        description: t('seedDemand.progressive.locations.description'),
        action: { label: t('seedDemand.progressive.locations.action'), to: '/app/locations' },
      };
    }
    if (bedCount === 0) {
      return {
        title: t('seedDemand.progressive.beds.title'),
        description: t('seedDemand.progressive.beds.description'),
        action: { label: t('seedDemand.progressive.beds.action'), to: '/app/fields-beds' },
      };
    }
    if (cultureCount === 0) {
      return {
        title: t('seedDemand.progressive.cultures.title'),
        description: t('seedDemand.progressive.cultures.description'),
        action: { label: t('seedDemand.progressive.cultures.action'), to: '/app/cultures' },
      };
    }
    if (!hasPlans) {
      return {
        title: t('seedDemand.progressive.plans.title'),
        description: t('seedDemand.progressive.plans.description'),
        action: { label: t('seedDemand.progressive.plans.action'), to: '/app/planting-plans' },
      };
    }
    if (!hasSeedData) {
      return {
        title: t('seedDemand.progressive.seedData.title'),
        description: t('seedDemand.progressive.seedData.description'),
        action: { label: t('seedDemand.progressive.seedData.action'), to: '/app/cultures' },
      };
    }
    return null;
  }, [bedCount, cultureCount, hasPlans, hasSeedData, locationCount, t]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await seedDemandAPI.list();
      setRows(response.data.results ?? []);
      const [culturesResponse, plansResponse, locationsResponse, bedsResponse] = await Promise.all([
        cultureAPI.list(),
        plantingPlanAPI.list(),
        locationAPI.list(),
        bedAPI.list(),
      ]);
      const cultures = culturesResponse.data.results;
      setCultureCount(cultures.length);
      setPlanCount(plansResponse.data.results.length);
      setLocationCount(locationsResponse.data.results.length);
      setBedCount(bedsResponse.data.results.length);
      setHasCulturesWithSeedData(cultures.some((culture) => (
        culture.seed_rate_value !== null
        || culture.seed_rate_direct_value !== null
        || culture.seed_rate_pre_cultivation_value !== null
      )));
    } catch {
      setError(t('seedDemand.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupplierChange = async (cultureId: number, supplierId: number | null) => {
    setIsLoading(true);
    setError(null);
    try {
      await seedDemandAPI.saveSupplierSelection(cultureId, supplierId);
      await loadRows();
    } catch {
      setError(t('seedDemand.saveError'));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setRows([]);
      setIsLoading(false);
      setError(null);
      setHasCulturesWithSeedData(false);
      return;
    }
    void loadRows();
  }, [shouldShowProjectRequiredState]);

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer>
        <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
          <PageHeader
            title={t('seedDemand.title')}
            help={<PageHelp pageKey="seedDemand" ariaLabel="Hilfe zu Saatgutbedarf öffnen" tooltip="Hilfe zu Saatgutbedarf öffnen" />}
            marginBottom={1}
          />
          <ProjectRequiredState reason={missingProjectReason} />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
        <PageHeader
          title={t('seedDemand.title')}
          help={<PageHelp pageKey="seedDemand" ariaLabel="Hilfe zu Saatgutbedarf öffnen" tooltip="Hilfe zu Saatgutbedarf öffnen" />}
          marginBottom={1}
        />

        {isLoading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}

        {!isLoading && !error && !canCalculateSeedDemand && (
          <EmptyStateCard
            title={missingRequirement?.title ?? t('seedDemand.emptyStates.requirementsTitle')}
            description={missingRequirement?.description ?? t('seedDemand.emptyStates.requirementsDescription')}
            actions={missingRequirement ? [missingRequirement.action] : []}
          />
        )}

        {!isLoading && !error && canCalculateSeedDemand && (
          <TableContainer component={Paper} sx={{ width: 'fit-content', maxWidth: '100%' }}>
            <Table
              sx={{
                '& .MuiTableCell-root': { py: 1 },
              }}
            >
            <TableHead>
              <TableRow>
                <TableCell>{t('seedDemand.columns.culture')}</TableCell>
                <TableCell>{t('seedDemand.columns.supplier')}</TableCell>
                <TableCell align="right">{t('seedDemand.columns.requiredAmount')}</TableCell>
                <TableCell>{t('seedDemand.columns.packages')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const supplierOptions = row.supplier_options ?? [];
                const supplierCount = supplierOptions.length;
                const hasSupplierOptions = supplierCount > 0;
                const packageInfo = hasSupplierOptions
                  ? formatPackageSelection(row, t)
                  : t('seedDemand.noPackageCalculationPossible');
                const supplierOptionValues = new Set(supplierOptions.map((option) => String(option.supplier_id)));
                const selectedSupplierValue = row.selected_supplier_id !== null && row.selected_supplier_id !== undefined
                  ? String(row.selected_supplier_id)
                  : '';
                const selectValue = supplierOptionValues.has(selectedSupplierValue) ? selectedSupplierValue : '';
                const singleSupplierOption = supplierCount === 1 ? supplierOptions[0] : null;
                const singleSupplierValue = singleSupplierOption ? String(singleSupplierOption.supplier_id) : '';

                return (
                  <TableRow key={row.culture_id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}`} underline="hover">
                        {row.variety ? `${row.culture_name} (${row.variety})` : row.culture_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {supplierCount > 1 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                              value={selectValue}
                              sx={{
                                '& .MuiSelect-select': { py: 0.75 },
                              }}
                              onChange={(event) => {
                                const selectedValue = String(event.target.value ?? '');
                                void handleSupplierChange(
                                  row.culture_id,
                                  selectedValue ? Number(selectedValue) : null,
                                );
                              }}
                              displayEmpty
                            >
                              {selectValue === '' ? <MenuItem value="">{t('seedDemand.selectSupplier')}</MenuItem> : null}
                              {supplierOptions.map((option) => (
                                <MenuItem key={option.supplier_id} value={String(option.supplier_id)}>
                                  {option.supplier_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ) : supplierCount === 1 && singleSupplierOption ? (
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <Select
                            value={singleSupplierValue}
                            disabled
                            sx={{
                              '& .MuiSelect-select': { py: 0.75 },
                            }}
                          >
                            <MenuItem value={singleSupplierValue}>
                              {singleSupplierOption.supplier_name}
                            </MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('seedDemand.noSupplierAvailable')}
                          </Typography>
                          <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}`} underline="hover" variant="caption">
                            {t('seedDemand.editCultureAction')}
                          </Link>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {row.required_amount_value === null || row.required_amount_unit === null
                        ? '-'
                        : `${row.required_amount_value.toFixed(2)} ${formatUnit(row.required_amount_unit, t)}`}
                    </TableCell>
                    <TableCell>{packageInfo}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
            {rows.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <EmptyStateCard
                  title={t('seedDemand.emptyStates.noResultsTitle')}
                  description={t('seedDemand.emptyStates.noResultsDescription')}
                />
              </Box>
            ) : null}
          </TableContainer>
        )}
      </Box>
    </PageContainer>
  );
}
