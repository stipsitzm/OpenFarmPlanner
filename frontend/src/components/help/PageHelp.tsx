import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/system';
import { useTranslation } from '../../i18n';

export type HelpPageKey =
  | 'dashboard'
  | 'locations'
  | 'fields'
  | 'beds'
  | 'areas'
  | 'cultures'
  | 'plantingPlans'
  | 'seedDemand'
  | 'suppliers'
  | 'graphical';

interface PageHelpProps {
  pageKey: HelpPageKey;
}

function storageKey(pageKey: HelpPageKey): string {
  return `pageHelpHidden:${pageKey}`;
}

export default function PageHelp({ pageKey }: PageHelpProps): React.ReactElement | null {
  const { t } = useTranslation('help');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    setIsHidden(window.localStorage.getItem(storageKey(pageKey)) === '1');
  }, [pageKey]);

  const points = useMemo(
    () => t(`pages.${pageKey}.points`, { returnObjects: true }) as string[],
    [pageKey, t],
  );

  const title = t(`pages.${pageKey}.title`);

  const handleOpen = (event: React.MouseEvent<HTMLElement>): void => {
    if (isMobile) {
      setMobileOpen(true);
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
    setMobileOpen(false);
  };

  const handleHiddenToggle = (checked: boolean): void => {
    if (checked) {
      window.localStorage.setItem(storageKey(pageKey), '1');
      setIsHidden(true);
      handleClose();
      return;
    }
    window.localStorage.removeItem(storageKey(pageKey));
    setIsHidden(false);
  };

  if (isHidden) {
    return null;
  }

  return (
    <>
      <Tooltip title={t('showTooltip')}>
        <IconButton aria-label={t('showTooltip')} onClick={handleOpen} size="small" sx={{ color: 'text.secondary' }}>
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ maxWidth: 360, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
          <List dense disablePadding>
            {points.map((point, index) => (
              <ListItem key={`${pageKey}-${index}`} sx={{ py: 0.25, px: 0 }}>
                <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
              </ListItem>
            ))}
          </List>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox size="small" onChange={(event) => handleHiddenToggle(event.target.checked)} />}
            label={<Typography variant="caption">{t('hideForPage')}</Typography>}
          />
        </Box>
      </Popover>

      <Dialog
        open={mobileOpen}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            m: 0,
            mt: 'auto',
            borderRadius: '16px 16px 0 0',
          },
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <List dense disablePadding>
            {points.map((point, index) => (
              <ListItem key={`${pageKey}-mobile-${index}`} sx={{ py: 0.25, px: 0 }}>
                <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
              </ListItem>
            ))}
          </List>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox size="small" onChange={(event) => handleHiddenToggle(event.target.checked)} />}
            label={<Typography variant="caption">{t('hideForPage')}</Typography>}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
