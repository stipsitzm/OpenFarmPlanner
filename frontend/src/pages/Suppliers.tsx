import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
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
import type { Supplier, SupplierDeleteUsage } from '../api/types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { useRegisterCreateActions } from '../commands/useCommandContext';
import { DELETE_UNDO_DURATION_MS, DeleteUndoSnackbar } from '../components/data-grid';
import { extractApiErrorMessage } from '../api/errors';

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

interface PendingSupplierDeletion {
  id: string;
  supplierId: number;
  supplier: Supplier;
  suppliersBeforeDelete: Supplier[];
  visible: boolean;
}

interface SupplierDeleteUsageDialogState {
  supplier: Supplier;
  usage: SupplierDeleteUsage;
}

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
  const [pendingSupplierDeletions, setPendingSupplierDeletions] = useState<PendingSupplierDeletion[]>([]);
  const [deleteUsageDialog, setDeleteUsageDialog] = useState<SupplierDeleteUsageDialogState | null>(null);
  const pendingSupplierDeleteTimersRef = useRef<Map<string, number>>(new Map());

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

  const showDeleteError = useCallback((message: string): void => {
    window.dispatchEvent(new CustomEvent('ofp:show-snackbar', {
      detail: {
        message,
        severity: 'error',
      },
    }));
  }, []);

  const removePendingSupplierDeletion = useCallback((deletionId: string): void => {
    setPendingSupplierDeletions((currentDeletions) =>
      currentDeletions.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

  const restorePendingSupplierDeletion = useCallback((deletion: PendingSupplierDeletion): void => {
    setSuppliers((currentSuppliers) => {
      if (currentSuppliers.some((supplier) => supplier.id === deletion.supplierId)) {
        return currentSuppliers;
      }
      const currentById = new Map<number, Supplier>();
      currentSuppliers.forEach((supplier) => {
        if (typeof supplier.id === 'number') {
          currentById.set(supplier.id, supplier);
        }
      });
      currentById.set(deletion.supplierId, deletion.supplier);
      const restoredSuppliers = deletion.suppliersBeforeDelete
        .map((supplier) => (typeof supplier.id === 'number' ? currentById.get(supplier.id) : supplier))
        .filter((supplier): supplier is Supplier => Boolean(supplier));
      const restoredIds = new Set(restoredSuppliers.map((supplier) => supplier.id));
      return [
        ...restoredSuppliers,
        ...currentSuppliers.filter((supplier) => !restoredIds.has(supplier.id)),
      ];
    });
  }, []);

  const finalizeSupplierDeletion = useCallback(async (deletion: PendingSupplierDeletion): Promise<void> => {
    pendingSupplierDeleteTimersRef.current.delete(deletion.id);
    removePendingSupplierDeletion(deletion.id);
    try {
      setError('');
      const usageResponse = await supplierAPI.deleteUsage(deletion.supplierId);
      if (!usageResponse.data.can_delete) {
        restorePendingSupplierDeletion(deletion);
        setDeleteUsageDialog({ supplier: deletion.supplier, usage: usageResponse.data });
        return;
      }
      await supplierAPI.delete(deletion.supplierId);
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError) && deleteError.response?.status === 404) {
        await loadSuppliers();
        return;
      }
      console.error('Error deleting supplier', deleteError);
      restorePendingSupplierDeletion(deletion);
      showDeleteError(extractApiErrorMessage(deleteError, t, t('deleteError')));
    }
  }, [loadSuppliers, removePendingSupplierDeletion, restorePendingSupplierDeletion, showDeleteError, t]);

  const undoSupplierDeletion = useCallback((deletionId: string): void => {
    const deletion = pendingSupplierDeletions.find((pendingDeletion) => pendingDeletion.id === deletionId);
    if (!deletion) {
      return;
    }

    const timerId = pendingSupplierDeleteTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingSupplierDeleteTimersRef.current.delete(deletionId);
    }

    restorePendingSupplierDeletion(deletion);
    removePendingSupplierDeletion(deletionId);
  }, [pendingSupplierDeletions, removePendingSupplierDeletion, restorePendingSupplierDeletion]);

  const closeSupplierDeletionSnackbar = useCallback((deletionId: string): void => {
    setPendingSupplierDeletions((currentDeletions) =>
      currentDeletions.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  useEffect(() => {
    return () => {
      pendingSupplierDeleteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingSupplierDeleteTimersRef.current.clear();
    };
  }, []);

  const deleteSupplier = useCallback(async (supplier: Supplier): Promise<void> => {
    if (!supplier.id || pendingSupplierDeletions.some((deletion) => deletion.supplierId === supplier.id)) {
      return;
    }

    try {
      setError('');
      const usageResponse = await supplierAPI.deleteUsage(supplier.id);
      if (!usageResponse.data.can_delete) {
        setDeleteUsageDialog({ supplier, usage: usageResponse.data });
        return;
      }
    } catch (usageError) {
      console.error('Error checking supplier usage', usageError);
      showDeleteError(extractApiErrorMessage(usageError, t, t('deleteError')));
      return;
    }

    const deletionId = `supplier-${supplier.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pendingDeletion: PendingSupplierDeletion = {
      id: deletionId,
      supplierId: supplier.id,
      supplier,
      suppliersBeforeDelete: suppliers,
      visible: true,
    };

    setSuppliers((currentSuppliers) => currentSuppliers.filter((currentSupplier) => currentSupplier.id !== supplier.id));
    setPendingSupplierDeletions((currentDeletions) => [...currentDeletions, pendingDeletion]);

    const timerId = window.setTimeout(() => {
      void finalizeSupplierDeletion(pendingDeletion);
    }, DELETE_UNDO_DURATION_MS);
    pendingSupplierDeleteTimersRef.current.set(deletionId, timerId);
  }, [finalizeSupplierDeletion, pendingSupplierDeletions, showDeleteError, suppliers, t]);

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

      <Dialog
        open={deleteUsageDialog !== null}
        onClose={() => setDeleteUsageDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>{t('deleteUsageDialog.title')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {deleteUsageDialog
              ? t('deleteUsageDialog.summary', { count: deleteUsageDialog.usage.total_culture_count })
              : ''}
          </Typography>
          {deleteUsageDialog ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'surface.surfaceSoftBorder',
                bgcolor: 'surface.surfaceSubtleBackground',
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 1 }}>
                {deleteUsageDialog.supplier.name}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                {deleteUsageDialog.usage.culture_count > 0 ? (
                  <Typography component="li" variant="body2">
                    {t('deleteUsageDialog.cultureUsage', { count: deleteUsageDialog.usage.culture_count })}
                  </Typography>
                ) : null}
                {deleteUsageDialog.usage.supplier_data_culture_count > 0 ? (
                  <Typography component="li" variant="body2">
                    {t('deleteUsageDialog.supplierDataUsage', {
                      cultureCount: deleteUsageDialog.usage.supplier_data_culture_count,
                      rowCount: deleteUsageDialog.usage.supplier_data_count,
                    })}
                  </Typography>
                ) : null}
                {deleteUsageDialog.usage.seed_demand_culture_count > 0 ? (
                  <Typography component="li" variant="body2">
                    {t('deleteUsageDialog.seedDemandUsage', { count: deleteUsageDialog.usage.seed_demand_culture_count })}
                  </Typography>
                ) : null}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t('deleteUsageDialog.blocked')}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={() => setDeleteUsageDialog(null)} variant="contained">
            {t('common:actions.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {pendingSupplierDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={t('messages.deleted')}
          undoLabel={t('common:actions.undo')}
          offsetIndex={index}
          testId="supplier-delete-snackbar"
          onClose={() => closeSupplierDeletionSnackbar(deletion.id)}
          onUndo={() => undoSupplierDeletion(deletion.id)}
        />
      ))}
    </PageContainer>
  );
}
