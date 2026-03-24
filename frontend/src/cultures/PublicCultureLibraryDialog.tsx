import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import type { PublicCulture } from '../api/types';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface PublicCultureLibraryDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  cultures: PublicCulture[];
  importingId: number | null;
  onClose: () => void;
  onSearch: (query: string) => void;
  onImport: (culture: PublicCulture) => void;
}

export function PublicCultureLibraryDialog({
  open,
  loading,
  error,
  cultures,
  importingId,
  onClose,
  onSearch,
  onImport,
}: PublicCultureLibraryDialogProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedId(null);
    }
  }, [open]);

  const selectedCulture = useMemo(
    () => cultures.find((entry) => entry.id === selectedId) ?? null,
    [cultures, selectedId],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('library.dialogTitle')}</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          label={t('library.searchLabel')}
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onSearch(nextValue);
          }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ mb: 2 }}
        />

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : null}

        {!loading && cultures.length === 0 ? (
          <Typography color="text.secondary">{t('library.empty')}</Typography>
        ) : null}

        {!loading && cultures.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 2 }}>
            <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 420, overflowY: 'auto' }}>
              {cultures.map((culture) => (
                <ListItemButton
                  key={culture.id}
                  selected={culture.id === selectedId}
                  onClick={() => setSelectedId(culture.id)}
                  alignItems="flex-start"
                >
                  <ListItemText
                    primary={culture.variety ? `${culture.name} (${culture.variety})` : culture.name}
                    secondary={culture.supplier_name || culture.seed_supplier || t('noData')}
                  />
                </ListItemButton>
              ))}
            </List>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 240 }}>
              {selectedCulture ? (
                <>
                  <Typography variant="h6">{selectedCulture.name}</Typography>
                  {selectedCulture.variety ? (
                    <Typography color="text.secondary" sx={{ mb: 1 }}>{selectedCulture.variety}</Typography>
                  ) : null}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip size="small" label={`${t('library.versionLabel')} ${selectedCulture.version}`} />
                    {selectedCulture.created_by_label ? (
                      <Chip size="small" label={`${t('library.createdByLabel')} ${selectedCulture.created_by_label}`} />
                    ) : null}
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t('form.supplier')}:</strong> {selectedCulture.supplier_name || selectedCulture.seed_supplier || t('noData')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t('form.growthDurationDays')}:</strong> {selectedCulture.growth_duration_days ?? t('noData')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t('form.harvestDurationDays')}:</strong> {selectedCulture.harvest_duration_days ?? t('noData')}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    <strong>{t('form.notes')}:</strong> {selectedCulture.notes || t('noData')}
                  </Typography>
                </>
              ) : (
                <Typography color="text.secondary">{t('library.selectPrompt')}</Typography>
              )}
            </Box>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('form.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => selectedCulture && onImport(selectedCulture)}
          disabled={!selectedCulture || importingId === selectedCulture?.id}
        >
          {importingId === selectedCulture?.id ? t('library.importing') : t('library.importButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
