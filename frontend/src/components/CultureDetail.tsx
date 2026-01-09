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
import { useTranslation } from '../i18n';
import {
  Box,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Culture } from '../api/api';

interface CultureDetailProps {
  cultures: Culture[];
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
function formatDistance(value: number | null | undefined, t: (key: string) => string): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }
  
  return Math.round(value).toString();
}


export function CultureDetail({
  cultures,
  selectedCultureId,
  onCultureSelect,
}: CultureDetailProps): React.ReactElement {
  const { t } = useTranslation('cultures');
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
              label={t('searchPlaceholder')}
              placeholder={t('searchInputPlaceholder')}
              fullWidth
            />
          )}
          noOptionsText={t('noOptions')}
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
                <Box>
                  <Typography variant="h4" component="h2">
                    {selectedCulture.name}
                  </Typography>
                  {selectedCulture.variety && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedCulture.variety}
                    </Typography>
                  )}
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

            {/* Growth & Harvest Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                {t('sections.growthHarvest')}
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
                      {selectedCulture.nutrient_demand === 'low' ? 'Niedrig' : 
                       selectedCulture.nutrient_demand === 'medium' ? 'Mittel' : 'Hoch'}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.cultivation_type && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Anbauart
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.cultivation_type === 'pre_cultivation' ? 'Anzucht' : 'Direktsaat'}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.germination_rate && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Keimrate
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.germination_rate, t)}%
                    </Typography>
                  </Box>
                )}
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
                      {formatNumber(selectedCulture.expected_yield, t)}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.distance_within_row_cm && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Abstand in der Reihe
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.distance_within_row_cm, t)} cm
                    </Typography>
                  </Box>
                )}
                {selectedCulture.row_spacing_cm && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Reihenabstand
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.row_spacing_cm, t)} cm
                    </Typography>
                  </Box>
                )}
                {selectedCulture.sowing_depth_cm && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Saattiefe
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.sowing_depth_cm, t)} cm
                    </Typography>
                  </Box>
                )}
                {selectedCulture.safety_margin && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Sicherheitsmarge
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.safety_margin, t)}%
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
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('fields.lifespan')}
                  </Typography>
                  <Typography variant="body1">
                    {selectedCulture.median_lifespan
                      ? t('fields.lifespanValue', { days: selectedCulture.median_lifespan })
                      : t('noData')}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Info Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('sections.additionalInfo')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedCulture.notes && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Notizen
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedCulture.notes}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.en_wikipedia_url && (
                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    href={selectedCulture.en_wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('moreInfo')}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Growstuff Attribution */}
            {selectedCulture.source === 'growstuff' && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  {t('attribution')}{' '}
                  <a
                    href="https://www.growstuff.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    {t('attributionLink')}
                  </a>{' '}
                  {t('license')}{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/3.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    {t('licenseLink')}
                  </a>{' '}
                  {t('licenseEnd')}
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
              {t('selectPrompt')}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
