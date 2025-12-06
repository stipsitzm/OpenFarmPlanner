/**
 * Culture Detail component with searchable dropdown and detailed crop information view.
 * 
 * Displays crop data from Growstuff API in a human-friendly layout.
 * UI text is in German as per requirements.
 * 
 * @param props - Component properties
 * @param props.cultures - Array of culture objects to display in dropdown
 * @param props.selectedCultureId - Currently selected culture ID
 * @param props.onCultureSelect - Callback when a culture is selected
 * @returns JSX element rendering the culture selector and detail view
 */

import { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Divider,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Culture } from '../api/client';

interface CultureDetailProps {
  cultures: Culture[];
  selectedCultureId?: number;
  onCultureSelect: (culture: Culture | null) => void;
}

/**
 * Formats a number with fallback for null/undefined values
 */
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Keine Angabe';
  }
  return value.toString();
}

/**
 * Calculates harvest window text from first and last harvest days
 */
function getHarvestWindow(
  first: number | null | undefined,
  last: number | null | undefined
): string {
  if (first === null || first === undefined || last === null || last === undefined) {
    return 'Keine Angabe';
  }
  return `${first}–${last} Tage nach der Aussaat`;
}

export function CultureDetail({
  cultures,
  selectedCultureId,
  onCultureSelect,
}: CultureDetailProps): React.ReactElement {
  const [searchText, setSearchText] = useState('');

  // Find the selected culture
  const selectedCulture = useMemo(
    () => cultures.find((c) => c.id === selectedCultureId) || null,
    [cultures, selectedCultureId]
  );

  // Filter cultures based on search text
  const filteredCultures = useMemo(() => {
    if (!searchText) return cultures;
    const lowerSearch = searchText.toLowerCase();
    return cultures.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        (c.variety && c.variety.toLowerCase().includes(lowerSearch))
    );
  }, [cultures, searchText]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Searchable Dropdown */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          options={filteredCultures}
          getOptionLabel={(option) =>
            option.variety ? `${option.name} (${option.variety})` : option.name
          }
          value={selectedCulture}
          onChange={(_, newValue) => onCultureSelect(newValue)}
          inputValue={searchText}
          onInputChange={(_, newInputValue) => setSearchText(newInputValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Kultur suchen"
              placeholder="Name der Kultur eingeben..."
              fullWidth
            />
          )}
          noOptionsText="Keine Kulturen gefunden"
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      </Box>

      {/* Detail View */}
      {selectedCulture && (
        <Card>
          <CardContent>
            {/* Header with crop name and badge */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" component="h2">
                  {selectedCulture.name}
                  {selectedCulture.variety && ` (${selectedCulture.variety})`}
                </Typography>
                <Chip
                  label={
                    selectedCulture.perennial === true
                      ? 'Mehrjährig'
                      : selectedCulture.perennial === false
                      ? 'Einjährig'
                      : 'Unbekannt'
                  }
                  color={
                    selectedCulture.perennial === true
                      ? 'success'
                      : selectedCulture.perennial === false
                      ? 'primary'
                      : 'default'
                  }
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Growth & Harvest Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Wachstum & Ernte
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Tage bis zur ersten Ernte
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.median_days_to_first_harvest)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Tage bis zur letzten Ernte
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.median_days_to_last_harvest)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Erntefenster
                  </Typography>
                  <Typography variant="body1">
                    {getHarvestWindow(
                      selectedCulture.median_days_to_first_harvest,
                      selectedCulture.median_days_to_last_harvest
                    )}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Typische Lebensdauer
                  </Typography>
                  <Typography variant="body1">
                    {selectedCulture.median_lifespan
                      ? `${selectedCulture.median_lifespan} Tage`
                      : 'Keine Angabe'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Info Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Weitere Informationen
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedCulture.en_wikipedia_url && (
                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    href={selectedCulture.en_wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Mehr Infos (Wikipedia)
                  </Button>
                )}
              </Box>
            </Box>

            {/* Growstuff Attribution */}
            {selectedCulture.source === 'growstuff' && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Datenquelle: Diese Informationen stammen von{' '}
                  <a
                    href="https://www.growstuff.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    Growstuff.org
                  </a>{' '}
                  und sind unter der{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/3.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    CC-BY-SA 3.0 Lizenz
                  </a>{' '}
                  verfügbar.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedCulture && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              Wählen Sie eine Kultur aus der Liste aus, um Details anzuzeigen.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
