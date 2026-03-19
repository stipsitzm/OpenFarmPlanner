import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraphicalFields from '../pages/GraphicalFields';

const mockUseHierarchyData = vi.fn();
const mockStageApi = {
  pointer: { x: 0, y: 0 },
  handlers: {} as {
    onDragStart?: (event: { evt: Event; target: { position: ({ x, y }: { x: number; y: number }) => void; x: () => number; y: () => number } }) => void;
    onDragMove?: (event: { evt: Event; target: { position: ({ x, y }: { x: number; y: number }) => void; x: () => number; y: () => number } }) => void;
    onDragEnd?: (event: { evt: Event; target: { position: ({ x, y }: { x: number; y: number }) => void; x: () => number; y: () => number } }) => void;
  },
  setPointer(x: number, y: number) {
    this.pointer = { x, y };
  },
};

vi.mock('../components/hierarchy/hooks/useHierarchyData', () => ({
  useHierarchyData: () => mockUseHierarchyData(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    layoutAPI: {
      ...actual.layoutAPI,
      listByLocation: vi.fn(async () => ({ data: { bed_layouts: [], field_layouts: [] } })),
      saveByLocation: vi.fn(async () => ({ data: { bed_layouts: [], field_layouts: [] } })),
    },
  };
});

vi.mock('react-konva', async () => {
  const React = await import('react');

  type MockNodeProps = Record<string, unknown> & { children?: React.ReactNode };

  const MockNode = React.forwardRef<HTMLDivElement, MockNodeProps>(({ children, ...props }, ref) => {
    const {
      cornerRadius,
      listening,
      scaleX,
      scaleY,
      onTap,
      onDragMove,
      onDblTap,
      onDblClick,
      ...domProps
    } = props;
    void cornerRadius;
    void listening;
    void scaleX;
    void scaleY;
    void onTap;
    void onDragMove;
    void onDblTap;
    void onDblClick;
    return <div ref={ref} {...domProps}>{children}</div>;
  });

  const MockStage = React.forwardRef<object, MockNodeProps>(({ children, onDragStart, onDragMove, onDragEnd, x, y, scaleX, scaleY, ...props }, ref) => {
    const positionStateRef = React.useRef({ x: Number(x ?? 0), y: Number(y ?? 0) });

    React.useEffect(() => {
      positionStateRef.current = { x: Number(x ?? 0), y: Number(y ?? 0) };
    }, [x, y]);

    React.useEffect(() => {
      mockStageApi.handlers.onDragStart = onDragStart as typeof mockStageApi.handlers.onDragStart;
      mockStageApi.handlers.onDragMove = onDragMove as typeof mockStageApi.handlers.onDragMove;
      mockStageApi.handlers.onDragEnd = onDragEnd as typeof mockStageApi.handlers.onDragEnd;
    }, [onDragEnd, onDragMove, onDragStart]);

    React.useImperativeHandle(ref, () => ({
      getPointerPosition: () => mockStageApi.pointer,
    }));

    const createKonvaEvent = (nativeEvent: Event) => ({
      evt: nativeEvent,
      target: {
        position: ({ x: nextX, y: nextY }: { x: number; y: number }) => {
          positionStateRef.current = { x: nextX, y: nextY };
        },
        x: () => positionStateRef.current.x,
        y: () => positionStateRef.current.y,
      },
    });

    return (
      <div
        data-testid="konva-stage"
        data-x={String(x ?? 0)}
        data-y={String(y ?? 0)}
        data-scale-x={String(scaleX ?? 1)}
        data-scale-y={String(scaleY ?? 1)}
        draggable={Boolean(props.draggable)}
        onDragStart={(event) => {
          onDragStart?.(createKonvaEvent(event.nativeEvent as Event));
        }}
        onDrag={(event) => {
          onDragMove?.(createKonvaEvent(event.nativeEvent as Event));
        }}
        onDragEnd={(event) => {
          onDragEnd?.(createKonvaEvent(event.nativeEvent as Event));
        }}
        onTouchMove={(event) => {
          props.onTouchMove?.({
            evt: event.nativeEvent,
            target: {
              position: ({ x: nextX, y: nextY }: { x: number; y: number }) => {
                positionStateRef.current = { x: nextX, y: nextY };
              },
              x: () => positionStateRef.current.x,
              y: () => positionStateRef.current.y,
            },
          });
        }}
        onTouchEnd={() => {
          props.onTouchEnd?.();
        }}
      >
        {children}
      </div>
    );
  });

  return {
    Stage: MockStage,
    Layer: MockNode,
    Group: MockNode,
    Rect: MockNode,
    Text: ({ text, listening, scaleX, scaleY, ...props }: Record<string, unknown> & { text?: string }) => {
      void listening;
      void scaleX;
      void scaleY;
      return <div {...props}>{text}</div>;
    },
  };
});

describe('GraphicalFields', () => {
  beforeEach(() => {
    mockStageApi.setPointer(0, 0);
    mockStageApi.handlers = {};
    mockUseHierarchyData.mockReturnValue({
      loading: false,
      error: null,
      locations: [{ id: 1, name: 'Hof Nord' }],
      fields: [{ id: 10, name: 'Schlag A', location: 1, area_sqm: 1200, width_m: 20, length_m: 40 }],
      beds: [{ id: 100, name: 'Beet 1', field: 10, area_sqm: 80, width_m: 4, length_m: 10 }],
    });
  });

  it('renders the edit mode switch and allows toggling it by click', async () => {
    render(<GraphicalFields />);

    expect(await screen.findByText('Navigieren, hinein- und herauszoomen und Details öffnen.')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();

    act(() => {
      fireEvent.click(screen.getByRole('switch'));
    });

    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.')).toBeInTheDocument();
  }, 15000);

  it('renders fit-to-view and zoom controls', async () => {
    render(<GraphicalFields />);
    expect(await screen.findByText('Navigieren, hinein- und herauszoomen und Details öffnen.')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Standort: Hof Nord' }));
    });

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alles einpassen' })).toBeInTheDocument();
  }, 15000);

  it('keeps panning stable over multiple drag moves and preserves the viewport on rerender', () => {
    const { rerender } = render(<GraphicalFields />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Standort: Hof Nord' }));
    });

    const stage = screen.getByTestId('konva-stage');
    const startX = Number(stage.getAttribute('data-x'));
    const startY = Number(stage.getAttribute('data-y'));

    act(() => {
      mockStageApi.setPointer(100, 120);
      mockStageApi.handlers.onDragStart?.({ evt: new Event('dragstart'), target: { position: () => undefined, x: () => startX, y: () => startY } });
      mockStageApi.setPointer(140, 170);
      mockStageApi.handlers.onDragMove?.({ evt: new Event('drag'), target: { position: () => undefined, x: () => startX, y: () => startY } });
      mockStageApi.setPointer(165, 195);
      mockStageApi.handlers.onDragMove?.({ evt: new Event('drag'), target: { position: () => undefined, x: () => startX, y: () => startY } });
      mockStageApi.handlers.onDragEnd?.({ evt: new Event('dragend'), target: { position: () => undefined, x: () => startX, y: () => startY } });
    });

    const movedStage = screen.getByTestId('konva-stage');
    expect(Number(movedStage.getAttribute('data-x'))).toBe(startX + 65);
    expect(Number(movedStage.getAttribute('data-y'))).toBe(startY + 75);

    rerender(<GraphicalFields />);

    const rerenderedStage = screen.getByTestId('konva-stage');
    expect(Number(rerenderedStage.getAttribute('data-x'))).toBe(startX + 65);
    expect(Number(rerenderedStage.getAttribute('data-y'))).toBe(startY + 75);
  }, 15000);

  it('changes fit-to-view only on explicit trigger and keeps the viewport when switching modes', () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Standort: Hof Nord' }));
    });

    const stage = screen.getByTestId('konva-stage');
    const initialX = Number(stage.getAttribute('data-x'));
    const initialY = Number(stage.getAttribute('data-y'));

    act(() => {
      mockStageApi.setPointer(40, 50);
      mockStageApi.handlers.onDragStart?.({ evt: new Event('dragstart'), target: { position: () => undefined, x: () => initialX, y: () => initialY } });
      mockStageApi.setPointer(85, 105);
      mockStageApi.handlers.onDragMove?.({ evt: new Event('drag'), target: { position: () => undefined, x: () => initialX, y: () => initialY } });
      mockStageApi.handlers.onDragEnd?.({ evt: new Event('dragend'), target: { position: () => undefined, x: () => initialX, y: () => initialY } });
    });

    const movedStage = screen.getByTestId('konva-stage');
    expect(Number(movedStage.getAttribute('data-x'))).toBe(initialX + 45);
    expect(Number(movedStage.getAttribute('data-y'))).toBe(initialY + 55);

    act(() => {
      fireEvent.click(screen.getByRole('switch'));
      fireEvent.click(screen.getByRole('switch'));
    });

    const modeToggledStage = screen.getByTestId('konva-stage');
    expect(Number(modeToggledStage.getAttribute('data-x'))).toBe(initialX + 45);
    expect(Number(modeToggledStage.getAttribute('data-y'))).toBe(initialY + 55);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Alles einpassen' }));
    });

    const resetStage = screen.getByTestId('konva-stage');
    expect(Number(resetStage.getAttribute('data-x'))).not.toBe(initialX + 45);
    expect(Number(resetStage.getAttribute('data-y'))).not.toBe(initialY + 55);
  }, 15000);

  it('toggles edit mode via Alt+E but ignores the shortcut while typing in an input', async () => {
    render(<GraphicalFields />);
    await screen.findByText('Navigieren, hinein- und herauszoomen und Details öffnen.');
    expect(screen.getByRole('switch')).not.toBeChecked();

    act(() => {
      fireEvent.keyDown(window, { key: 'e', altKey: true });
    });

    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.')).toBeInTheDocument();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireEvent.keyDown(window, { key: 'e', altKey: true });
    });

    expect(screen.getByRole('switch')).toBeChecked();

    input.blur();
    document.body.removeChild(input);
  }, 15000);
});
