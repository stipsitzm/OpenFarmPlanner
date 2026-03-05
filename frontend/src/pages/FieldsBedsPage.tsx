import { Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';

type ViewMode = 'table' | 'graphical';

export default function FieldsBedsPage(): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'graphical' ? 'graphical' : 'table';
  });

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" px={3} pt={2}>
        <Typography variant="h4">Anbauflächen</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={viewMode === 'graphical'}
              onChange={(_, checked) => setViewMode(checked ? 'graphical' : 'table')}
              inputProps={{ 'aria-label': 'Grafische Ansicht umschalten' }}
            />
          }
          label={viewMode === 'graphical' ? 'Grafische Ansicht' : 'Tabellarische Ansicht'}
        />
      </Stack>
      {viewMode === 'graphical' ? <GraphicalFields showTitle={false} /> : <FieldsBedsHierarchy showTitle={false} />}
    </Box>
  );
}
