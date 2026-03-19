import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraphicalFields from '../pages/GraphicalFields';

const mockUseHierarchyData = vi.fn();

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
  const MockNode = React.forwardRef<HTMLDivElement, Record<string, unknown> & { children?: React.ReactNode }>(({ children, ...props }, ref) => {
    const { cornerRadius, listening, scaleX, scaleY, onTap, onDragMove, onDblTap, onDblClick, ...domProps } = props;
    void cornerRadius; void listening; void scaleX; void scaleY; void onTap; void onDragMove; void onDblTap; void onDblClick;
    return <div ref={ref} {...domProps}>{children}</div>;
  });
  return {
    Stage: MockNode,
    Layer: MockNode,
    Group: MockNode,
    Rect: MockNode,
    Text: ({ text, ...props }: Record<string, unknown> & { text?: string }) => <div {...props}>{text}</div>,
  };
});

describe('GraphicalFields', () => {
  beforeEach(() => {
    mockUseHierarchyData.mockReturnValue({
      loading: false,
      error: null,
      locations: [{ id: 1, name: 'Hof Nord' }],
      fields: [{ id: 10, name: 'Schlag A', location: 1, area_sqm: 1200, width_m: 20, length_m: 40 }],
      beds: [{ id: 100, name: 'Beet 1', field: 10, area_sqm: 80, width_m: 4, length_m: 10 }],
    });
  });

  it('starts in view mode and allows switching to edit mode', () => {
    render(<GraphicalFields />);

    expect(screen.getByText('Ansichtsmodus')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editiermodus' }));

    expect(screen.getByText('Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.')).toBeInTheDocument();
  });

  it('renders fit-to-view and zoom controls', () => {
    render(<GraphicalFields />);
    fireEvent.click(screen.getByRole('button', { name: 'Standort: Hof Nord' }));

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alles einpassen' })).toBeInTheDocument();
  });
});
