/**
 * Custom footer for hierarchy grid
 */

import { Box, IconButton } from '@mui/material';
import type { Location } from '../../api/client';

interface HierarchyFooterProps {
  locations: Location[];
  onAddField: (locationId?: number) => void;
}

export function HierarchyFooter({ locations, onAddField }: HierarchyFooterProps): React.ReactElement {
  const hasMultipleLocations = locations.length > 1;
  
  return (
    <Box sx={{ 
      p: 1, 
      display: 'flex', 
      justifyContent: 'center',
      alignItems: 'center',
      gap: 2,
      borderTop: '1px solid',
      borderColor: 'divider'
    }}>
      {!hasMultipleLocations && locations.length > 0 && (
        <IconButton
          onClick={() => onAddField(locations[0]?.id)}
          color="primary"
          size="small"
          aria-label="Neuen Schlag hinzufügen"
        >
          <span style={{ fontSize: '0.875rem', marginRight: '4px' }}>+ Schlag</span>
        </IconButton>
      )}
      <span style={{ color: '#666', fontSize: '0.875rem' }}>
        {hasMultipleLocations 
          ? 'Erweitern Sie Standorte/Schläge um neue Schläge/Beete hinzuzufügen'
          : 'Erweitern Sie Schläge um Beete hinzuzufügen'}
      </span>
    </Box>
  );
}
