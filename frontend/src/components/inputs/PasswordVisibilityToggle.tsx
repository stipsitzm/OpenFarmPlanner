import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { IconButton } from '@mui/material';

interface PasswordVisibilityToggleProps {
  isVisible: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
  disabled?: boolean;
}

export default function PasswordVisibilityToggle({
  isVisible,
  showLabel,
  hideLabel,
  onToggle,
  disabled = false,
}: PasswordVisibilityToggleProps) {
  return (
    <IconButton
      aria-label={isVisible ? hideLabel : showLabel}
      edge="end"
      disabled={disabled}
      onClick={onToggle}
    >
      {isVisible ? <VisibilityOff /> : <Visibility />}
    </IconButton>
  );
}
