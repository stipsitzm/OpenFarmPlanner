import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';
import { useTranslation } from '../i18n';
import PageHelp from '../components/help/PageHelp';
import PageContainer from '../components/layout/PageContainer';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';

type ViewMode = 'table' | 'graphical';

export default function FieldsBedsPage(): React.ReactElement {
  const { t } = useTranslation(['fields', 'hierarchy']);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'graphical' ? 'graphical' : 'table';
  });

  useCommandContextTag('areas');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'areas.toggleGraphicalView',
      label: 'Ansicht umschalten (Alt+G)',
      group: 'navigation',
      keywords: ['ansicht', 'grafisch', 'tabelle', 'anbauflächen'],
      shortcutHint: 'Alt+G',
      contextTags: ['areas'],
      isEnabled: () => true,
      action: () => {
        setViewMode((previous) => (previous === 'graphical' ? 'table' : 'graphical'));
      },
    },
  ], []);

  useRegisterCommands('areas-view-switch', commands);


  useEffect(() => {
    const handleToggleViewShortcut = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }
      if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() !== 'g') {
        return;
      }

      event.preventDefault();
      setViewMode((previous) => (previous === 'graphical' ? 'table' : 'graphical'));
    };

    window.addEventListener('keydown', handleToggleViewShortcut);
    return () => window.removeEventListener('keydown', handleToggleViewShortcut);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  return (
    <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <h1>{t('hierarchy:title')}</h1>
        <PageHelp pageKey={viewMode === 'graphical' ? 'graphical' : 'areas'} />
      </Box>
      <Stack spacing={0.75} sx={{ mb: 2, width: { xs: '100%', sm: 'fit-content' } }}>
        <Typography variant="subtitle2">{t('fields:representation.label')}</Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, selectedViewMode: ViewMode | null) => {
            if (selectedViewMode !== null) {
              setViewMode(selectedViewMode);
            }
          }}
          size="small"
          color="primary"
          aria-label={t('fields:representation.ariaLabel')}
          fullWidth
        >
          <ToggleButton value="table" aria-label={t('fields:representation.table')}>
            {t('fields:representation.table')}
          </ToggleButton>
          <ToggleButton value="graphical" aria-label={t('fields:representation.graphical')}>
            {t('fields:representation.graphical')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {viewMode === 'graphical' ? <GraphicalFields showTitle={false} /> : <FieldsBedsHierarchy showTitle={false} />}
    </PageContainer>
  );
}
