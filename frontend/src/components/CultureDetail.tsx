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

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';
import {
  Box,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
  Link,
} from '@mui/material';
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
                {/* Seeding attributes */}
                {(selectedCulture.seed_rate_value !== null && selectedCulture.seed_rate_value !== undefined) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Saatgutmenge
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.seed_rate_value}
                      {selectedCulture.seed_rate_unit === 'g_per_m2' ? ' g/m²' : selectedCulture.seed_rate_unit === 'pcs_per_m2' ? ' Stk./m²' : selectedCulture.seed_rate_unit === 'pcs_per_plant' ? ' Stk./Pflanze' : ''}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.sowing_calculation_safety_percent !== undefined && selectedCulture.sowing_calculation_safety_percent !== null && (
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
                      {selectedCulture.seeding_requirement_type === 'per_sqm' ? ' / m²' : selectedCulture.seeding_requirement_type === 'per_plant' ? ' / Pflanze' : ''}
                    </Typography>
                  </Box>
                )}
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
