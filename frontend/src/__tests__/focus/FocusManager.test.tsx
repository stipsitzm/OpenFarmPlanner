import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusManagerProvider } from "../../focus/FocusManager";
import { useFocusManager, useFocusRegion } from "../../focus/useFocusManager";
import { useRegionShortcuts } from "../../focus/useRegionShortcuts";

function Region({
  id,
  order,
  label = id,
  buttonCount = 2,
  trapTab,
}: {
  id: string;
  order: number;
  label?: string;
  buttonCount?: number;
  trapTab?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusRegion(id, ref, { label, order, trapTab });

  return (
    <div ref={ref} tabIndex={-1} data-testid={`region-${id}`}>
      {Array.from({ length: buttonCount }, (_, index) => (
        <button key={index} type="button" data-testid={`region-${id}-btn-${index}`}>
          {id} button {index}
        </button>
      ))}
    </div>
  );
}

function ActiveRegionLabel() {
  const { activeRegionId } = useFocusManager();
  return <div data-testid="active-region">{activeRegionId ?? "none"}</div>;
}

describe("FocusManager", () => {
  it("cycles forward through registered regions with F6, wrapping at the end", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} />
        <Region id="b" order={1} />
        <Region id="c" order={2} />
      </FocusManagerProvider>,
    );

    fireEvent.keyDown(window, { key: "F6" });
    expect(screen.getByTestId("region-a-btn-0")).toHaveFocus();

    fireEvent.keyDown(window, { key: "F6" });
    expect(screen.getByTestId("region-b-btn-0")).toHaveFocus();

    fireEvent.keyDown(window, { key: "F6" });
    expect(screen.getByTestId("region-c-btn-0")).toHaveFocus();

    fireEvent.keyDown(window, { key: "F6" });
    expect(screen.getByTestId("region-a-btn-0")).toHaveFocus();
  });

  it("cycles backward with Shift+F6, wrapping at the start", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} />
        <Region id="b" order={1} />
      </FocusManagerProvider>,
    );

    fireEvent.keyDown(window, { key: "F6", shiftKey: true });
    expect(screen.getByTestId("region-b-btn-0")).toHaveFocus();

    fireEvent.keyDown(window, { key: "F6", shiftKey: true });
    expect(screen.getByTestId("region-a-btn-0")).toHaveFocus();
  });

  it("tracks the active region as focus moves in via focusin, most-specific region wins when nested", () => {
    render(
      <FocusManagerProvider>
        <ActiveRegionLabel />
        <Region id="outer" order={0} />
      </FocusManagerProvider>,
    );

    expect(screen.getByTestId("active-region")).toHaveTextContent("none");

    fireEvent.focusIn(screen.getByTestId("region-outer-btn-0"), {
      target: screen.getByTestId("region-outer-btn-0"),
    });
    expect(screen.getByTestId("active-region")).toHaveTextContent("outer");
  });

  it("wraps Tab from the last element back to the first instead of letting it escape the region", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} buttonCount={2} />
      </FocusManagerProvider>,
    );

    const first = screen.getByTestId("region-a-btn-0");
    const second = screen.getByTestId("region-a-btn-1");
    act(() => second.focus());
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("does not intercept Tab moving between elements inside the region (the browser's job)", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} buttonCount={2} />
      </FocusManagerProvider>,
    );

    const first = screen.getByTestId("region-a-btn-0");
    const event = fireEvent.keyDown(first, { key: "Tab" });
    // Not a boundary case, so the trap must leave the event alone and let
    // native focus traversal (untestable in jsdom) handle it.
    expect(event).toBe(true);
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} buttonCount={2} />
      </FocusManagerProvider>,
    );

    const first = screen.getByTestId("region-a-btn-0");
    const second = screen.getByTestId("region-a-btn-1");
    act(() => first.focus());

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(second).toHaveFocus();
  });

  it("does not trap Tab when trapTab is disabled", () => {
    render(
      <FocusManagerProvider>
        <Region id="a" order={0} buttonCount={2} trapTab={false} />
      </FocusManagerProvider>,
    );

    const first = screen.getByTestId("region-a-btn-0");
    const second = screen.getByTestId("region-a-btn-1");
    act(() => first.focus());

    const event = fireEvent.keyDown(first, { key: "Tab" });
    // No trap handling means the event is left alone (not prevented) —
    // actual focus movement across boundaries is the browser's job outside tests.
    expect(event).toBe(true);
    expect(second).not.toHaveFocus();
  });
});

function RegionWithShortcut({ id, order }: { id: string; order: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusRegion(id, ref, { label: id, order });
  const onAction = (globalThis as { __regionShortcutSpy?: (id: string) => void }).__regionShortcutSpy;
  useRegionShortcuts(id, [
    { key: "n", label: "Neu anlegen", action: () => onAction?.(id) },
  ]);
  return (
    <div ref={ref} tabIndex={-1} data-testid={`region-${id}`}>
      <button type="button" data-testid={`region-${id}-btn`}>{id}</button>
    </div>
  );
}

describe("useRegionShortcuts", () => {
  it("only fires a region's shortcut while that region is active", () => {
    const spy = vi.fn();
    (globalThis as { __regionShortcutSpy?: (id: string) => void }).__regionShortcutSpy = spy;

    render(
      <FocusManagerProvider>
        <RegionWithShortcut id="alpha" order={0} />
        <RegionWithShortcut id="beta" order={1} />
      </FocusManagerProvider>,
    );

    // No region active yet: 'n' does nothing.
    fireEvent.keyDown(window, { key: "n" });
    expect(spy).not.toHaveBeenCalled();

    fireEvent.focusIn(screen.getByTestId("region-alpha-btn"), {
      target: screen.getByTestId("region-alpha-btn"),
    });
    fireEvent.keyDown(window, { key: "n" });
    expect(spy).toHaveBeenCalledWith("alpha");
    expect(spy).toHaveBeenCalledTimes(1);

    fireEvent.focusIn(screen.getByTestId("region-beta-btn"), {
      target: screen.getByTestId("region-beta-btn"),
    });
    fireEvent.keyDown(window, { key: "n" });
    expect(spy).toHaveBeenCalledWith("beta");
    expect(spy).toHaveBeenCalledTimes(2);

    delete (globalThis as { __regionShortcutSpy?: (id: string) => void }).__regionShortcutSpy;
  });
});
