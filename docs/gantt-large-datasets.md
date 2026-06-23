# Gantt rendering with large projects

## Root cause

The field-planning page kept the complete location, field, bed, planting-plan,
and culture responses in React state. Task-group construction also completed
successfully. Rendering stopped inside `react-modern-gantt`.

The dependency does not virtualize rows. For every render it mounts every task
group and task item, calculates collision lanes repeatedly for the task list,
timeline rows, and current-date marker, and asks the browser to lay out the
entire resulting surface. With large projects this synchronous render and
layout workload can prevent the body from becoming usable even though the
timeline header has already rendered.

The issue was not caused by missing API data, a project-level empty-state
guard, canvas dimensions, or a calculation that intentionally returned no
rows. The chart uses DOM elements rather than a canvas.

## Fix

OpenFarmPlanner now partitions Gantt groups into bounded render windows. Each
window contains at most 120 rows or 800 timeline items. Only the active window
is passed to `react-modern-gantt`, while the complete dataset remains in React
state. Pagination allows access to every window, and the chart body has a
viewport-relative maximum height with its own scroll container.

Development builds log the following counts after task-group construction:

- total beds
- total planting plans
- total and rendered rows
- total and rendered timeline items
- active render window and total render-window count

The diagnostics are development-only and do not add production console noise.
