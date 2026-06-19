import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import MouseOutlinedIcon from '@mui/icons-material/MouseOutlined';
import { Box, useMediaQuery } from '@mui/material';
import { useTranslation } from '../../i18n';

const HIGHLIGHT_DURATION_MS = 6000;
const APPEAR_DELAY_MS = 400;

interface FirstRowHintProps {
  show: boolean;
  containerRef: RefObject<HTMLElement | null>;
}

export function FirstRowHint({ show, containerRef }: FirstRowHintProps) {
  const { t } = useTranslation('common');
  const isDesktop = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const [visible, setVisible] = useState(false);
  const [topOffset, setTopOffset] = useState(0);
  const timerRef = useRef<number | null>(null);
  const appearRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!show || !isDesktop) return;

    const container = containerRef.current;
    if (!container) return;

    const measure = (): void => {
      const firstRow = container.querySelector<HTMLElement>(
        '[role="row"][data-id], tbody tr[tabindex]',
      );
      if (!firstRow) return;
      const containerRect = container.getBoundingClientRect();
      const rowRect = firstRow.getBoundingClientRect();
      setTopOffset(rowRect.top - containerRect.top + rowRect.height / 2);
    };

    measure();
    // Re-measure after a short delay so the grid has finished rendering
    const t = window.setTimeout(measure, 80);
    return () => window.clearTimeout(t);
  }, [show, isDesktop, containerRef]);

  useEffect(() => {
    if (!show || !isDesktop) {
      setVisible(false);
      return;
    }

    appearRef.current = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    timerRef.current = window.setTimeout(
      () => setVisible(false),
      APPEAR_DELAY_MS + HIGHLIGHT_DURATION_MS,
    );

    return () => {
      if (appearRef.current !== null) window.clearTimeout(appearRef.current);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [show, isDesktop]);

  if (!visible || !isDesktop) return null;

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: topOffset,
        right: 10,
        transform: 'translateY(-50%)',
        zIndex: 4,
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.875,
        py: 0.375,
        borderRadius: 1,
        bgcolor: 'success.50',
        border: '1px solid',
        borderColor: 'success.200',
        color: 'success.dark',
        fontSize: '0.72rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        animation: 'ofpFirstRowHint 6s ease-in-out forwards',
        '@keyframes ofpFirstRowHint': {
          '0%': { opacity: 0 },
          '8%': { opacity: 1 },
          '75%': { opacity: 1 },
          '100%': { opacity: 0 },
        },
      }}
    >
      <MouseOutlinedIcon sx={{ fontSize: 13, color: 'success.main' }} />
      {t('messages.contextMenuFirstRowHint')}
    </Box>
  );
}
