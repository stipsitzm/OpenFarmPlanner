import AddIcon from '@mui/icons-material/Add';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PublicIcon from '@mui/icons-material/Public';
import RemoveIcon from '@mui/icons-material/Remove';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import TabIcon from '@mui/icons-material/Tab';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import { useMemo, useState, type MouseEvent, type ReactElement } from 'react';
import { useTranslation } from '../../i18n';
import HelpIconRow from './HelpIconRow';

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

interface SymbolDefinition {
  key: string;
  icon: ReactElement;
}

const PAGE_SYMBOL_DEFINITIONS: Partial<Record<HelpPageKey, SymbolDefinition[]>> = {
  areas: [
    { key: 'add', icon: <AddIcon fontSize="small" sx={{ color: 'primary.main' }} /> },
    { key: 'createPlan', icon: <AgricultureIcon fontSize="small" sx={{ color: 'primary.main' }} /> },
    {
      key: 'expandToggle',
      icon: (
        <Stack direction="row" spacing={0.1} alignItems="center">
          <ChevronRightIcon fontSize="small" />
          <ArrowDropDownIcon fontSize="small" />
        </Stack>
      ),
    },
    {
      key: 'dimensions',
      icon: (
        <Stack direction="row" spacing={0.25} alignItems="center">
          <SwapVertIcon fontSize="small" />
          <SwapHorizIcon fontSize="small" />
        </Stack>
      ),
    },
    { key: 'delete', icon: <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /> },
  ],
  cultures: [
    { key: 'add', icon: <AddIcon fontSize="small" /> },
    { key: 'library', icon: <PublicIcon fontSize="small" /> },
    { key: 'edit', icon: <EditIcon fontSize="small" /> },
    { key: 'more', icon: <MoreVertIcon fontSize="small" /> },
    { key: 'delete', icon: <DeleteIcon fontSize="small" /> },
  ],
  plantingPlans: [
    { key: 'add', icon: <AddIcon fontSize="small" /> },
    { key: 'mobileAdd', icon: <AddIcon fontSize="small" sx={{ bgcolor: 'action.hover', borderRadius: '50%' }} /> },
    { key: 'edit', icon: <EditIcon fontSize="small" /> },
    { key: 'notes', icon: <NoteAltIcon fontSize="small" /> },
  ],
  calendar: [
    { key: 'tabs', icon: <TabIcon fontSize="small" /> },
    { key: 'switch', icon: <ToggleOnIcon fontSize="small" /> },
    { key: 'tooltip', icon: <InfoOutlinedIcon fontSize="small" /> },
  ],
  seedDemand: [
    { key: 'supplierSelect', icon: <ArrowDropDownIcon fontSize="small" /> },
    { key: 'packageInfo', icon: <OpenInFullIcon fontSize="small" /> },
  ],
  suppliers: [
    { key: 'add', icon: <AddIcon fontSize="small" /> },
    { key: 'edit', icon: <EditIcon fontSize="small" /> },
    { key: 'delete', icon: <DeleteIcon fontSize="small" /> },
  ],
  graphical: [
    {
      key: 'panArrows',
      icon: (
        <Stack direction="row" spacing={0.25} alignItems="center">
          <KeyboardArrowUpIcon fontSize="small" />
          <KeyboardArrowLeftIcon fontSize="small" />
          <KeyboardArrowRightIcon fontSize="small" />
          <KeyboardArrowDownIcon fontSize="small" />
        </Stack>
      ),
    },
    { key: 'zoomIn', icon: <AddIcon fontSize="small" /> },
    { key: 'zoomOut', icon: <RemoveIcon fontSize="small" /> },
    { key: 'fit', icon: <FitScreenIcon fontSize="small" /> },
    { key: 'fullscreen', icon: <FullscreenIcon fontSize="small" /> },
  ],
};

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

  const title = t(`pages.${pageKey}.title`);
  const symbolsTitle = t(`pages.${pageKey}.symbolsTitle`);
  const symbolRows = useMemo(() => {
    const symbolDefinitions = PAGE_SYMBOL_DEFINITIONS[pageKey];
    if (!symbolDefinitions || symbolDefinitions.length === 0) {
      return [];
    }

    return symbolDefinitions
      .map((definition) => {
        const translated = t(`pages.${pageKey}.symbols.${definition.key}`);
        if (!translated || translated === `pages.${pageKey}.symbols.${definition.key}`) {
          return null;
        }
        return { icon: definition.icon, text: translated };
      })
      .filter((item): item is { icon: ReactElement; text: string } => item !== null);
  }, [pageKey, t]);

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
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
          {symbolRows.map((row, index) => (
            <HelpIconRow key={`${pageKey}-symbol-row-${index}`} icon={row.icon} text={row.text} />
          ))}
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

  const renderSymbolsContent = (): ReactElement => (
    <Box>
      <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.75 }}>
        {symbolsTitle}
      </Typography>
      <Stack spacing={1}>
        {symbolRows.map((row, index) => (
          <HelpIconRow key={`${pageKey}-symbol-${index}`} icon={row.icon} text={row.text} />
        ))}
      </Stack>
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

          {sections && sections.length > 0 && pageKey !== 'graphical' && symbolRows.length > 0 ? (
            <Box sx={{ mt: 1.5 }}>
              {renderSymbolsContent()}
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

          {sections && sections.length > 0 && pageKey !== 'graphical' && symbolRows.length > 0 ? (
            <Box sx={{ mt: 1.5 }}>
              {renderSymbolsContent()}
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
