import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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

interface SupplierDraft {
  id?: number;
  name: string;
  homepage_url: string;
};

interface SupplierFieldErrors {
  name?: string;
  homepage_url?: string;
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
  const { t } = useTranslation('suppliers');
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SupplierFieldErrors>({});
  const [draft, setDraft] = useState<SupplierDraft>({ name: '', homepage_url: '' });

  const loadSuppliers = async (): Promise<void> => {
    const response = await supplierAPI.list();
    setSuppliers(response.data.results || []);
  };

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setSuppliers([]);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    const createIntent = searchParams.get('create');
    if (createIntent !== '1' && createIntent !== 'true') {
      return;
    }

    setDraft({ name: '', homepage_url: '' });
    setError('');
    setFieldErrors({});
    setDialogOpen(true);
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, shouldShowProjectRequiredState]);

  const openEdit = (supplier: Supplier): void => {
    setDraft({
      id: supplier.id,
      name: supplier.name,
      homepage_url: supplier.homepage_url ?? '',
    });
    setError('');
    setFieldErrors({});
    setDialogOpen(true);
  };

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

  const deleteSupplier = async (supplier: Supplier): Promise<void> => {
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
  };

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
        {suppliers.length === 0 ? (
          <Box sx={{ width: '100%', maxWidth: 880 }}>
            <EmptyStateCard
              title={t('emptyState.title')}
              description={t('emptyState.description')}
              actions={[{ label: t('create'), to: '/app/suppliers?create=true' }]}
            />
          </Box>
        ) : (
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
                  <TableRow key={supplier.id} hover>
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
        )}
      </PageSurface>

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
