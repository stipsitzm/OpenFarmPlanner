import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { supplierAPI } from '../api/api';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import TableSurface from '../components/layout/TableSurface';
import type { Supplier } from '../api/types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { useRegisterCreateActions } from '../commands/useCommandContext';

interface SupplierDraft {
  id?: number;
  name: string;
  homepage_url: string;
};

interface SupplierFieldErrors {
  name?: string;
  homepage_url?: string;
}

type SupplierLoadStatus = 'idle' | 'loading' | 'success' | 'error';

const normalizeUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  
  // Already has protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  
  // Prepend https://
  return `https://${trimmed}`;
};

const isValidUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function Suppliers(): React.ReactElement {
  const { t } = useTranslation(['suppliers', 'common']);
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoadStatus, setSupplierLoadStatus] = useState<SupplierLoadStatus>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SupplierFieldErrors>({});
  const [draft, setDraft] = useState<SupplierDraft>({ name: '', homepage_url: '' });
  const [contextMenuState, setContextMenuState] = useState<{
    supplier: Supplier;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const loadSuppliers = useCallback(async (): Promise<void> => {
    setSupplierLoadStatus('loading');
    setLoadError('');
    try {
      const response = await supplierAPI.list();
      setSuppliers(response.data.results || []);
      setSupplierLoadStatus('success');
    } catch (loadSuppliersError) {
      console.error('Error loading suppliers', loadSuppliersError);
      setSupplierLoadStatus('error');
      setLoadError(t('loadError'));
    }
  }, [t]);

  const openCreate = useCallback((): void => {
    setDraft({ name: '', homepage_url: '' });
    setError('');
    setFieldErrors({});
    setDialogOpen(true);
  }, []);

  const createActions = useMemo(() => [
    {
      id: 'create-supplier',
      label: t('create'),
      shortcut: 'Alt+Shift+N',
      disabled: shouldShowProjectRequiredState,
      handler: openCreate,
    },
  ], [openCreate, shouldShowProjectRequiredState, t]);

  useRegisterCreateActions('suppliers-page', createActions);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setSuppliers([]);
      setSupplierLoadStatus('idle');
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSuppliers, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    const createIntent = searchParams.get('create');
    if (createIntent !== '1' && createIntent !== 'true') {
      return;
    }

    openCreate();
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, openCreate, shouldShowProjectRequiredState]);

  const openEdit = useCallback((supplier: Supplier): void => {
    setDraft({
      id: supplier.id,
      name: supplier.name,
      homepage_url: supplier.homepage_url ?? '',
    });
    setError('');
    setFieldErrors({});
    setDialogOpen(true);
  }, []);

  const canSave = useMemo(() => draft.name.trim().length > 0, [draft]);

  const saveSupplier = async (): Promise<void> => {
    try {
      setError('');
      setFieldErrors({});
      
      // Normalize URL (prepend https:// if no protocol)
      const normalizedUrl = normalizeUrl(draft.homepage_url);
      
      // Client-side URL validation
      if (normalizedUrl && !isValidUrl(normalizedUrl)) {
        setFieldErrors({ homepage_url: t('invalidUrl') });
        return;
      }
      
      const payload = {
        name: draft.name.trim(),
        homepage_url: normalizedUrl,
        allowed_domains: [],
      };
      if (draft.id) {
        await supplierAPI.update(draft.id, payload);
      } else {
        await supplierAPI.create(payload.name, payload.homepage_url, []);
      }
      setDialogOpen(false);
      await loadSuppliers();
    } catch (saveError) {
      console.error('Error saving supplier', saveError);
      
      if (axios.isAxiosError(saveError) && saveError.response?.data) {
        const errorData = saveError.response.data as Record<string, unknown>;
        const fieldErrorValue = (value: unknown): string | undefined => {
          if (typeof value === 'string') return value;
          if (Array.isArray(value)) {
            return value.filter((entry): entry is string => typeof entry === 'string').join(' ');
          }
          return undefined;
        };
        const nextFieldErrors = {
          name: fieldErrorValue(errorData.name),
          homepage_url: fieldErrorValue(errorData.homepage_url),
        };
        if (nextFieldErrors.name || nextFieldErrors.homepage_url) {
          setFieldErrors(nextFieldErrors);
          return;
        }
      }
      setError(t('saveError'));
    }
  };

  const deleteSupplier = useCallback(async (supplier: Supplier): Promise<void> => {
    if (!supplier.id) return;
    const shouldDelete = window.confirm(t('deleteConfirm', { name: supplier.name }));
    if (!shouldDelete) return;

    try {
      setError('');
      await supplierAPI.delete(supplier.id);
      await loadSuppliers();
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError) && deleteError.response?.status === 404) {
        await loadSuppliers();
        return;
      }
      console.error('Error deleting supplier', deleteError);
      setError(t('deleteError'));
    }
  }, [loadSuppliers, t]);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
  }, []);

  const openSupplierContextMenu = useCallback((
    event: MouseEvent<HTMLTableRowElement>,
    supplier: Supplier,
  ): void => {
    event.preventDefault();
    setContextMenuState({
      supplier,
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    });
  }, []);

  const openSupplierKeyboardContextMenu = useCallback((
    event: KeyboardEvent<HTMLTableRowElement>,
    supplier: Supplier,
  ): void => {
    const shouldOpenContextMenu = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!shouldOpenContextMenu) {
      return;
    }

    event.preventDefault();
    const rowRect = event.currentTarget.getBoundingClientRect();
    setContextMenuState({
      supplier,
      mouseX: rowRect.left + Math.min(240, rowRect.width),
      mouseY: rowRect.top + 12,
    });
  }, []);

  const handleContextMenuEdit = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { supplier } = contextMenuState;
    closeContextMenu();
    openEdit(supplier);
  }, [closeContextMenu, contextMenuState, openEdit]);

  const handleContextMenuDelete = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { supplier } = contextMenuState;
    closeContextMenu();
    void deleteSupplier(supplier);
  }, [closeContextMenu, contextMenuState, deleteSupplier]);

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="xwide">
        <Box sx={{ width: '100%' }}>
          <ProjectRequiredState reason={missingProjectReason} />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="compactCenteredPage">
      <PageSurface variant="compact">
        {loadError ? <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 880 }}>{loadError}</Alert> : null}
        {!dialogOpen && error ? <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 880 }}>{error}</Alert> : null}
        {supplierLoadStatus === 'loading' ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: 880,
              minHeight: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              color: 'text.secondary',
            }}
          >
            <CircularProgress size={22} />
            <Typography variant="body2">{t('common:messages.loading')}</Typography>
          </Box>
        ) : null}
        {supplierLoadStatus === 'success' && suppliers.length === 0 ? (
          <Box sx={{ width: '100%', maxWidth: 880 }}>
            <EmptyStateCard
              title={t('emptyState.title')}
              description={t('emptyState.description')}
              actions={[{ label: t('create'), to: '/app/suppliers?create=true' }]}
            />
          </Box>
        ) : null}
        {supplierLoadStatus === 'success' && suppliers.length > 0 ? (
          <TableSurface sizingMode="compact">
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 1.5, minWidth: { xs: 140, sm: 180 } }}>{t('name')}</TableCell>
                  <TableCell sx={{ py: 1.5, minWidth: { xs: 180, sm: 280 } }}>{t('homepage')}</TableCell>
                  <TableCell align="right" sx={{ py: 1.5, width: 1, whiteSpace: 'nowrap' }}>{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    hover
                    tabIndex={0}
                    onContextMenu={(event) => openSupplierContextMenu(event, supplier)}
                    onKeyDown={(event) => openSupplierKeyboardContextMenu(event, supplier)}
                  >
                    <TableCell sx={{ py: 1.25 }}>{supplier.name}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      {supplier.homepage_url ? (
                        <Link href={supplier.homepage_url} target="_blank" rel="noopener noreferrer" underline="hover">
                          {supplier.homepage_url}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.25 }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={t('editAction')}
                        onClick={() => openEdit(supplier)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={t('deleteAction')}
                        onClick={() => void deleteSupplier(supplier)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </TableSurface>
        ) : null}
      </PageSurface>

      <Menu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuState !== null
            ? { top: contextMenuState.mouseY, left: contextMenuState.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleContextMenuEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('editAction')} />
        </MenuItem>
        <MenuItem onClick={handleContextMenuDelete}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t('deleteAction')}
            primaryTypographyProps={{ color: 'error.main' }}
          />
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{draft.id ? t('edit') : t('create')}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            fullWidth
            label={t('name')}
            value={draft.name}
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((prev) => ({ ...prev, name: value }));
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
          />
          <TextField
            margin="dense"
            fullWidth
            label={t('homepage')}
            value={draft.homepage_url}
            error={Boolean(fieldErrors.homepage_url)}
            helperText={fieldErrors.homepage_url}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((prev) => ({ ...prev, homepage_url: value }));
              setFieldErrors((prev) => ({ ...prev, homepage_url: undefined }));
            }}
          />
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={() => void saveSupplier()} disabled={!canSave} variant="contained">{t('save')}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
