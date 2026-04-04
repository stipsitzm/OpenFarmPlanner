import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Box, Card, CardContent, Collapse, IconButton, Stack, Typography } from '@mui/material';

export interface MobileCardListItem {
  id: string | number;
}

interface MobileCardListProps<T extends MobileCardListItem> {
  items: T[];
  expandedIds: Set<string | number>;
  onToggleExpanded: (id: string | number) => void;
  renderPrimary: (item: T) => React.ReactNode;
  renderSecondary?: (item: T) => React.ReactNode;
  renderDetails: (item: T) => React.ReactNode;
  renderActions?: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  detailsShowLabel: string;
  detailsHideLabel: string;
}

export function MobileCardList<T extends MobileCardListItem>({
  items,
  expandedIds,
  onToggleExpanded,
  renderPrimary,
  renderSecondary,
  renderDetails,
  renderActions,
  emptyState,
  detailsShowLabel,
  detailsHideLabel,
}: MobileCardListProps<T>): React.ReactElement {
  if (items.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        return (
          <Card key={item.id} variant="outlined">
            <CardContent sx={{ px: 1.5, py: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3, pr: 0.5 }}>
                    {renderPrimary(item)}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => onToggleExpanded(item.id)}
                    aria-label={isExpanded ? detailsHideLabel : detailsShowLabel}
                    sx={{ mt: -0.25, mr: -0.5, flexShrink: 0 }}
                  >
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </Stack>

                {renderSecondary ? (
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                    {renderSecondary(item)}
                  </Typography>
                ) : null}

                <Collapse in={isExpanded}>
                  <Box sx={{ pt: 0.25 }}>
                    {renderDetails(item)}
                    {renderActions ? (
                      <Box sx={{ mt: 1 }}>
                        {renderActions(item)}
                      </Box>
                    ) : null}
                  </Box>
                </Collapse>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
