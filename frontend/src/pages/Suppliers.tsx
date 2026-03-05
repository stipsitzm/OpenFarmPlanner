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
  Switch,
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
import { supplierAPI } from '../api/api';
import { useTranslation } from '../i18n';
import type { Supplier } from '../api/types';

interface SupplierDraft {
  id?: number;
  name: string;
  homepage_url: string;
  allowed_domains: string[];
  is_active: boolean;
}

const suggestDomains = (homepageUrl: string): string[] => {
  try {
    const host = new URL(homepageUrl).hostname.toLowerCase().replace(/^www\./, '');
    return host ? [host, `www.${host}`] : [];
  } catch {
    return [];
  }
};

export default function Suppliers(): React.ReactElement {
  const { t } = useTranslation('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [draft, setDraft] = useState<SupplierDraft>({ name: '', homepage_url: '', allowed_domains: [], is_active: true });

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
    setDraft({ name: '', homepage_url: '', allowed_domains: [], is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier): void => {
    setDraft({
      id: supplier.id,
      name: supplier.name,
      homepage_url: supplier.homepage_url,
      allowed_domains: supplier.allowed_domains || [],
      is_active: supplier.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const canSave = useMemo(() => draft.name.trim().length > 0 && draft.homepage_url.trim().length > 0, [draft]);

  const saveSupplier = async (): Promise<void> => {
    try {
      setError('');
      const payload = {
        name: draft.name.trim(),
        homepage_url: draft.homepage_url.trim(),
        allowed_domains: draft.allowed_domains,
        is_active: draft.is_active,
      };
      if (draft.id) {
        await supplierAPI.update(draft.id, payload);
      } else {
        await supplierAPI.create(payload.name, payload.homepage_url, payload.allowed_domains, payload.is_active);
      }
      setDialogOpen(false);
      await loadSuppliers();
    } catch (saveError) {
      console.error('Error saving supplier', saveError);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{t('title')}</Typography>
        <Button variant="contained" onClick={openCreate}>{t('create')}</Button>
      </Box>
      <TableContainer sx={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={{ width: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('name')}</TableCell>
            <TableCell>{t('homepage')}</TableCell>
            <TableCell>{t('allowedDomains')}</TableCell>
            <TableCell>{t('active')}</TableCell>
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
              <TableCell>{supplier.is_active === false ? t('no') : t('yes')}</TableCell>
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
                setDraft((prev) => ({ ...prev, allowed_domains: prev.allowed_domains.includes(domain) ? prev.allowed_domains : [...prev.allowed_domains, domain] }));
                setDomainInput('');
              }}>{t('add')}</Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <Switch checked={draft.is_active} onChange={(e) => setDraft((prev) => ({ ...prev, is_active: e.target.checked }))} />
            <Typography>{t('active')}</Typography>
          </Box>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={() => void saveSupplier()} disabled={!canSave} variant="contained">{t('save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
