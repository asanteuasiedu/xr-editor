# XR Editor Product Spec (Phase 1: Idea Clarification)

## Problem Statement
Creating XR experiences from 360-degree panoramas is still too technical for many educators, marketers, and small teams. Existing tools often assume 3D engine knowledge, require cloud accounts, or bundle advanced features that overwhelm beginners.

XR Editor solves this by offering a local-only, browser-based workflow where a user can load a single equirectangular panorama, place simple "Insight Zones" (informational hotspots), and export a portable JSON project file. The MVP focuses on clarity and reliability over complexity so first-time users can complete a full project loop quickly.

## Target Users
- Beginners who want to turn a 360-degree image into an interactive XR scene.
- Educators and trainers creating guided visual explanations.
- Product, real-estate, or tourism storytellers who need lightweight info hotspots.
- Solo creators who prefer local files and no account setup.

## MVP Scope (Included)
- Local web app (runs in browser, no backend).
- Create a new project with basic metadata.
- Add one or more scenes from 360-degree equirectangular panoramas.
- View a scene and place "Insight Zone" hotspots with title and description.
- Edit and delete hotspots.
- Export full project to a JSON file.
- Import JSON file to continue editing.
- Basic in-app validation for required fields (for example, hotspot title cannot be empty).

## Explicit Non-Goals (Excluded for MVP)
- No user accounts, authentication, or permissions.
- No cloud sync, server storage, or collaboration.
- No payments, billing, subscriptions, or licensing flows.
- No AI content generation.
- No advanced hotspot types (video, quiz, forms, commerce actions).
- No scene-to-scene navigation UI (data model can include links, but UI does not need to expose authoring in MVP).
- No full undo/redo history in MVP.
- No analytics, telemetry dashboard, or event pipeline.

## User Journeys

### 1) Create Project
1. User opens XR Editor in browser.
2. User clicks "New Project".
3. User enters project name (and optional description).
4. User confirms creation.
5. App opens the editor with an empty project state and clear next step: "Add Scene".

### 2) Add Scene
1. User clicks "Add Scene".
2. User selects a local equirectangular panorama image file.
3. User enters scene name.
4. App validates image load and creates scene.
5. Scene opens in viewer as the active scene.

### 3) Add Hotspot (Insight Zone)
1. User clicks "Add Insight Zone" mode.
2. User clicks a location in the 360 viewer.
3. App opens hotspot form with position pre-filled.
4. User enters title and description.
5. User saves hotspot.
6. Hotspot marker appears immediately in the scene.

### 4) Export Project JSON
1. User clicks always-visible "Export JSON" action.
2. App serializes current project into JSON.
3. Browser downloads file (for example, `my-project.project.json`).
4. User can store/share this file manually.

### 5) Import Project JSON
1. User clicks "Import JSON".
2. User selects a previously exported project file.
3. App validates JSON structure and required fields.
4. If valid, app loads project state and opens first scene.
5. If invalid, app shows clear error and does not overwrite current project unless user confirms.

## Core User Stories with Acceptance Criteria

1. **As a beginner, I can create a new project quickly.**
- Acceptance criteria:
  - "New Project" is visible on first screen.
  - Project is created with a required name.
  - Editor state updates without page reload.

2. **As a user, I can add a panorama scene from my computer.**
- Acceptance criteria:
  - File picker accepts supported image formats.
  - Invalid file types show a clear error.
  - Valid upload creates a new scene record.

3. **As a user, I can see the active scene in a 360 viewer.**
- Acceptance criteria:
  - Scene renders after load.
  - Empty/loading states are clearly labeled.
  - Viewer interactions do not crash app state.

4. **As a user, I can place an Insight Zone by clicking in the viewer.**
- Acceptance criteria:
  - Click in add mode creates draft position.
  - Hotspot form opens for content input.
  - Saving adds marker at expected location.

5. **As a user, I can edit hotspot text after creation.**
- Acceptance criteria:
  - Existing hotspot can be selected.
  - Title/description changes persist in memory.
  - Viewer reflects updated content.

6. **As a user, I can delete a hotspot I no longer need.**
- Acceptance criteria:
  - Delete action is available for selected hotspot.
  - Deleted hotspot disappears immediately.
  - Project state no longer contains hotspot ID.

7. **As a user, I can export my work to JSON anytime.**
- Acceptance criteria:
  - "Export JSON" is visible in editor.
  - Exported file contains project, scenes, and hotspots.
  - Export output is valid JSON.

8. **As a user, I can import a project JSON and continue editing.**
- Acceptance criteria:
  - Import action is visible and accessible.
  - Valid file restores project content.
  - Invalid schema displays actionable error.

9. **As a user, I can understand errors without technical jargon.**
- Acceptance criteria:
  - Errors describe what failed and next action.
  - Messages avoid stack traces/internal terms.
  - Blocking errors prevent corrupted state load.

10. **As a user, I can rely on simple defaults to avoid setup friction.**
- Acceptance criteria:
  - New items get sensible IDs and timestamps.
  - First scene becomes active automatically.
  - Optional fields can be left blank safely.

11. **As a user, I can tell whether I have unsaved changes.**
- Acceptance criteria:
  - App shows a dirty-state indicator after edits.
  - Indicator clears after export or fresh import.
  - Closing/reloading can prompt user if unsaved work exists.

## UX Principles for Beginners
- Keep primary actions always visible: `New`, `Import`, `Export`.
- Prefer simple defaults over mandatory configuration.
- Use plain language labels (for example, "Insight Zone" instead of internal terms).
- Show one clear next step in empty states.
- Avoid irreversible surprises; confirm destructive actions.
- Defer advanced editing features (like full undo/redo) until later phases.
- Provide immediate visual feedback for every user action.
- Fail safely: invalid imports should not silently replace working state.

## Milestones Roadmap

### MVP
Deliver local-only authoring for panorama scenes with info-only hotspots plus JSON export/import. Success means a beginner can complete create -> annotate -> export -> import without docs.

### V1
Add usability upgrades: multi-scene management UI, basic scene reordering, scene link authoring, and stronger validation/recovery flows. Keep architecture local-first while improving project complexity handling.

### V2
Add richer authoring and distribution options such as additional hotspot types, presentation mode improvements, and optional collaboration/cloud sync if product direction supports it. Preserve compatibility with MVP JSON where possible.
