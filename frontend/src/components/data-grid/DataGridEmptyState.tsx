import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

interface DataGridEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function DataGridEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: DataGridEmptyStateProps): React.ReactElement {
  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 220,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 3,
      }}
    >
      <Stack spacing={1.25} alignItems="center" textAlign="center" sx={{ maxWidth: 440 }}>
        <InboxOutlinedIcon color="disabled" sx={{ fontSize: 36 }} />
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {actionLabel && onAction ? (
          <Button variant="outlined" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
