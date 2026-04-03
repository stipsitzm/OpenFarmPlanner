import { useEffect, useState } from 'react';
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
import { useTranslation } from '../i18n';
import { useCommandContextTag } from '../commands/useCommandContext';

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
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await seedDemandAPI.list();
      setRows(response.data.results ?? []);
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
    void loadRows();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('seedDemand.title')}
      </Typography>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!isLoading && !error && (
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
                const hasSupplierOptions = Boolean(row.supplier_options && row.supplier_options.length > 0);
                const packageInfo = hasSupplierOptions
                  ? formatPackageSelection(row, t)
                  : t('seedDemand.noPackageCalculationPossible');
                const supplierOptionValues = new Set((row.supplier_options ?? []).map((option) => String(option.supplier_id)));
                const selectedSupplierValue = row.selected_supplier_id !== null && row.selected_supplier_id !== undefined
                  ? String(row.selected_supplier_id)
                  : '';
                const selectValue = supplierOptionValues.has(selectedSupplierValue) ? selectedSupplierValue : '';

                return (
                  <TableRow key={row.culture_id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/cultures?cultureId=${row.culture_id}`} underline="hover">
                        {row.variety ? `${row.culture_name} (${row.variety})` : row.culture_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {hasSupplierOptions ? (
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
                              <MenuItem value="">{t('seedDemand.selectSupplier')}</MenuItem>
                              {(row.supplier_options ?? []).map((option) => (
                                <MenuItem key={option.supplier_id} value={String(option.supplier_id)}>
                                  {option.supplier_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('seedDemand.noSupplierData')}
                          </Typography>
                          <Link component={RouterLink} to={`/cultures?cultureId=${row.culture_id}`} underline="hover" variant="caption">
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
        </TableContainer>
      )}
    </Box>
  );
}
