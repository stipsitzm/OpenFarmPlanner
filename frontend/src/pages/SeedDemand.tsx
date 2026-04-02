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
import { useCommandContextTag } from '../commands/useCommandContext';

const formatPackageSelection = (row: SeedDemand): string => {
  if (!row.package_suggestion || row.package_suggestion.selection.length === 0) {
    return 'Keine Packungsgrößen verfügbar';
  }

  return row.package_suggestion.selection
    .map((item) => `${item.size_value} ${item.size_unit === 'seeds' ? 'Korn' : 'g'}${item.count > 1 ? ` × ${item.count}` : ''}`)
    .join(' + ');
};

export default function SeedDemandPage(): React.ReactElement {
  useCommandContextTag('seedDemand');
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierSelection, setSupplierSelection] = useState<Record<number, number>>({});
  const [selectionLoaded, setSelectionLoaded] = useState(false);

  const supplierSelectionParam = Object.entries(supplierSelection)
    .map(([cultureId, supplierId]) => `${cultureId}:${supplierId}`)
    .join(',');

  const loadRows = async (selectionParam: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await seedDemandAPI.list(selectionParam);
      const resultRows = response.data.results ?? [];
      setRows(resultRows);
      if (!selectionLoaded) {
        const initialSelection: Record<number, number> = {};
        resultRows.forEach((row) => {
          if (row.culture_id && row.selected_supplier_id) {
            initialSelection[row.culture_id] = row.selected_supplier_id;
          }
        });
        if (Object.keys(initialSelection).length > 0) {
          setSupplierSelection(initialSelection);
        }
        setSelectionLoaded(true);
      }
    } catch {
      setError('Saatgutbedarf konnte nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(supplierSelectionParam);
  }, [selectionLoaded, supplierSelectionParam]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Saatgutbedarf
      </Typography>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!isLoading && !error && (
        <TableContainer component={Paper} sx={{ width: 'fit-content', maxWidth: '100%' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kultur</TableCell>
                <TableCell>Lieferant</TableCell>
                <TableCell align="right">Gesamtbedarf</TableCell>
                <TableCell>Packungsgrößen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.culture_id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/cultures?cultureId=${row.culture_id}`} underline="hover">
                      {row.variety ? `${row.culture_name} (${row.variety})` : row.culture_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {(row.supplier_options && row.supplier_options.length > 1) ? (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                          value={row.selected_supplier_id ?? ''}
                          onChange={(event) => {
                            const nextSupplierId = Number(event.target.value);
                            setSupplierSelection((prev) => {
                              const nextSelection = { ...prev, [row.culture_id]: nextSupplierId };
                              const nextParam = Object.entries(nextSelection)
                                .map(([cultureId, supplierId]) => `${cultureId}:${supplierId}`)
                                .join(',');
                              void loadRows(nextParam);
                              return nextSelection;
                            });
                          }}
                        >
                          {row.supplier_options.map((option) => (
                            <MenuItem key={option.supplier_id} value={option.supplier_id}>
                              {option.supplier_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : row.supplier_options && row.supplier_options.length === 1 ? (
                      row.supplier_options[0].supplier_name
                    ) : (
                      'Keine Lieferantendaten vorhanden'
                    )}
                  </TableCell>
                  <TableCell align="right">{row.required_amount_value === null || row.required_amount_unit === null ? '-' : `${row.required_amount_value.toFixed(2)} ${row.required_amount_unit === 'seeds' ? 'Korn' : 'g'}`}</TableCell>
                  <TableCell>{row.warning === 'Keine Lieferantendaten vorhanden.' ? 'Keine Lieferantendaten vorhanden' : formatPackageSelection(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
