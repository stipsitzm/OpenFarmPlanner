import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  type ButtonProps,
  type DialogProps,
  type SxProps,
  type Theme,
  type TypographyProps,
} from '@mui/material';

type DialogButtonProps = Omit<ButtonProps, 'children' | 'onClick'>;
type DialogMessageProps = Omit<TypographyProps, 'children'>;

interface ConfirmationDialogProps {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  maxWidth?: DialogProps['maxWidth'];
  fullWidth?: DialogProps['fullWidth'];
  titleSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  messageTypographyProps?: DialogMessageProps;
  cancelButtonProps?: DialogButtonProps;
  confirmButtonProps?: DialogButtonProps;
  actionsSx?: SxProps<Theme>;
}

export function ConfirmationDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  maxWidth = 'xs',
  fullWidth,
  titleSx,
  contentSx,
  messageTypographyProps,
  cancelButtonProps,
  confirmButtonProps,
  actionsSx,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth={maxWidth} fullWidth={fullWidth}>
      <DialogTitle sx={titleSx}>{title}</DialogTitle>
      <DialogContent sx={contentSx}>
        <Typography variant="body2" {...messageTypographyProps}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={actionsSx}>
        <Button {...cancelButtonProps} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button {...confirmButtonProps} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
