import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

export type TableExportFormat = 'xlsx' | 'ods' | 'csv' | 'json';

interface ExportScopeOption {
  value: string;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
}

interface ExportFormatDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onExport: (format: TableExportFormat, scope?: string) => Promise<void>;
  formatLabel: string;
  formatLabels: Record<TableExportFormat, string>;
  jsonHint: string;
  cancelLabel: string;
  submitLabel: string;
  scopeLabel?: string;
  scopeOptions?: ExportScopeOption[];
  defaultScope?: string;
}

export function ExportFormatDialog({
  open,
  title,
  onClose,
  onExport,
  formatLabel,
  formatLabels,
  jsonHint,
  cancelLabel,
  submitLabel,
  scopeLabel,
  scopeOptions,
  defaultScope,
}: ExportFormatDialogProps) {
  const [scope, setScope] = useState(defaultScope ?? scopeOptions?.[0]?.value);
  const [format, setFormat] = useState<TableExportFormat>('xlsx');
  const [exporting, setExporting] = useState(false);
  const selectedScope = scopeOptions?.find((option) => option.value === scope);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await onExport(format, scope);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 0.5 }}>
          {scopeOptions?.length ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {scopeLabel}
              </Typography>
              <RadioGroup value={scope} onChange={(event) => setScope(event.target.value)}>
                {scopeOptions.map((option) => (
                  <Box key={option.value}>
                    <FormControlLabel
                      value={option.value}
                      control={<Radio size="small" />}
                      label={option.label}
                      disabled={option.disabled}
                    />
                    {option.disabled && scope === option.value && option.disabledHint ? (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                        {option.disabledHint}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </RadioGroup>
            </Box>
          ) : null}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {formatLabel}
            </Typography>
            <RadioGroup
              value={format}
              onChange={(event) => setFormat(event.target.value as TableExportFormat)}
            >
              {(['xlsx', 'ods', 'csv', 'json'] as const).map((value) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio size="small" />}
                  label={value === 'json' ? (
                    <Box>
                      <Typography variant="body2">{formatLabels[value]}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {jsonHint}
                      </Typography>
                    </Box>
                  ) : formatLabels[value]}
                />
              ))}
            </RadioGroup>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={exporting}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleExport()}
          disabled={exporting || Boolean(selectedScope?.disabled)}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
