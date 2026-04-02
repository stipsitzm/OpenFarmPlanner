import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { CultureImportState } from './useCultureImportState';

type Translator = (key: string, options?: Record<string, unknown>) => string;

type CulturesImportDialogProps = {
  open: boolean;
  importState: CultureImportState;
  hasImportableEntries: boolean;
  confirmUpdates: boolean;
  onConfirmUpdatesChange: (value: boolean) => void;
  onClose: () => void;
  onImportStart: () => void;
  t: Translator;
};

export function CulturesImportDialog({
  open,
  importState,
  hasImportableEntries,
  confirmUpdates,
  onConfirmUpdatesChange,
  onClose,
  onImportStart,
  t,
}: CulturesImportDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('import.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body1">
            {t('import.foundCount', { count: importState.validCount || importState.previewCount })}
          </Typography>
          {importState.previewCount !== importState.validCount && (
            <Typography variant="body2" color="warning.main">
              {t('import.invalidCount', {
                invalid: importState.previewCount - importState.validCount,
              })}
            </Typography>
          )}

          {importState.previewResults.length > 0 && (
            <>
              {(() => {
                const newCultures = importState.previewResults.filter((result) => result.status === 'create');
                return newCultures.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" color="success.main">
                      {t('import.newCultures')} ({newCultures.length})
                    </Typography>
                    <List dense>
                      {newCultures.map((result) => (
                        <ListItem key={result.index}>
                          <ListItemText
                            primary={`${result.import_data.name}${result.import_data.variety ? ` (${result.import_data.variety})` : ''}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                );
              })()}

              {(() => {
                const updateCandidates = importState.previewResults.filter((result) => result.status === 'update_candidate');
                return updateCandidates.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" color="warning.main">
                      {t('import.updateCandidates')} ({updateCandidates.length})
                    </Typography>
                    <List dense>
                      {updateCandidates.map((result) => (
                        <ListItem key={result.index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <ListItemText
                            primary={`${result.import_data.name}${result.import_data.variety ? ` (${result.import_data.variety})` : ''}`}
                            secondary={result.diff && result.diff.length > 0 ? t('import.fieldsChanged', { count: result.diff.length }) : t('import.noChanges')}
                          />
                          {result.diff && result.diff.length > 0 && (
                            <Box sx={{ ml: 2, fontSize: '0.875rem' }}>
                              {result.diff.map((change, index) => (
                                <Typography key={index} variant="caption" display="block">
                                  {change.field}: {JSON.stringify(change.current)} → {JSON.stringify(change.new)}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <input
                        type="checkbox"
                        id="confirm-updates"
                        checked={confirmUpdates}
                        onChange={(event) => onConfirmUpdatesChange(event.target.checked)}
                      />
                      <label htmlFor="confirm-updates">
                        <Typography variant="body2">{t('import.confirmUpdates')}</Typography>
                      </label>
                    </Box>
                  </Box>
                );
              })()}
            </>
          )}

          {importState.invalidEntries.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" color="error.main">
                {t('import.invalidEntries')} ({importState.invalidEntries.length})
              </Typography>
              <List dense>
                {importState.invalidEntries.map((entry) => (
                  <ListItem key={entry}>
                    <ListItemText primary={entry} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {importState.failedEntries.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" color="error.main">
                {t('import.failedEntries')} ({importState.failedEntries.length})
              </Typography>
              <List dense>
                {importState.failedEntries.map((entry, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={entry.name ? `${entry.name}${entry.variety ? ` (${entry.variety})` : ''}` : `${t('import.invalidEntry')} ${entry.index + 1}`}
                      secondary={typeof entry.error === 'string' ? entry.error : JSON.stringify(entry.error)}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {importState.error && <Alert severity="error">{importState.error}</Alert>}
          {importState.success && <Alert severity="success">{importState.success}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('import.close')}</Button>
        <Button
          variant="contained"
          onClick={onImportStart}
          disabled={!hasImportableEntries || importState.status === 'uploading' || importState.status === 'success'}
        >
          {importState.status === 'success' ? t('import.done') : t('import.start')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
