import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Box, Button, Card, CardContent, Collapse, Stack, Typography } from '@mui/material';

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
    <Stack spacing={1.5}>
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        return (
          <Card key={item.id} variant="outlined">
            <CardContent sx={{ pb: 1.5 }}>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {renderPrimary(item)}
                  </Typography>
                  {renderSecondary ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {renderSecondary(item)}
                    </Typography>
                  ) : null}
                </Box>

                <Button
                  variant="text"
                  size="large"
                  onClick={() => onToggleExpanded(item.id)}
                  endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ alignSelf: 'flex-start', px: 0.5, minHeight: 40 }}
                >
                  {isExpanded ? detailsHideLabel : detailsShowLabel}
                </Button>

                <Collapse in={isExpanded}>
                  <Box sx={{ pt: 0.5 }}>
                    {renderDetails(item)}
                    {renderActions ? (
                      <Box sx={{ mt: 1.25 }}>
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
