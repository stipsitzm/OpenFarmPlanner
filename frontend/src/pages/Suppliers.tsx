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
    setDialogOpen(true);
  };

  const canSave = useMemo(() => draft.name.trim().length > 0 && draft.homepage_url.trim().length > 0, [draft]);

  const saveSupplier = async (): Promise<void> => {
    try {
      setError('');
      
      // Normalize URL (prepend https:// if no protocol)
      const normalizedUrl = normalizeUrl(draft.homepage_url);
      
      // Client-side URL validation
      if (normalizedUrl && !isValidUrl(normalizedUrl)) {
        setError(t('invalidUrl'));
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
      
      // Better error handling for backend validation errors
      if (axios.isAxiosError(saveError) && saveError.response?.data) {
        const errorData = saveError.response.data;
        if (typeof errorData.homepage_url === 'string') {
          setError(errorData.homepage_url);
        } else if (typeof errorData.name === 'string') {
          setError(errorData.name);
        } else {
          setError(t('saveError'));
        }
      } else {
        setError(t('saveError'));
      }
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
      <PageContainer variant="default">
        <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
          <ProjectRequiredState reason={missingProjectReason} />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="default">
      <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
        {suppliers.length === 0 ? (
          <Box sx={{ width: '100%', maxWidth: 880 }}>
            <EmptyStateCard
              title={t('emptyState.title')}
              description={t('emptyState.description')}
              actions={[{ label: t('create'), to: '/app/suppliers?create=true' }]}
            />
          </Box>
        ) : (
          <TableContainer sx={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ width: 'auto' }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('name')}</TableCell>
                  <TableCell>{t('homepage')}</TableCell>
                  <TableCell align="right">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id} hover>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>
                      {supplier.homepage_url ? (
                        <Link href={supplier.homepage_url} target="_blank" rel="noopener noreferrer" underline="hover">
                          {supplier.homepage_url}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{draft.id ? t('edit') : t('create')}</DialogTitle>
        <DialogContent>
          <TextField margin="dense" fullWidth label={t('name')} value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <TextField
            margin="dense"
            fullWidth
            label={t('homepage')}
            value={draft.homepage_url}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((prev) => ({ ...prev, homepage_url: value }));
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
