import { FormControlLabel, Switch } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';

type ViewMode = 'table' | 'graphical';

export default function FieldsBedsPage(): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'graphical' ? 'graphical' : 'table';
  });

  useCommandContextTag('areas');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'areas.toggleGraphicalView',
      title: 'Ansicht umschalten (Alt+Shift+G)',
      keywords: ['ansicht', 'grafisch', 'tabelle', 'anbauflächen'],
      shortcutHint: 'Alt+Shift+G',
      keys: { alt: true, shift: true, key: 'G' },
      contextTags: ['areas'],
      isAvailable: () => true,
      run: () => {
        setViewMode((previous) => (previous === 'graphical' ? 'table' : 'graphical'));
      },
    },
  ], []);

  useRegisterCommands('areas-view-switch', commands);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  return (
    <div className="page-container">
      <h1>Anbauflächen</h1>
      <FormControlLabel
        sx={{ mb: 1 }}
        control={
          <Switch
            checked={viewMode === 'graphical'}
            onChange={(_, checked) => setViewMode(checked ? 'graphical' : 'table')}
            inputProps={{ 'aria-label': 'Grafische Ansicht umschalten' }}
          />
        }
        label={viewMode === 'graphical' ? 'Grafische Ansicht' : 'Tabellarische Ansicht'}
      />

      {viewMode === 'graphical' ? <GraphicalFields showTitle={false} /> : <FieldsBedsHierarchy showTitle={false} />}
    </div>
  );
}
