import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
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
import AddIcon from '@mui/icons-material/Add';
import { supplierAPI } from '../api/api';
import { useTranslation } from '../i18n';
import type { Supplier } from '../api/types';

interface SupplierDraft {
  id?: number;
  name: string;
  homepage_url: string;
  allowed_domains: string[];
}

const suggestDomains = (homepageUrl: string): string[] => {
  try {
    const host = new URL(homepageUrl).hostname.toLowerCase().replace(/^www\./, '');
    return host ? [host, `www.${host}`] : [];
  } catch {
    return [];
  }
};

const isValidDomain = (domain: string): boolean => {
  if (!domain || domain.length > 253) return false;
  if (domain.includes('/') || domain.includes(':') || domain.includes(' ')) return false;
  // Check for valid hostname pattern
  const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  return domainPattern.test(domain);
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [draft, setDraft] = useState<SupplierDraft>({ name: '', homepage_url: '', allowed_domains: [] });

  const loadSuppliers = async (): Promise<void> => {
    const response = await supplierAPI.list();
    setSuppliers(response.data.results || []);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const openCreate = (): void => {
    setDraft({ name: '', homepage_url: '', allowed_domains: [] });
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier): void => {
    setDraft({
      id: supplier.id,
      name: supplier.name,
      homepage_url: supplier.homepage_url ?? '',
      allowed_domains: supplier.allowed_domains || [],
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
      
      // Client-side domain validation
      const invalidDomains = draft.allowed_domains.filter(d => !isValidDomain(d));
      if (invalidDomains.length > 0) {
        setError(t('invalidDomain', { domain: invalidDomains[0] }));
        return;
      }
      
      const payload = {
        name: draft.name.trim(),
        homepage_url: normalizedUrl,
        allowed_domains: draft.allowed_domains,
      };
      if (draft.id) {
        await supplierAPI.update(draft.id, payload);
      } else {
        await supplierAPI.create(payload.name, payload.homepage_url, payload.allowed_domains);
      }
      setDialogOpen(false);
      await loadSuppliers();
    } catch (saveError) {
      console.error('Error saving supplier', saveError);
      
      // Better error handling for backend validation errors
      if (axios.isAxiosError(saveError) && saveError.response?.data) {
        const errorData = saveError.response.data;
        if (typeof errorData.allowed_domains === 'string') {
          setError(errorData.allowed_domains);
        } else if (typeof errorData.homepage_url === 'string') {
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

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('title')}</h1>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('create')}
        </Button>
      </Box>
      <TableContainer sx={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={{ width: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('name')}</TableCell>
            <TableCell>{t('homepage')}</TableCell>
            <TableCell>{t('allowedDomains')}</TableCell>
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
              <TableCell>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {(supplier.allowed_domains || []).map((domain) => <Chip key={domain} size="small" label={domain} />)}
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => openEdit(supplier)}>{t('editAction')}</Button>
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
              setDraft((prev) => ({ ...prev, homepage_url: value, allowed_domains: prev.allowed_domains.length > 0 ? prev.allowed_domains : suggestDomains(value) }));
            }}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>{t('allowedDomains')}</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {draft.allowed_domains.map((domain) => (
                <Chip key={domain} label={domain} onDelete={() => setDraft((prev) => ({ ...prev, allowed_domains: prev.allowed_domains.filter((item) => item !== domain) }))} />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField size="small" fullWidth label={t('addDomain')} value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
              <Button onClick={() => {
                const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
                if (!domain) return;
                
                // Validate domain before adding
                if (!isValidDomain(domain)) {
                  setError(t('invalidDomain', { domain }));
                  return;
                }
                
                setError(''); // Clear any previous errors
                setDraft((prev) => ({ ...prev, allowed_domains: prev.allowed_domains.includes(domain) ? prev.allowed_domains : [...prev.allowed_domains, domain] }));
                setDomainInput('');
              }}>{t('add')}</Button>
            </Box>
          </Box>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={() => void saveSupplier()} disabled={!canSave} variant="contained">{t('save')}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
