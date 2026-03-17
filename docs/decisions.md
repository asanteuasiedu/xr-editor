# XR Editor Decision Log

## Decision 1: Local-only JSON persistence first

### Decision
Use export/import JSON files as the primary persistence model for MVP, with no backend storage.

### Rationale
- Reduces engineering scope and setup complexity for early delivery.
- Aligns with privacy and offline-friendly usage expectations.
- Enables a complete end-to-end workflow without infrastructure dependencies.

### Implications
- Users are responsible for file management and versioning.
- No real-time collaboration or shared workspace in MVP.
- Import validation becomes critical to prevent broken project states.

### Revisit Trigger
Revisit when user demand requires cross-device continuity, team collaboration, or auto-save history beyond local browser/session behavior.

## Decision 2: Hotspots are info-only in MVP

### Decision
Limit hotspot behavior to informational content (`type: "info"`) for MVP.

### Rationale
- Keeps authoring model simple and learnable for first-time users.
- Avoids premature complexity in UI, rendering logic, and content validation.
- Delivers clear value quickly: annotate a 360 scene with context.

### Implications
- No hotspot actions for navigation, media playback, forms, or commerce in MVP.
- Data model and UI can optimize for one hotspot flow initially.
- Future hotspot types must preserve compatibility with existing `info` entries.

### Revisit Trigger
Revisit when repeated user requests appear for interactive hotspot behaviors (for example, scene jumps, embedded media, or CTA actions).

## Decision 3: Scenes are supported in data model even if UI starts with one scene

### Decision
Support multiple scenes in the JSON data model from day one, even if MVP UI initially focuses on a single-scene workflow.

### Rationale
- Prevents disruptive schema migration when multi-scene UI is added.
- Enables forward compatibility with scene links and larger experiences.
- Keeps exporter/importer architecture stable as product grows.

### Implications
- MVP UI can remain simple while parser/validator handles scene arrays.
- Additional QA is needed to ensure unused multi-scene fields do not confuse beginners.
- Documentation must clearly separate "supported in model" from "editable in UI now."

### Revisit Trigger
Revisit if early MVP analytics show persistent confusion from model/UI mismatch, or when multi-scene authoring enters active development.

## Decision 4: Use `pannellum` for MVP panorama viewer

### Decision
Adopt `pannellum` as the viewer engine for equirectangular panorama display and hotspot rendering in MVP.

### Rationale
- Direct fit for 360 panorama use case without full 3D engine overhead.
- Faster implementation path for hotspot placement/editing workflows.
- Reduces rendering infrastructure complexity for a small team.

### Implications
- Viewer lifecycle must be wrapped in an adapter to keep UI decoupled.
- Some advanced XR interactions may require extensions or later migration.
- Team should standardize viewer API usage to avoid scattered imperative calls.

### Revisit Trigger
Revisit if performance issues, required features, or plugin limitations block V1/V2 roadmap needs.

## Decision 5: Use import/export JSON files before localStorage persistence

### Decision
Prioritize explicit JSON file import/export over automatic browser `localStorage` persistence in MVP.

### Rationale
- Makes project state portable across machines immediately.
- Keeps persistence behavior visible and teachable to beginners.
- Avoids hidden browser-storage edge cases during early validation.

### Implications
- Users must manually export to save durable progress.
- Browser refresh can lose unsaved in-memory edits.
- UI must emphasize export visibility and unsaved-change indicators.

### Revisit Trigger
Revisit when users repeatedly expect automatic draft recovery or when session loss becomes a common support issue.

## Decision 6: Keep state in React primitives first, consider Zustand only on complexity signal

### Decision
Use React state/context and explicit actions for MVP; defer Zustand adoption unless state complexity warrants it.

### Rationale
- Minimizes dependencies and onboarding overhead in early phase.
- Keeps state transitions straightforward for debugging and beginner contributors.
- Avoids premature abstraction before actual complexity appears.

### Implications
- Component re-render boundaries need monitoring as UI grows.
- Action/reducer patterns should stay consistent to ease future migration.
- A migration path to Zustand should preserve existing state contracts.

### Revisit Trigger
Revisit when state logic becomes fragmented, performance issues emerge, or cross-component coordination becomes difficult to maintain.
