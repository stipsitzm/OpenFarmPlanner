import * as React from "react";
import GanttChart, { Task, TaskGroup, ViewMode } from "react-modern-gantt";
import {
  createDemoScenario,
  updateLinkedPeriodTask,
  updateScenarioTask,
} from "./fixtureLoader";
import { fixtures } from "./fixtures";
import type { DemoScenario } from "./types";

const scenarioMap = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

const countTasks = (groups: TaskGroup[]): number =>
  groups.reduce((total, group) => total + group.tasks.length, 0);

const DevelopmentDemo: React.FC = () => {
  const [darkMode, setDarkMode] = React.useState(false);
  const [activeFixtureId, setActiveFixtureId] = React.useState(fixtures[0].id);
  const [scenario, setScenario] = React.useState<DemoScenario>(() =>
    createDemoScenario(fixtures[0]),
  );
  const [activeViewMode, setActiveViewMode] = React.useState<ViewMode>(
    fixtures[0].viewMode,
  );
  const [infiniteScroll, setInfiniteScroll] = React.useState(false);

  const activeFixture = scenarioMap.get(activeFixtureId) ?? fixtures[0];

  React.useEffect(() => {
    const nextScenario = createDemoScenario(activeFixture);
    setScenario(nextScenario);
    setActiveViewMode(activeFixture.viewMode);
  }, [activeFixture]);

  React.useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    document.body.style.backgroundColor = darkMode ? "#111827" : "";
    document.body.style.color = darkMode ? "#f9fafb" : "";
  }, [darkMode]);

  const resetScenario = () => {
    setScenario(createDemoScenario(activeFixture));
    setActiveViewMode(activeFixture.viewMode);
  };

  const isOpenFarmPlanner = activeFixture.id === "openfarmplanner";

  const handleTaskUpdate = (groupId: string, updatedTask: Task) => {
    setScenario((currentScenario) => ({
      ...currentScenario,
      tasks: isOpenFarmPlanner
        ? updateLinkedPeriodTask(currentScenario.tasks, groupId, updatedTask, {
            preserveDurations: true,
          })
        : updateScenarioTask(currentScenario.tasks, groupId, updatedTask),
    }));
  };

  const handleTimelineExtend = (
    _direction: "left" | "right",
    newStartDate: Date,
    newEndDate: Date,
  ) => {
    setScenario((currentScenario) => ({
      ...currentScenario,
      startDate: newStartDate,
      endDate: newEndDate,
    }));
  };

  const chartProps = activeFixture.chart ?? {};
  const rowCount = scenario.tasks.length;
  const taskCount = countTasks(scenario.tasks);

  return (
    <div
      className={`dev-demo ${darkMode ? "dev-demo--dark" : ""} ${
        isOpenFarmPlanner ? "dev-demo--ofp" : ""
      }`}
    >
      <aside className="dev-demo__sidebar">
        <div className="dev-demo__brand">
          <span className="dev-demo__eyebrow">React Modern Gantt</span>
          <h1>Development demo</h1>
        </div>

        <div className="dev-demo__scenario-list" aria-label="Demo scenarios">
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              className={`dev-demo__scenario ${
                fixture.id === activeFixtureId ? "is-active" : ""
              }`}
              type="button"
              onClick={() => setActiveFixtureId(fixture.id)}
            >
              <span>{fixture.name}</span>
              <small>{fixture.description}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="dev-demo__main">
        {isOpenFarmPlanner && (
          <div className="dev-demo__ofp-topbar">
            <div className="dev-demo__ofp-title">
              <h2>Anbaukalender</h2>
              <span>?</span>
            </div>
            <div className="dev-demo__ofp-tabs" role="tablist">
              <button className="is-active" type="button">
                Feldbelegung
              </button>
              <button type="button">Anzucht</button>
            </div>
            <div className="dev-demo__ofp-farm">Gelawi Zwiebelzopf</div>
          </div>
        )}

        <header className="dev-demo__toolbar">
          <div>
            <h2>{isOpenFarmPlanner ? "Feldplanung" : activeFixture.name}</h2>
            {!isOpenFarmPlanner && <p>{activeFixture.description}</p>}
          </div>

          <div className="dev-demo__actions">
            {isOpenFarmPlanner && (
              <button className="dev-demo__ofp-shift" type="button">
                Zeitraum verschieben
              </button>
            )}
            {!isOpenFarmPlanner && (
              <>
                <label className="dev-demo__toggle">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(event) => setDarkMode(event.target.checked)}
                  />
                  <span>Dark</span>
                </label>
                <label className="dev-demo__toggle">
                  <input
                    type="checkbox"
                    checked={infiniteScroll}
                    onChange={(event) =>
                      setInfiniteScroll(event.target.checked)
                    }
                  />
                  <span>Infinite</span>
                </label>
              </>
            )}
            <button type="button" onClick={resetScenario}>
              Reset
            </button>
          </div>
        </header>

        {!isOpenFarmPlanner && (
          <section
            className="dev-demo__controls"
            aria-label="Scenario controls"
          >
            <div className="dev-demo__metric">
              <span>Rows</span>
              <strong>{rowCount}</strong>
            </div>
            <div className="dev-demo__metric">
              <span>Tasks</span>
              <strong>{taskCount}</strong>
            </div>
            <div className="dev-demo__view-modes" aria-label="Zoom levels">
              {activeFixture.viewModes.map((mode) => (
                <button
                  key={mode}
                  className={mode === activeViewMode ? "is-active" : ""}
                  type="button"
                  onClick={() => setActiveViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="dev-demo__chart" aria-label="Gantt scenario">
          <GanttChart
            key={activeFixture.id}
            tasks={scenario.tasks}
            startDate={scenario.startDate}
            endDate={scenario.endDate}
            title={chartProps.title}
            headerLabel={chartProps.headerLabel}
            showProgress={chartProps.showProgress}
            showCurrentDateMarker={chartProps.showCurrentDateMarker}
            editMode={chartProps.editMode}
            allowTaskMove={chartProps.allowTaskMove}
            allowTaskResize={chartProps.allowTaskResize}
            allowProgressEdit={chartProps.allowProgressEdit}
            rowHeight={chartProps.rowHeight}
            leftColumnWidth={chartProps.leftColumnWidth}
            maxHeight={chartProps.maxHeight}
            minuteStep={chartProps.minuteStep}
            darkMode={darkMode}
            todayLabel={isOpenFarmPlanner ? "Heute" : undefined}
            viewMode={activeViewMode}
            viewModes={activeFixture.viewModes}
            infiniteScroll={infiniteScroll}
            onTimelineExtend={handleTimelineExtend}
            onTaskUpdate={handleTaskUpdate}
            onViewModeChange={setActiveViewMode}
          />
        </section>
      </main>
    </div>
  );
};

export default DevelopmentDemo;
