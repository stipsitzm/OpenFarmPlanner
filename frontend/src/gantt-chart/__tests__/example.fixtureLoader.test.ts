import largeFixture from "../example/fixtures/large.json";
import openFarmPlannerFixture from "../example/fixtures/openfarmplanner.json";
import smallFixture from "../example/fixtures/small.json";
import {
  createDemoScenario,
  updateLinkedPeriodTask,
  updateScenarioTask,
} from "../example/src/demo/fixtureLoader";
import type { GanttFixture } from "../example/src/demo/types";

describe("example fixture loader", () => {
  const baseDate = new Date("2026-07-01T10:00:00.000Z");

  it("normalizes fixture dates into Date objects", () => {
    const scenario = createDemoScenario(smallFixture as GanttFixture, baseDate);

    expect(scenario.startDate).toBeInstanceOf(Date);
    expect(scenario.endDate).toBeInstanceOf(Date);
    expect(scenario.tasks[0].tasks[0].startDate).toBeInstanceOf(Date);
    expect(scenario.tasks[0].tasks[0].startDate.toISOString()).toBe(
      "2026-06-06T10:00:00.000Z",
    );
  });

  it("expands the large fixture into more than 100 rows", () => {
    const scenario = createDemoScenario(largeFixture as GanttFixture, baseDate);

    expect(scenario.tasks).toHaveLength(128);
    expect(scenario.tasks[0].tasks).toHaveLength(2);
  });

  it("updates a dragged or resized task without changing other rows", () => {
    const scenario = createDemoScenario(smallFixture as GanttFixture, baseDate);
    const updatedTask = {
      ...scenario.tasks[0].tasks[0],
      name: "Updated task",
    };

    const updatedGroups = updateScenarioTask(
      scenario.tasks,
      scenario.tasks[0].id,
      updatedTask,
    );

    expect(updatedGroups[0].tasks[0].name).toBe("Updated task");
    expect(updatedGroups[1]).toBe(scenario.tasks[1]);
  });

  it("moves linked OpenFarmPlanner growth and harvest periods together", () => {
    const scenario = createDemoScenario(
      openFarmPlannerFixture as GanttFixture,
      baseDate,
    );
    const group = scenario.tasks[1];
    const growthTask = group.tasks.find(
      (task) => task.id === "ofp-bohne-2-growth",
    )!;
    const harvestTask = group.tasks.find(
      (task) => task.id === "ofp-bohne-2-harvest",
    )!;
    const dayMs = 24 * 60 * 60 * 1000;

    const updatedGroups = updateLinkedPeriodTask(scenario.tasks, group.id, {
      ...growthTask,
      startDate: new Date(growthTask.startDate.getTime() + 7 * dayMs),
      endDate: new Date(growthTask.endDate.getTime() + 7 * dayMs),
    });

    const updatedGroup = updatedGroups.find(({ id }) => id === group.id)!;
    const updatedHarvest = updatedGroup.tasks.find(
      (task) => task.id === harvestTask.id,
    )!;

    expect(updatedHarvest.startDate.toISOString()).toBe(
      new Date(harvestTask.startDate.getTime() + 7 * dayMs).toISOString(),
    );
    expect(updatedHarvest.endDate.toISOString()).toBe(
      new Date(harvestTask.endDate.getTime() + 7 * dayMs).toISOString(),
    );
  });

  it("keeps linked OpenFarmPlanner growth and harvest boundaries together when resized", () => {
    const scenario = createDemoScenario(
      openFarmPlannerFixture as GanttFixture,
      baseDate,
    );
    const group = scenario.tasks[1];
    const growthTask = group.tasks.find(
      (task) => task.id === "ofp-bohne-2-growth",
    )!;
    const resizedGrowthEnd = new Date("2026-03-01T00:00:00.000Z");

    const updatedGroups = updateLinkedPeriodTask(scenario.tasks, group.id, {
      ...growthTask,
      endDate: resizedGrowthEnd,
    });

    const updatedGroup = updatedGroups.find(({ id }) => id === group.id)!;
    const updatedHarvest = updatedGroup.tasks.find(
      (task) => task.id === "ofp-bohne-2-harvest",
    )!;

    expect(updatedHarvest.startDate.toISOString()).toBe(
      resizedGrowthEnd.toISOString(),
    );
  });

  it("configures OpenFarmPlanner periods as movable with fixed duration", () => {
    const scenario = createDemoScenario(
      openFarmPlannerFixture as GanttFixture,
      baseDate,
    );

    expect(scenario.fixture.chart?.allowTaskMove).toBe(true);
    expect(scenario.fixture.chart?.allowTaskResize).toBe(false);
  });

  it("preserves both linked OpenFarmPlanner durations when drag updates include a changed end date", () => {
    const scenario = createDemoScenario(
      openFarmPlannerFixture as GanttFixture,
      baseDate,
    );
    const group = scenario.tasks[1];
    const growthTask = group.tasks.find(
      (task) => task.id === "ofp-bohne-2-growth",
    )!;
    const harvestTask = group.tasks.find(
      (task) => task.id === "ofp-bohne-2-harvest",
    )!;
    const dayMs = 24 * 60 * 60 * 1000;
    const growthDuration =
      growthTask.endDate.getTime() - growthTask.startDate.getTime();
    const harvestDuration =
      harvestTask.endDate.getTime() - harvestTask.startDate.getTime();

    const updatedGroups = updateLinkedPeriodTask(
      scenario.tasks,
      group.id,
      {
        ...growthTask,
        startDate: new Date(growthTask.startDate.getTime() + 14 * dayMs),
        endDate: new Date(growthTask.endDate.getTime() + 21 * dayMs),
      },
      { preserveDurations: true },
    );

    const updatedGroup = updatedGroups.find(({ id }) => id === group.id)!;
    const updatedGrowth = updatedGroup.tasks.find(
      (task) => task.id === growthTask.id,
    )!;
    const updatedHarvest = updatedGroup.tasks.find(
      (task) => task.id === harvestTask.id,
    )!;

    expect(
      updatedGrowth.endDate.getTime() - updatedGrowth.startDate.getTime(),
    ).toBe(growthDuration);
    expect(
      updatedHarvest.endDate.getTime() - updatedHarvest.startDate.getTime(),
    ).toBe(harvestDuration);
    expect(updatedHarvest.startDate.toISOString()).toBe(
      new Date(harvestTask.startDate.getTime() + 14 * dayMs).toISOString(),
    );
  });
});
