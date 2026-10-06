# UI/UX Implementation Handoff

**Type:** Design implementation specification
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-10-06
**Audience:** Frontend engineering
**License:** Apache-2.0

## Approved direction

The approved master direction is a dark Modern NOC / Operations Console. Production implementation must preserve the approved hierarchy and must not regress into a generic component-library admin panel.

## Locked visual invariants

- persistent left sidebar;
- compact top command/status bar;
- dark navy/slate canvas;
- grouped operational surfaces with subtle borders;
- restrained semantic green/amber/red/slate status colors;
- problem-first health summary in the first viewport;
- compact KPI strip rather than oversized decorative cards;
- high information density with clear section hierarchy;
- active-call and operational tables with compact rows;
- PBX/trunk/endpoint/queue status visible without deep navigation;
- infrastructure status integrated into the same visual language;
- technical identifiers remain visually stable and LTR;
- healthy state is calm; warnings and critical state gain visual priority.

## Geometry

Desktop reference canvas: 1440px.

- Sidebar: 232px target, acceptable range 224–248px.
- Top bar: 60px target, acceptable range 56–64px.
- Main content gutter: 24px.
- Main grid: 12 columns.
- Section gap: 12–16px.
- Panel radius: 10–12px.
- Compact panel padding: 14–16px.
- Large section padding: 16–20px.
- Primary table row: approximately 36–40px.
- First operational viewport should remain useful at approximately 900px display height.

## Surface hierarchy

1. Canvas — darkest background.
2. Surface 1 — primary grouped panels.
3. Surface 2 — nested cards/rows.
4. Overlay — menu, dialog, drawer.
5. Border subtle — structural edges only.

Avoid heavy shadows. Elevation is primarily for overlays, not every card.

## Typography hierarchy

Use a modern UI sans with strong Persian and Latin support.

- Product mark: 18–20px / semibold.
- Page title: 24–28px / semibold.
- Section title: 15–17px / semibold.
- KPI primary: 24–32px / semibold or bold.
- Row/entity primary: 13–14px / medium.
- Body: 13–14px.
- Metadata: 11–12px.
- Technical identifier: 12–13px mono when useful.

Do not use oversized dashboard typography that reduces information density.

## Semantic status system

Status color must be centralized in design tokens.

- healthy / connected / registered / running: green;
- degraded / warning / high load: amber;
- critical / down / unreachable / failed: red;
- informational / selected / active navigation: blue/cyan accent;
- unknown / stale / unsupported: slate/neutral.

Color never substitutes for the text label or icon.

## Application shell

### Sidebar

Primary navigation order:

1. Overview
2. PBX Fleet
3. Live Calls
4. Trunks
5. Endpoints
6. Queues
7. Agents
8. Call History
9. Alerts
10. Infrastructure
11. Security
12. Reports
13. Settings

The existing product may map current workspaces into this hierarchy incrementally. Do not remove existing capabilities simply because the approved mockup groups them differently.

Sidebar footer:
- PBX connection summary or current fleet scope;
- theme control when implemented;
- version/build metadata.

### Top bar

Include:
- global operational search affordance;
- current local/server date-time;
- live/realtime connection state;
- refresh/realtime cadence control if retained;
- alert count;
- theme toggle;
- account menu.

Avoid duplicating page-local actions here.

## Overview composition

### Row 1 — health/KPI strip

- Global/selected-scope health.
- PBX systems.
- Active calls.
- Trunks.
- Endpoints.
- Queues.
- Alerts.

This strip should remain compact and fit on one desktop row.

### Row 2 — primary operational surface

Left/major:
- active-call trend or current-call workload;
- recent active calls.

Right:
- CPU;
- memory;
- primary filesystem;
- supporting load/network/uptime metadata.

### Row 3 — fleet/trunk state

- PBX fleet health cards/rows.
- Trunk status summary with registered/unregistered/unknown and a compact list.

### Row 4 — endpoint/queue/alerts

- endpoint reachability;
- queue pressure/status;
- recent alerts.

## Interaction contract

- Entire summary cards/rows may drill down where obvious.
- "View all" is secondary and visually quiet.
- Hover should clarify clickability without significant movement.
- Realtime updates must not shift layout geometry.
- Drawer/side-panel drill-down is preferred for entity details that do not require a full workspace.
- Configuration remains in Settings; avoid write actions on the default Overview.

## Responsive behavior

### Desktop

Full sidebar and multi-column overview.

### Tablet

Collapsible sidebar, two-column major regions, KPI strip may wrap.

### Mobile

Not a wallboard. Prioritize:
1. current health;
2. active incidents;
3. active calls;
4. key telephony state;
5. infrastructure warnings.

Dense desktop charts may collapse to summary rows.

## RTL/LTR implementation

- Persian application chrome uses RTL.
- Sidebar position may mirror for full Persian mode only if navigation testing shows it improves usability; do not mirror charts/time axes.
- Technical identifiers, extensions, IP-like values, call IDs, durations, timestamps and protocol names remain LTR within their cells.
- Numeric KPIs keep stable digit grouping and alignment.
- Charts preserve chronological left-to-right time progression regardless of UI language.

## Migration sequence for Task 52

1. Add product-specific Chakra theme/tokens while keeping current routing/state logic.
2. Implement shell: canvas, sidebar, top bar, page container.
3. Implement common primitives: status indicator, KPI cell, grouped panel, section header, entity row, table row, filter/search control.
4. Migrate Overview shell without deleting current data hooks.
5. Migrate each workspace incrementally.
6. Remove old visual wrappers only after parity tests pass.

## Acceptance criteria for implementation

- current backend/API contracts unchanged;
- no monitoring capability removed;
- existing tests remain green or are updated only for intended layout semantics;
- new design tokens are centralized;
- no workspace uses ad-hoc status colors outside the semantic system;
- desktop Overview visibly matches the approved master hierarchy;
- Persian/English direction behavior is stable;
- loading/error/stale/empty states share the new design language;
- no generic Chakra default-card appearance remains in the primary shell.
