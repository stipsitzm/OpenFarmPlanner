import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DemoHierarchy from "../example/src/DemoHierarchy";

jest.mock(
  "react-modern-gantt",
  () => {
    const React = require("react");

    const MockGantt = (props: {
      tasks: Array<{ hierarchyPath?: string[] }>;
    }) => {
      const firstPath = props.tasks[0]?.hierarchyPath?.join(" > ") ?? "";
      return <div data-testid="mock-hierarchy-path">{firstPath}</div>;
    };

    return {
      __esModule: true,
      default: MockGantt,
    };
  },
  { virtual: true },
);

describe("Demo hierarchy English copy and mode switching", () => {
  test("renders English labels and switches hierarchy input mode", () => {
    render(<DemoHierarchy darkMode={false} />);

    expect(
      screen.getByRole("button", { name: "Location → Field → Bed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Field → Bed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Demo" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("mock-hierarchy-path")).toHaveTextContent(
      "Location Green Farm > Field North > Bed A1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Field → Bed" }));

    expect(screen.getByTestId("mock-hierarchy-path")).toHaveTextContent(
      "Field North > Bed A1",
    );
  });
});
