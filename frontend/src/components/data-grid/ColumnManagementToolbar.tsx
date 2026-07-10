import { Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { Toolbar, ColumnsPanelTrigger } from '@mui/x-data-grid';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useTranslation } from '../../i18n';

export interface ColumnManagementToolbarProps {
  /** Whether Autofit is currently enabled. */
  autofitEnabled?: boolean;
  /** Called when the user toggles the Autofit checkbox. Omit to hide the control. */
  onAutofitChange?: (enabled: boolean) => void;
}

declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides extends ColumnManagementToolbarProps {}
}

/**
 * Toolbar rendered above the grid that opens MUI's native columns panel
 * (search, per-column show/hide, show/hide all, reset) via `columnVisibilityModel`.
 * The Autofit checkbox has no native MUI equivalent and stays custom.
 */
export function ColumnManagementToolbar({ autofitEnabled = false, onAutofitChange }: ColumnManagementToolbarProps) {
  const { t } = useTranslation('common');

  return (
    <Toolbar style={{ minHeight: 0, padding: 6 }}>
      {onAutofitChange ? (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={autofitEnabled}
              onChange={(e) => onAutofitChange(e.target.checked)}
              sx={{ py: 0.5 }}
            />
          }
          label={<Typography variant="body2">{t('columnVisibility.autofitLabel')}</Typography>}
          sx={{ mr: 1 }}
        />
      ) : null}
      <ColumnsPanelTrigger
        render={
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<ViewColumnIcon fontSize="small" />}
            title={t('columnVisibility.buttonTooltip')}
            sx={{ textTransform: 'none', flexShrink: 0, whiteSpace: 'nowrap', px: 1.25, bgcolor: 'background.paper' }}
          >
            {t('columnVisibility.button')}
          </Button>
        }
      />
    </Toolbar>
  );
}
