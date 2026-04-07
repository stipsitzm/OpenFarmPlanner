import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddIcon from '@mui/icons-material/Add';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RemoveIcon from '@mui/icons-material/Remove';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/system';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from '../../i18n';

export type HelpPageKey =
  | 'dashboard'
  | 'calendar'
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

interface HelpSection {
  title: string;
  points: string[];
}

/**
 * Displays the page-specific help content for the given page key.
 *
 * @remarks
 * Used in page headers to keep the previous contextual help texts available.
 *
 * @param props - Component properties.
 * @param props.pageKey - The help page key to render.
 * @returns JSX element with the page help entry point and content.
 */
export default function PageHelp({ pageKey }: PageHelpProps): ReactElement | null {
  const { t } = useTranslation('help');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const points = useMemo(() => {
    const translated = t(`pages.${pageKey}.points`, { returnObjects: true });
    if (!Array.isArray(translated)) {
      return [];
    }
    return translated.map((point) => String(point));
  }, [pageKey, t]);

  const sections = useMemo(() => {
    const translated = t(`pages.${pageKey}.sections`, { returnObjects: true });
    if (!Array.isArray(translated)) {
      return null;
    }
    return translated
      .map((section) => {
        if (!section || typeof section !== 'object') {
          return null;
        }
        const item = section as { title?: unknown; points?: unknown };
        if (typeof item.title !== 'string') {
          return null;
        }
        const sectionPoints = Array.isArray(item.points)
          ? item.points.map((point) => String(point))
          : [];
        return { title: item.title, points: sectionPoints } as HelpSection;
      })
      .filter((section): section is HelpSection => section !== null);
  }, [pageKey, t]);

  const hasSectionSymbols = useMemo(() => {
    const symbolEntries = t(`pages.${pageKey}.symbols`, { returnObjects: true }) as unknown;
    return !!symbolEntries && typeof symbolEntries === 'object' && !Array.isArray(symbolEntries);
  }, [pageKey, t]);

  const title = t(`pages.${pageKey}.title`);
  const symbolsTitle = t(`pages.${pageKey}.symbolsTitle`);
  const symbolItems = useMemo(() => {
    const translated = t(`pages.${pageKey}.symbols`, { returnObjects: true }) as unknown;
    if (!translated || typeof translated !== 'object' || Array.isArray(translated)) {
      return [];
    }
    return Object.values(translated as Record<string, unknown>).map((value) => String(value));
  }, [pageKey, t]);

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

  const renderGraphicalHelpContent = (): ReactElement => (
    <Stack spacing={2}>
      {sections?.map((section, sectionIndex) => (
        <Box key={`${pageKey}-graphical-section-${sectionIndex}`}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.75 }}>
            {section.title}
          </Typography>
          <List dense disablePadding>
            {section.points.map((point, pointIndex) => (
              <ListItem key={`${pageKey}-graphical-${sectionIndex}-${pointIndex}`} sx={{ py: 0.2, px: 0 }}>
                <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}

      <Box>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('pages.graphical.symbolsTitle')}
        </Typography>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack direction="row" spacing={0.25} alignItems="center">
              <KeyboardArrowUpIcon fontSize="small" />
              <KeyboardArrowLeftIcon fontSize="small" />
              <KeyboardArrowRightIcon fontSize="small" />
              <KeyboardArrowDownIcon fontSize="small" />
            </Stack>
            <Typography variant="body2">{t('pages.graphical.symbols.panArrows')}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <AddIcon fontSize="small" />
            <Typography variant="body2">{t('pages.graphical.symbols.zoomIn')}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <RemoveIcon fontSize="small" />
            <Typography variant="body2">{t('pages.graphical.symbols.zoomOut')}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FitScreenIcon fontSize="small" />
            <Typography variant="body2">{t('pages.graphical.symbols.fit')}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FullscreenIcon fontSize="small" />
            <Typography variant="body2">{t('pages.graphical.symbols.fullscreen')}</Typography>
          </Stack>
        </Stack>
      </Box>

      <Box>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('pages.graphical.modeTitle')}
        </Typography>
        <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: 1, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {t('pages.graphical.modeLabel')}
          </Typography>
          <ToggleButtonGroup value="view" exclusive size="small" aria-label={t('pages.graphical.modeLabel')}>
            <ToggleButton value="view" disabled>
              {t('pages.graphical.modeView')}
            </ToggleButton>
            <ToggleButton value="edit" disabled>
              {t('pages.graphical.modeEdit')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <List dense disablePadding sx={{ mt: 1 }}>
          <ListItem sx={{ py: 0.2, px: 0 }}>
            <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${t('pages.graphical.modeViewDescription')}`} />
          </ListItem>
          <ListItem sx={{ py: 0.2, px: 0 }}>
            <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${t('pages.graphical.modeEditDescription')}`} />
          </ListItem>
        </List>
      </Box>
    </Stack>
  );

  const renderAreasSymbolsContent = (): ReactElement => (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
        {t('pages.areas.symbolsTitle')}
      </Typography>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Stack direction="row" spacing={0.1} alignItems="center">
            <ChevronRightIcon fontSize="small" />
            <KeyboardArrowDownIcon fontSize="small" />
          </Stack>
          <Typography variant="body2">{t('pages.areas.symbols.expandToggle')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <AddIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="body2">{t('pages.areas.symbols.add')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          <Typography variant="body2">{t('pages.areas.symbols.delete')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <AgricultureIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="body2">{t('pages.areas.symbols.createPlan')}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <SwapVertIcon fontSize="small" />
          <SwapHorizIcon fontSize="small" />
          <Typography variant="body2">{t('pages.areas.symbols.dimensions')}</Typography>
        </Stack>
      </Stack>
    </Box>
  );

  const renderGenericSymbolsContent = (): ReactElement => (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.75 }}>
        {symbolsTitle}
      </Typography>
      <List dense disablePadding>
        {symbolItems.map((symbol, index) => (
          <ListItem key={`${pageKey}-symbol-${index}`} sx={{ py: 0.2, px: 0 }}>
            <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${symbol}`} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

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
        <Box sx={{ maxWidth: 720, width: { xs: 1, sm: 680 }, p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
          {pageKey === 'graphical' ? renderGraphicalHelpContent() : sections && sections.length > 0 ? (
            <List dense disablePadding>
              {sections.map((section, sectionIndex) => (
                <Box key={`${pageKey}-section-${sectionIndex}`} sx={{ mb: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {section.title}
                  </Typography>
                  {section.points.map((point, pointIndex) => (
                    <ListItem key={`${pageKey}-${sectionIndex}-${pointIndex}`} sx={{ py: 0.15, px: 0 }}>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
                    </ListItem>
                  ))}
                </Box>
              ))}
            </List>
          ) : null}

          {pageKey === 'areas' && hasSectionSymbols ? (
            <Box sx={{ mt: 1.5 }}>
              {renderAreasSymbolsContent()}
            </Box>
          ) : sections && sections.length > 0 && pageKey !== 'graphical' && symbolItems.length > 0 ? (
            <Box sx={{ mt: 1.5 }}>
              {renderGenericSymbolsContent()}
            </Box>
          ) : (
            pageKey !== 'graphical' && (!sections || sections.length === 0) ? (
              <List dense disablePadding>
                {points.map((point, index) => (
                  <ListItem key={`${pageKey}-${index}`} sx={{ py: 0.25, px: 0 }}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
                  </ListItem>
                ))}
              </List>
            ) : null
          )}
        </Box>
      </Popover>

      <Dialog
        open={mobileOpen}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            m: 0,
            mt: 'auto',
            borderRadius: '16px 16px 0 0',
            maxHeight: '85vh',
          },
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {pageKey === 'graphical' ? renderGraphicalHelpContent() : sections && sections.length > 0 ? (
            <List dense disablePadding>
              {sections.map((section, sectionIndex) => (
                <Box key={`${pageKey}-mobile-section-${sectionIndex}`} sx={{ mb: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {section.title}
                  </Typography>
                  {section.points.map((point, pointIndex) => (
                    <ListItem key={`${pageKey}-mobile-${sectionIndex}-${pointIndex}`} sx={{ py: 0.15, px: 0 }}>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
                    </ListItem>
                  ))}
                </Box>
              ))}
            </List>
          ) : null}

          {pageKey === 'areas' && hasSectionSymbols ? (
            <Box sx={{ mt: 1.5 }}>
              {renderAreasSymbolsContent()}
            </Box>
          ) : sections && sections.length > 0 && pageKey !== 'graphical' && symbolItems.length > 0 ? (
            <Box sx={{ mt: 1.5 }}>
              {renderGenericSymbolsContent()}
            </Box>
          ) : (
            pageKey !== 'graphical' && (!sections || sections.length === 0) ? (
              <List dense disablePadding>
                {points.map((point, index) => (
                  <ListItem key={`${pageKey}-mobile-${index}`} sx={{ py: 0.25, px: 0 }}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${point}`} />
                  </ListItem>
                ))}
              </List>
            ) : null
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
