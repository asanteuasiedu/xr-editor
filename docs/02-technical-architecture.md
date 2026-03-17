# XR Editor Technical Architecture (Phase 2)

## Architecture Overview
XR Editor MVP is a client-side React application that runs entirely in the browser and stores project data as an in-memory state tree that can be exported/imported as JSON. A panorama viewer adapter module integrates `pannellum` for rendering a 360-degree scene and hotspot markers, while UI modules (sidebar, forms, toolbar) read/write a single project state. Import/export and validation are isolated in serializer utilities so persistence logic remains decoupled from rendering and interaction code.

## MVP System Summary
The MVP system is a local-only single-page app where the user creates a project, loads panorama scene assets, places and edits info hotspots, and exports/imports project JSON files. There is no backend, auth, or AI; all behavior is deterministic and focused on a short edit loop. The architecture prioritizes clean module boundaries, low coupling, and simple state transitions so features can be built and tested in small increments.

## Key Constraints and Guiding Principles
- Local-first: no server dependencies in MVP runtime path.
- Simplicity first: prefer direct, explicit code over abstractions.
- Modularity: keep viewer, state, serialization, and UI concerns separate.
- Testability: isolate pure utilities (validation, transforms, ID generation).
- Safe state transitions: invalid imports or missing assets must fail gracefully.
- Progressive extensibility: structure should support multi-scene, backend, and richer hotspot types later.

## Recommended Tech Stack (MVP)

### Framework: Vite + React + TypeScript
- `Vite` provides fast dev startup and hot module replacement for short iteration cycles.
- `React` enables component-driven UI composition for editor panels and viewer controls.
- `TypeScript` reduces state/schema mismatch bugs and improves refactoring safety.
- This stack is lightweight, widely adopted, and beginner-friendly for local development.

### 360 Viewer: `pannellum`
- `pannellum` is purpose-built for equirectangular panorama rendering.
- It supports hotspot overlays and camera orientation control needed for MVP.
- Integration complexity is low compared with heavier 3D engines.
- Good fit for local-first web delivery without custom WebGL pipeline work.

### State Management Approach
- MVP: use React state with a top-level `ProjectProvider` (context + reducer or simple `useState` composition).
- Keep actions explicit (`addHotspot`, `updateHotspot`, `importProject`) to simplify debugging.
- Later option: migrate to `Zustand` only if component tree/state updates become hard to manage.

### Styling Approach
- Use plain CSS modules or scoped plain CSS by feature folder.
- Keep tokens minimal (`spacing`, `colors`, `font-size`) in a shared stylesheet.
- Avoid introducing heavy design systems in MVP; prioritize readable, predictable UI.

### ID Generation Strategy
- Prefer `uuid` (v4) for stable IDs across imports/exports and future merges.
- If dependency minimization is required, use a small helper with timestamp + random suffix.
- Keep ID generation centralized in `src/utils/id.ts`.

## Repository and Folder Structure

```text
xr-editor/
  docs/
    01-product-spec.md
    02-technical-architecture.md
    project-json-schema.md
    decisions.md
  public/
    sample-assets/
  src/
    components/
      layout/
      viewer/
      sidebar/
      hotspot/
      common/
    state/
      project-context.tsx
      project-actions.ts
      project-reducer.ts
      selectors.ts
    services/
      panorama/
        pannellum-adapter.ts
      serialization/
        project-serializer.ts
        project-validator.ts
    types/
      project.ts
      hotspot.ts
      scene.ts
      api.ts
    utils/
      id.ts
      file.ts
      error.ts
    styles/
      tokens.css
      app.css
    App.tsx
    main.tsx
```

### What Belongs Where
- `src/components`: UI components and editor interactions (no raw persistence logic).
- `src/state`: application state container, actions, reducer/selectors.
- `src/services/panorama`: viewer lifecycle integration and imperative adapter calls.
- `src/services/serialization`: export/import conversion and schema validation.
- `src/types`: shared TypeScript contracts for project/scene/hotspot models.
- `src/utils`: pure helpers (ID, file reading, error mapping).
- `public`: static assets for local demos and manual testing.
- `docs`: planning, schema, decisions, and architecture references.

## Core Modules and Responsibilities

### `PanoramaViewer`
- Owns lifecycle of pannellum instance (init, update, destroy).
- Renders active scene panorama and hotspot markers from state.
- Emits user click coordinates (`yaw`, `pitch`) for hotspot creation.
- Re-initializes safely when scene image changes or import replaces state.

### `Sidebar`
- Displays scene list and hotspot list for active scene.
- Exposes high-level actions: add scene, select hotspot, delete hotspot, import/export triggers.
- Keeps view-layer concerns only; delegates mutations to state actions.

### `HotspotEditor`
- Form for creating/editing info hotspot content (`title`, `description`, icon if used).
- Validates required fields before dispatching save action.
- Supports edit and create modes with clear UX messaging.

### `ProjectSerializer`
- Converts in-memory `Project` state to downloadable JSON string.
- Parses imported JSON file content into typed project object.
- Coordinates with validator and returns structured errors.

### `ProjectValidator`
- Performs minimal schema checks for required fields/types.
- Ensures scene/hotspot array structure and required nested fields.
- Returns human-readable error list for UI display.

### `ProjectState` (`project-context` + reducer/actions)
- Single source of truth for current project, selection, and dirty status.
- Handles deterministic state transitions from UI events.
- Exposes selectors to keep components simple and reduce repeated logic.

## Data Flow

### Add Hotspot Flow
1. User enters add-hotspot mode and clicks panorama.
2. `PanoramaViewer` emits `yaw/pitch` to state/UI.
3. `HotspotEditor` captures text fields and submits.
4. State action `addHotspot(activeSceneId, hotspotInput)` updates project tree.
5. React re-renders; `PanoramaViewer` receives updated hotspot list.
6. Viewer adapter syncs markers for active scene.

### Import JSON Flow
1. User selects JSON file from import action.
2. `ProjectSerializer.parse()` reads and parses raw text.
3. `ProjectValidator.validate()` checks required structure/types.
4. If valid, `replaceProjectState(importedProject)` is dispatched.
5. `PanoramaViewer` tears down stale instance if needed and re-initializes with active scene.
6. If invalid, error state is set and current project remains unchanged.

## Error Handling and Validation (MVP)

### Minimal JSON Validation Strategy
- Use TypeScript type guards and explicit runtime checks in `project-validator.ts`.
- Keep checks minimal but strict on required fields and object shapes.
- Defer Zod adoption until schema complexity increases (V1+).

### Missing Panorama URL Handling
- On scene load, if `image.src` is missing/empty, block viewer init.
- Show user-facing error in panel: "Scene image is missing. Update or replace this scene file."
- Keep app responsive; allow editing metadata or deleting broken scene.

### Corrupted Import Handling
- Catch JSON parse errors and map to friendly message.
- Catch schema validation failures with per-field error list.
- Never partially merge invalid data into active state.
- Offer retry path without forcing page reload.

## Testing Strategy (MVP)

### Manual Test Checklist
- Create project, add scene, and verify panorama renders.
- Add hotspot at clicked position and confirm marker placement.
- Edit hotspot title/description and confirm persistence in UI.
- Delete hotspot and verify marker/list removal.
- Export JSON and confirm file downloads.
- Import valid JSON and verify full state replacement.
- Import invalid/corrupted JSON and verify safe failure.
- Reload app and verify expected local-only behavior (no hidden backend dependency).

### Unit Tests Later (Optional in MVP)
- Add `Vitest` for validator, serializer, ID helper, and reducer action tests.
- Prioritize pure modules with deterministic input/output.

### E2E Tests Later
- Add `Playwright` for critical flows: create -> annotate -> export -> import.
- Keep test data in `public/sample-assets` and fixture JSON files.

## Forward Compatibility Notes

### Multi-Scene Navigation Later
- `sceneLinks` already exists in data model and serializer.
- Add `SceneLinkEditor` and viewer click mode for link placement.
- Extend `PanoramaViewer` adapter to render link hotspots with navigation handler.

### Auth/Backend Later
- Keep persistence behind a `ProjectRepository` interface (`load`, `save`, `list`).
- MVP implementation uses file import/export; future implementation can call APIs.
- UI/state modules should depend on repository interface, not transport details.

### Token/AI Services Later (Interfaces Only)
- Define optional service interfaces in `src/types/api.ts` (e.g., `InsightAssistService`).
- Keep integration points in `src/services` so UI components remain unchanged.
- Do not couple core state shape to AI response formats.
