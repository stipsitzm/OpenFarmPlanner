import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { seedDemandAPI, type SeedDemand } from '../api/api';
import { useCommandContextTag } from '../commands/CommandProvider';

export default function SeedDemandPage(): React.ReactElement {
  useCommandContextTag('seedDemand');
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await seedDemandAPI.list();
        setRows(response.data.results ?? []);
      } catch {
        setError('Saatgutbedarf konnte nicht geladen werden.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

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
                <TableCell align="right">Gesamt (g)</TableCell>
                <TableCell align="right">Pakete</TableCell>
                <TableCell>Vorschlag</TableCell>
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
                  <TableCell>{row.supplier || '-'}</TableCell>
                  <TableCell align="right">{row.total_grams === null ? '-' : row.total_grams.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.packages_needed ?? '-'}</TableCell>
                  <TableCell>{row.package_suggestion ? `Vorschlag: ${row.package_suggestion.selection.map((item) => `${item.size_value} ${item.size_unit} × ${item.count}`).join(' + ')} = ${row.package_suggestion.total_amount} ${row.package_suggestion.selection[0]?.size_unit ?? 'g'} (over: ${row.package_suggestion.overage})` : 'No pack sizes available for this culture'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
