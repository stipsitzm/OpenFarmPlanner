import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

import type { CultureHistoryEntry } from '../api/types';

interface RestoreVersionDialogProps {
  /** The dialog is open while this is non-null. */
  entry: CultureHistoryEntry | null;
  /** Fallback title when the entry has no display name (page supplies i18n). */
  getEntryTitle: (entry: CultureHistoryEntry) => string;
  formatTimestamp: (value: string) => string;
  onClose: () => void;
  onConfirm: (historyId: number) => void;
}

/**
 * Presentational confirmation dialog for restoring a project version from
 * the history panel. State and the restore handler live in RootLayout.tsx;
 * this component only renders. The copy is intentionally German-only,
 * matching the original inline dialog.
 */
export function RestoreVersionDialog({
  entry,
  getEntryTitle,
  formatTimestamp,
  onClose,
  onConfirm,
}: RestoreVersionDialogProps) {
  return (
    <Dialog open={Boolean(entry)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Version wiederherstellen?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Du stellst eine frühere Version wieder her.
        </Typography>
        {entry ? (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {entry.object_display_name?.trim() || getEntryTitle(entry)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Bearbeitet am {formatTimestamp(entry.history_date)}
            </Typography>
          </Box>
        ) : null}
        <Box
          sx={{
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'success.light',
            bgcolor: 'rgba(76, 175, 80, 0.08)',
            px: 1.25,
            py: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Die aktuelle Version bleibt erhalten. Vor der Wiederherstellung wird automatisch eine neue Version erstellt, sodass du jederzeit wieder zurückwechseln kannst.
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Es gehen keine Daten verloren.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button autoFocus variant="outlined" onClick={onClose}>Abbrechen</Button>
        <Button
          variant="contained"
          onClick={() => {
            if (entry) {
              onConfirm(entry.history_id);
            }
          }}
        >
          Version wiederherstellen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
