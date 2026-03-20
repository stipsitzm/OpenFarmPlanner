import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GraphicalFields from "../pages/GraphicalFields";

const mockUseHierarchyData = vi.fn();
const { listByLocationMock, saveByLocationMock } = vi.hoisted(() => ({
  listByLocationMock: vi.fn(async () => ({
    data: { bed_layouts: [], field_layouts: [] },
  })),
  saveByLocationMock: vi.fn(async () => ({
    data: { bed_layouts: [], field_layouts: [] },
  })),
}));
const mockStageApi = {
  pointer: { x: 0, y: 0 },
  handlers: {} as {
    onDragStart?: (event: {
      evt: Event;
      target: {
        position: ({ x, y }: { x: number; y: number }) => void;
        x: () => number;
        y: () => number;
      };
    }) => void;
    onDragMove?: (event: {
      evt: Event;
      target: {
        position: ({ x, y }: { x: number; y: number }) => void;
        x: () => number;
        y: () => number;
      };
    }) => void;
    onDragEnd?: (event: {
      evt: Event;
      target: {
        position: ({ x, y }: { x: number; y: number }) => void;
        x: () => number;
        y: () => number;
      };
    }) => void;
  },
  setPointer(x: number, y: number) {
    this.pointer = { x, y };
  },
};

const mockKonvaNodes: Record<
  string,
  {
    getPosition: () => { x: number; y: number };
    setPosition: (position: { x: number; y: number }) => void;
    handlers: {
      onDragMove?: (event: {
        evt: Event;
        target: {
          position: ({ x, y }: { x: number; y: number }) => void;
          x: () => number;
          y: () => number;
        };
      }) => void;
      onDragEnd?: (event: {
        evt: Event;
        target: {
          position: ({ x, y }: { x: number; y: number }) => void;
          x: () => number;
          y: () => number;
        };
      }) => void;
    };
  }
> = {};

const createKonvaTarget = (positionRef: {
  current: { x: number; y: number };
}) => ({
  position: ({ x, y }: { x: number; y: number }) => {
    positionRef.current = { x, y };
  },
  x: () => positionRef.current.x,
  y: () => positionRef.current.y,
});

vi.mock("../components/hierarchy/hooks/useHierarchyData", () => ({
  useHierarchyData: () => mockUseHierarchyData(),
}));

vi.mock("../api/api", async () => {
  const actual =
    await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    layoutAPI: {
      ...actual.layoutAPI,
      listByLocation: listByLocationMock,
      saveByLocation: saveByLocationMock,
    },
  };
});

vi.mock("react-konva", async () => {
  const React = await import("react");

  type MockNodeProps = Record<string, unknown> & { children?: React.ReactNode };

  const MockNode = React.forwardRef<HTMLDivElement, MockNodeProps>(
    ({ children, ...props }, ref) => {
      const {
        cornerRadius,
        listening,
        scaleX,
        scaleY,
        onTap,
        onDragMove,
        onDragEnd,
        onDblTap,
        onDblClick,
        _useStrictMode,
        x,
        y,
        ...domProps
      } = props;
      void cornerRadius;
      void listening;
      void scaleX;
      void scaleY;
      void onTap;
      void onDblTap;
      void onDblClick;
      void _useStrictMode;

      const testId =
        typeof props["data-testid"] === "string" ? props["data-testid"] : null;
      const positionRef = React.useRef({
        x: Number(x ?? 0),
        y: Number(y ?? 0),
      });

      React.useEffect(() => {
        positionRef.current = { x: Number(x ?? 0), y: Number(y ?? 0) };
      }, [x, y]);

      React.useEffect(() => {
        if (!testId) return;
        mockKonvaNodes[testId] = {
          getPosition: () => positionRef.current,
          setPosition: (position) => {
            positionRef.current = position;
          },
          handlers: {
            onDragMove:
              onDragMove as (typeof mockKonvaNodes)[string]["handlers"]["onDragMove"],
            onDragEnd:
              onDragEnd as (typeof mockKonvaNodes)[string]["handlers"]["onDragEnd"],
          },
        };
        return () => {
          delete mockKonvaNodes[testId];
        };
      }, [testId, onDragMove, onDragEnd]);

      return (
        <div
          ref={ref}
          data-x={String(x ?? 0)}
          data-y={String(y ?? 0)}
          {...domProps}
        >
          {children}
        </div>
      );
    },
  );

  const MockStage = React.forwardRef<object, MockNodeProps>(
    (
      {
        children,
        onDragStart,
        onDragMove,
        onDragEnd,
        x,
        y,
        scaleX,
        scaleY,
        ...props
      },
      ref,
    ) => {
      const positionStateRef = React.useRef({
        x: Number(x ?? 0),
        y: Number(y ?? 0),
      });

      React.useEffect(() => {
        positionStateRef.current = { x: Number(x ?? 0), y: Number(y ?? 0) };
      }, [x, y]);

      React.useEffect(() => {
        mockStageApi.handlers.onDragStart =
          onDragStart as typeof mockStageApi.handlers.onDragStart;
        mockStageApi.handlers.onDragMove =
          onDragMove as typeof mockStageApi.handlers.onDragMove;
        mockStageApi.handlers.onDragEnd =
          onDragEnd as typeof mockStageApi.handlers.onDragEnd;
      }, [onDragEnd, onDragMove, onDragStart]);

      React.useImperativeHandle(ref, () => ({
        getPointerPosition: () => mockStageApi.pointer,
        stopDrag: () => undefined,
        find: () => [],
        batchDraw: () => undefined,
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
                position: ({
                  x: nextX,
                  y: nextY,
                }: {
                  x: number;
                  y: number;
                }) => {
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
    },
  );

  return {
    Stage: MockStage,
    Layer: MockNode,
    Group: MockNode,
    Rect: MockNode,
    Text: ({
      text,
      listening,
      scaleX,
      scaleY,
      ...props
    }: Record<string, unknown> & { text?: string }) => {
      void listening;
      void scaleX;
      void scaleY;
      return <div {...props}>{text}</div>;
    },
  };
});

describe("GraphicalFields", () => {
  beforeEach(() => {
    mockStageApi.setPointer(0, 0);
    mockStageApi.handlers = {};
    listByLocationMock.mockClear();
    saveByLocationMock.mockClear();
    Object.keys(mockKonvaNodes).forEach((key) => delete mockKonvaNodes[key]);
    mockUseHierarchyData.mockReturnValue({
      loading: false,
      error: null,
      locations: [{ id: 1, name: "Hof Nord" }],
      fields: [
        {
          id: 10,
          name: "Schlag A",
          location: 1,
          area_sqm: 1200,
          width_m: 20,
          length_m: 40,
        },
      ],
      beds: [
        {
          id: 100,
          name: "Beet 1",
          field: 10,
          area_sqm: 80,
          width_m: 4,
          length_m: 10,
        },
      ],
    });
  });

  it("renders the edit mode switch and allows toggling it by click", async () => {
    render(<GraphicalFields />);

    expect(
      await screen.findByText(
        /Navigieren, hinein- und herauszoomen und Details öffnen\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(screen.getByRole("switch")).toBeChecked();
    expect(
      screen.getByText(
        "Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.",
      ),
    ).toBeInTheDocument();
  }, 15000);

  it("renders fit-to-view and zoom controls", async () => {
    render(<GraphicalFields />);
    expect(
      await screen.findByText(
        /Navigieren, hinein- und herauszoomen und Details öffnen\./,
      ),
    ).toBeInTheDocument();
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alles einpassen" }),
    ).toBeInTheDocument();
  }, 15000);

  it("keeps UI hint and interaction state consistent with the edit mode switch", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(await screen.findByTestId("field-rect-10")).toHaveAttribute(
      "draggable",
      "false",
    );
    expect(
      screen.getByText(
        /Navigieren, hinein- und herauszoomen und Details öffnen\./,
      ),
    ).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByTestId("field-rect-10")).toHaveAttribute(
        "draggable",
        "true",
      );
    });
    expect(
      screen.getByText(
        "Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.",
      ),
    ).toBeInTheDocument();
  }, 15000);

  it("renders compact overlay zoom controls inside the graphic container", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    expect(screen.queryByText("Zoom in")).not.toBeInTheDocument();
    expect(screen.queryByText("Zoom out")).not.toBeInTheDocument();
    expect(screen.queryByText("Alles einpassen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alles einpassen" }),
    ).toBeInTheDocument();
  }, 15000);

  it("keeps panning stable over multiple drag moves and preserves the viewport on rerender", () => {
    const { rerender } = render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    const stage = screen.getByTestId("konva-stage");
    const startX = Number(stage.getAttribute("data-x"));
    const startY = Number(stage.getAttribute("data-y"));

    act(() => {
      mockStageApi.setPointer(100, 120);
      mockStageApi.handlers.onDragStart?.({
        evt: new Event("dragstart"),
        target: { position: () => undefined, x: () => startX, y: () => startY },
      });
      mockStageApi.setPointer(140, 170);
      mockStageApi.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: { position: () => undefined, x: () => startX, y: () => startY },
      });
      mockStageApi.setPointer(165, 195);
      mockStageApi.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: { position: () => undefined, x: () => startX, y: () => startY },
      });
      mockStageApi.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: { position: () => undefined, x: () => startX, y: () => startY },
      });
    });

    const movedStage = screen.getByTestId("konva-stage");
    expect(Number(movedStage.getAttribute("data-x"))).toBe(startX + 65);
    expect(Number(movedStage.getAttribute("data-y"))).toBe(startY + 75);

    rerender(<GraphicalFields />);

    const rerenderedStage = screen.getByTestId("konva-stage");
    expect(Number(rerenderedStage.getAttribute("data-x"))).toBe(startX + 65);
    expect(Number(rerenderedStage.getAttribute("data-y"))).toBe(startY + 75);
  }, 15000);

  it("changes fit-to-view only on explicit trigger and keeps the viewport when switching modes", () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    const stage = screen.getByTestId("konva-stage");
    const initialX = Number(stage.getAttribute("data-x"));
    const initialY = Number(stage.getAttribute("data-y"));

    act(() => {
      mockStageApi.setPointer(40, 50);
      mockStageApi.handlers.onDragStart?.({
        evt: new Event("dragstart"),
        target: {
          position: () => undefined,
          x: () => initialX,
          y: () => initialY,
        },
      });
      mockStageApi.setPointer(85, 105);
      mockStageApi.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: {
          position: () => undefined,
          x: () => initialX,
          y: () => initialY,
        },
      });
      mockStageApi.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: {
          position: () => undefined,
          x: () => initialX,
          y: () => initialY,
        },
      });
    });

    const movedStage = screen.getByTestId("konva-stage");
    expect(Number(movedStage.getAttribute("data-x"))).toBe(initialX + 45);
    expect(Number(movedStage.getAttribute("data-y"))).toBe(initialY + 55);

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
      fireEvent.click(screen.getByRole("switch"));
    });

    const modeToggledStage = screen.getByTestId("konva-stage");
    expect(Number(modeToggledStage.getAttribute("data-x"))).toBe(initialX + 45);
    expect(Number(modeToggledStage.getAttribute("data-y"))).toBe(initialY + 55);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Alles einpassen" }));
    });

    const resetStage = screen.getByTestId("konva-stage");
    expect(Number(resetStage.getAttribute("data-x"))).not.toBe(initialX + 45);
    expect(Number(resetStage.getAttribute("data-y"))).not.toBe(initialY + 55);
  }, 15000);

  it("prevents object dragging in view mode and keeps the object position unchanged", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    const fieldRect = await screen.findByTestId("field-rect-10");
    expect(fieldRect).toHaveAttribute("draggable", "false");

    const node = mockKonvaNodes["field-rect-10"];
    const startPosition = node.getPosition();
    node.setPosition({ x: startPosition.x + 50, y: startPosition.y + 30 });

    act(() => {
      node.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: createKonvaTarget({ current: node.getPosition() }),
      });
      node.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: createKonvaTarget({ current: node.getPosition() }),
      });
    });

    expect(node.getPosition()).toEqual({
      x: startPosition.x + 50,
      y: startPosition.y + 30,
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-rect-10")).toHaveAttribute(
        "data-x",
        String(startPosition.x),
      );
      expect(screen.getByTestId("field-rect-10")).toHaveAttribute(
        "data-y",
        String(startPosition.y),
      );
    });
  }, 15000);

  it("allows object dragging in edit mode and persists the updated position", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
      fireEvent.click(screen.getByRole("switch"));
    });

    const fieldRect = await screen.findByTestId("field-rect-10");
    expect(fieldRect).toHaveAttribute("draggable", "true");

    const node = mockKonvaNodes["field-rect-10"];
    const startPosition = node.getPosition();
    const dragTargetRef = {
      current: { x: startPosition.x + 40, y: startPosition.y + 25 },
    };

    act(() => {
      node.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: createKonvaTarget(dragTargetRef),
      });
      node.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: createKonvaTarget(dragTargetRef),
      });
    });

    await waitFor(() => {
      const moved = screen.getByTestId("field-rect-10");
      expect(Number(moved.getAttribute("data-x"))).not.toBe(startPosition.x);
      expect(Number(moved.getAttribute("data-y"))).not.toBe(startPosition.y);
    });
  }, 15000);

  it("persists layout changes only in edit mode", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
    });

    const viewNode = mockKonvaNodes["field-rect-10"];
    act(() => {
      viewNode.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: createKonvaTarget({
          current: {
            x: viewNode.getPosition().x + 25,
            y: viewNode.getPosition().y + 15,
          },
        }),
      });
    });

    await waitFor(() => {
      expect(saveByLocationMock).not.toHaveBeenCalled();
    });

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    const editNode = mockKonvaNodes["field-rect-10"];
    act(() => {
      editNode.handlers.onDragEnd?.({
        evt: new Event("dragend"),
        target: createKonvaTarget({
          current: {
            x: editNode.getPosition().x + 25,
            y: editNode.getPosition().y + 15,
          },
        }),
      });
    });

    await waitFor(() => {
      expect(saveByLocationMock).toHaveBeenCalledTimes(1);
    });
  }, 15000);

  it("stops active edit interactions cleanly when switching back to view mode", async () => {
    render(<GraphicalFields />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Standort: Hof Nord" }),
      );
      fireEvent.click(screen.getByRole("switch"));
    });

    const node = mockKonvaNodes["field-rect-10"];
    const startPosition = node.getPosition();
    const dragTargetRef = {
      current: { x: startPosition.x + 35, y: startPosition.y + 20 },
    };

    act(() => {
      node.handlers.onDragMove?.({
        evt: new Event("drag"),
        target: createKonvaTarget(dragTargetRef),
      });
    });

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    await waitFor(() => {
      const resetNode = screen.getByTestId("field-rect-10");
      expect(resetNode).toHaveAttribute("draggable", "false");
      expect(resetNode).toHaveAttribute("data-x", String(startPosition.x));
      expect(resetNode).toHaveAttribute("data-y", String(startPosition.y));
    });
  }, 15000);

  it("toggles edit mode via Alt+E but ignores the shortcut while typing in an input", async () => {
    render(<GraphicalFields />);
    await screen.findByText(
      /Navigieren, hinein- und herauszoomen und Details öffnen\./,
    );
    expect(screen.getByRole("switch")).not.toBeChecked();

    act(() => {
      fireEvent.keyDown(window, { key: "e", altKey: true });
    });

    expect(screen.getByRole("switch")).toBeChecked();
    expect(
      screen.getByText(
        "Editiermodus aktiv – Schläge und Beete können jetzt verschoben werden.",
      ),
    ).toBeInTheDocument();

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireEvent.keyDown(window, { key: "e", altKey: true });
    });

    expect(screen.getByRole("switch")).toBeChecked();

    input.blur();
    document.body.removeChild(input);
  }, 15000);
});
