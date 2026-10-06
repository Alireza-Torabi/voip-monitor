# UI/UX Redesign Direction

**Type:** Product design specification
**Version:** 0.1.0
**Status:** Draft
**Last Updated:** 2026-10-06
**Audience:** Product, design, frontend engineering
**License:** Apache-2.0

## Objective

Redesign VoIP Monitor as a modern operations console for real-time PBX monitoring. The new interface must feel current, deliberate, dense where operations require density, and immediately readable under pressure. It must not resemble a generic admin template or a collection of default component-library cards.

## Current design debt

The current interface is functionally broad but visually generic. The main issues are:

- default Chakra visual language is visible throughout the product;
- too many equally weighted outlined cards create weak hierarchy;
- large gauges consume space without improving operator decisions;
- navigation behaves like grouped buttons rather than a mature application shell;
- operational problems do not dominate the first visual scan;
- status colors are scattered across component-level decisions instead of one semantic system;
- typography has little distinction between page title, section title, KPI, secondary metadata, and identifiers;
- dashboard customization competes with operational hierarchy;
- tables/workspaces are individually usable but do not yet feel like one coherent product;
- loading, stale, empty, disconnected, degraded, and critical states do not share one visual grammar;
- the product does not yet have a strong visual identity.

## Product design direction

The approved working direction for Task 51 is **Modern NOC / Operations Console**.

It should feel:

- technical but not industrially dated;
- dark-capable and high-contrast without neon-heavy cyber styling;
- compact and information-rich without appearing crowded;
- calm in healthy state and unmistakable when something is wrong;
- suitable for desktop operator use first, then tablet/mobile fallback;
- professional enough for long-running wallboard/NOC usage.

It should not feel like:

- a consumer SaaS landing page;
- a generic Bootstrap/Chakra admin panel;
- a gaming/cyberpunk dashboard;
- a collection of oversized KPI cards;
- an analytics BI tool disconnected from real-time operations.

## Primary information architecture

### Global shell

1. Persistent sidebar
   - Overview
   - Telephony
   - History
   - Alerts
   - Infrastructure
   - Settings
2. Top command/status bar
   - selected PBX / fleet scope
   - global search affordance
   - realtime connection indicator
   - active issue count
   - language
   - account menu
3. Page header
   - page title
   - concise operational subtitle
   - page-level actions only

### Overview hierarchy

The first viewport should answer, in order:

1. Is the selected scope healthy?
2. What is wrong now?
3. What is the real-time telephony load?
4. Are trunks/endpoints/queues healthy?
5. Is infrastructure healthy?
6. Is any source stale or disconnected?

The overview is problem-first, not widget-first.

## Visual system

### Color roles

Use semantic roles rather than arbitrary component colors:

- canvas: near-black/dark slate in dark mode; soft neutral in light mode;
- surface-1: primary panel;
- surface-2: nested/raised panel;
- border-subtle: low-contrast structural divider;
- text-primary: high-contrast operational text;
- text-secondary: metadata;
- accent: one restrained product accent for active navigation/actions;
- healthy: green;
- degraded/warning: amber;
- critical: red;
- stale/unknown: neutral/slate;
- informational: cyan/blue.

Healthy state must not flood the screen with green. Color is reserved for status meaning.

### Surfaces

- reduce the number of boxed cards;
- use larger grouped operational sections with internal dividers;
- reserve elevation for menus, dialogs, drawers, and active overlays;
- use 1px subtle borders rather than heavy outlines;
- avoid gradients unless they communicate state or depth deliberately.

### Typography

- use a modern UI sans with excellent Latin/Persian coverage;
- define explicit styles for page title, section title, KPI, label, body, metadata, and mono identifier;
- important numbers must be visually dominant without becoming oversized;
- identifiers, IP-like values, extensions, call IDs, and technical tokens remain LTR and use mono where useful.

### Spacing and density

- desktop grid based on 4/8px rhythm;
- compact row heights for tables and live entity lists;
- generous outer page spacing, tighter inner data spacing;
- avoid large empty zones caused by decorative cards.

### Status treatment

Every operational entity should use the same pattern:

- status dot/icon;
- semantic label;
- primary name;
- secondary detail;
- last-change/freshness metadata when relevant.

Stale and unknown must be visually distinguishable from healthy.

## Core component language

Task 51 mockups must define at minimum:

- application sidebar;
- top status/command bar;
- PBX/fleet selector;
- page header;
- health summary;
- incident/problem list;
- KPI strip;
- live telephony summary;
- trunk/endpoint/queue status rows;
- infrastructure health row;
- compact trend chart;
- search/filter bar;
- dense data table;
- status badge/chip;
- empty/loading/stale/error states;
- detail drawer or side panel.

## Interaction principles

- one primary action per view;
- navigation should not be expressed as rows of similarly styled buttons;
- live state changes should not cause layout jumps;
- realtime connection and source freshness must always be visible but unobtrusive when healthy;
- drill-down should preserve context and prefer drawers/side panels where appropriate;
- dangerous/configuration actions belong in Settings, not in operational surfaces;
- dashboard editing is a secondary mode, never the default operator experience.

## RTL/LTR rules

- Persian page chrome and prose use RTL layout.
- Technical identifiers remain LTR.
- Tables may use RTL column order for Persian UI while preserving LTR values inside technical cells.
- Numeric telephony metrics must remain visually stable in both languages.
- Mirroring must not invert meaning-bearing charts or time axes.

## Desktop geometry target

Initial master mockup target:

- canvas: 1440px desktop;
- sidebar: approximately 224–248px;
- top bar: approximately 56–64px;
- content max width: fluid, not a narrow centered website container;
- 12-column content grid;
- 24px outer desktop gutter;
- primary overview first viewport should fit without requiring vertical scrolling on a typical 900px-height operator display.

## Acceptance criteria for Task 51

Task 51 is complete only when:

- the current design debt is explicitly represented in the redesign decisions;
- global shell and primary Overview information hierarchy are frozen;
- design tokens and typography hierarchy are frozen;
- desktop Overview master mockup passes visual QA;
- no important current monitoring capability is visually lost;
- Persian and English direction behavior is represented;
- no backend or PBX behavior is changed;
- implementation does not begin until the master mockup is approved.

## Non-goals for Task 51

- no production Chakra refactor;
- no backend API changes;
- no new monitoring collectors;
- no call-quality implementation;
- no alert-engine implementation;
- no destructive replacement of the current UI before mockup approval.
