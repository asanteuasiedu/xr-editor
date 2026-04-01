# XR Editor (Multi-Scene MVP Slice)

Local-first XR editor prototype built with Vite + React + TypeScript.

## Prerequisites
- Node.js 18+
- npm 9+

## Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Open the local URL shown in terminal (usually `http://localhost:5173`).

## What Works Now
- One in-memory project with multiple scenes
- Editable project metadata (name, description, author / organization)
- Active scene switching from sidebar
- Scene CRUD: add, select, rename, update panorama URL/path, delete (minimum one scene enforced)
- 360 panorama rendering via `pannellum` for the active scene
- Hotspot CRUD scoped to the active scene only
- Optional hotspot destination links (`targetSceneId`) for scene-to-scene navigation
- Hotspot types: `info`, `sceneLink`, `externalLink`, `image`, `multipleChoice`
- Clicking a linked hotspot switches to destination scene
- External-link hotspots open URLs in a new tab
- Image hotspots open a lightweight image preview modal
- JSON export/import for local persistence (including hotspot scene links)
- Export Presentation Package flow for a bounded static pilot bundle
- Local autosave/restore using browser `localStorage`
- Local image uploads for scene panoramas and image hotspots (embedded as Data URLs)
- Global Edit Mode / Presentation Mode flow for polished immersive viewing
- Guided onboarding card for first-time or blank-project flows
- Starter templates: Blank Tour, Museum Exhibit, Lesson Module, Photo Story

## UI Layout + Design System
- Product-style layout with clear zones: header, left sidebar, viewer area, and bottom hotspot editor panel.
- Edit Mode now uses a more immersive HUD-style product frame on desktop/tablet: the panorama acts as the dominant workspace surface, while the left navigation rail and right contextual panel float over it as frosted foreground controls.
- The layout is now responsive across desktop, tablet, and phone sizes. On smaller screens, the rail collapses into a horizontal touch-friendly navigator and the contextual panel stacks below the viewer for easier mobile editing.
- On phone-width screens, the layout now shifts into a mobile-first fullscreen HUD: the panorama stays dominant, the top bar overlays the scene, compact context cards sit beneath it when needed, and the primary section navigation moves into a bottom control bar with zoom/navigation widgets floating just above it.
- Card-based sections with rounded corners, soft shadows, and consistent spacing.
- Theme tokens applied in CSS (`#F6F7FB` background, `#FFFFFF` cards, `#E6E8EF` borders, `#7C6CFF` accent).
- Reusable button hierarchy:
  - Primary (accent gradient, pill shape)
  - Secondary (neutral fill + subtle border)
- Header branding uses the Udēēsa logo from `public/branding/udeesa-logo.png` (`/branding/udeesa-logo.png` in the app).
- Native panorama compass and zoom controls are visually reskinned to match the HUD theme while keeping their built-in behavior, including a stylized futuristic wireframe-globe compass in the lower-right.
- Styling changes are cosmetic; editor logic and data behavior remain unchanged.

## Immersive Edit Mode
- Edit Mode now keeps the panorama viewer dominant and moves authoring controls into frosted overlay panels.
- The left side now works as a persistent navigation rail for `Controls`, `Project`, `Scenes`, `Details`, and `Insight Zones`, while the right side acts as the main contextual workspace.
- On desktop and tablet, both navigation and contextual editing surfaces float over the 360 scene so the panorama remains the visual background canvas of the editor.
- The header, scene title, viewer controls, and contextual surfaces now share a darker blurred-glass HUD treatment with higher-contrast light text so the editor chrome feels unified while staying secondary to the panorama.
- This refactor is aimed at clearer authoring, stronger information hierarchy, and better classroom facilitation during localized learning activities.
- The left overlay stack now sits lower so it stays clear of the `Your XR Media` heading and viewer zoom controls.
- Overlay cards appear in this pilot-focused order: `Project Controls`, `Project Inspector`, `Scenes`, `Active Scene Details`, and `Insight Zones (Active Scene)`.
- All overlay panels start closed by default for a cleaner first impression.
- A first-time guided walkthrough now starts automatically in a deterministic sequence, highlights each overlay section step-by-step, and then opens the Scene Library as the next guided step.
- The selected hotspot editor appears as an anchored frosted popover near the selected insight zone, with an in-view fallback placement on tighter layouts.
- `Project Controls` is intentionally lightweight: local save state, `Present Project`, `Export Project`, `Start Guided Tour`, and `Select a Scene`.
- On a fresh editor start, the walkthrough always appears first and the Scene Library opens only after that walkthrough completes.
- During that first-run onboarding sequence, the starter panorama viewer stays visually behind the flow so the immersive loading overlay does not appear before the walkthrough and Scene Library.
- `Select a Scene` can always be used later to reopen that local scene library and apply a curated panorama to the active scene.
- Panorama swaps show a lightweight immersive loading layer while the new scene media comes in.
- The same immersive loading treatment is used across Edit Mode and Presentation Mode, with the message `Composing your immersive environment...`.
- Presentation Mode remains cleaner and does not show the full authoring overlays.

## Quick Editor Workflow
1. Start with the starry-night starter scene or use **Select a Scene** for one of the predefined pilot environments.
2. Add or select a scene in the sidebar.
3. Fill in project metadata in **Project Inspector**.
4. Set or upload the scene panorama in **Active Scene Details**.
5. Click **Add Insight Zone**, then click in the panorama to place it visually.
6. Select an insight zone to edit its title, body, type, and destination behavior.
7. Optionally set a **Destination Scene** to create navigation hotspots.
8. Use **Move Selected Hotspot**, then click in the panorama to reposition it.
9. Use **Cancel Placement** any time while placement/move mode is active.
10. Export the project JSON when ready.

## Onboarding + Templates
- The sidebar shows a **Getting Started** card for blank/first-time projects with a short step-by-step flow.
- Use **New Project From Template** to quickly start with prefilled scenes/content:
  - `Blank Tour`: one starter scene with the starry-night panorama.
  - `Museum Exhibit`: two linked exhibit scenes with starter info hotspots.
  - `Lesson Module`: one teaching scene with sample info + external link hotspot.
  - `Photo Story`: three-scene story path with basic scene-link progression.
- Templates stay fully editable and work with autosave, uploads, preview mode, and JSON export/import.

## Edit Mode vs Presentation Mode
- **Edit Mode** shows the full authoring interface: project inspector, scenes/hotspots controls, and hotspot editor.
- **Presentation Mode** acts like a lightweight immersive viewer with reduced editor chrome, a taller panorama surface for pilot demos, overlaid metadata and app controls, and a stronger cinematic first-entry reveal into the opening scene.
- Presentation Mode is optimized for phone/tablet viewing with touch-friendly progress cards, readable learning-goal content, and mobile-sized overlays for info, image, and question interactions.
- Use **Present Project** to enter presentation mode quickly, then **Return to Edit Mode** when done.
- Switching modes does not lose project data; current scene stays active.
- A subtle "Tap hotspots to explore" hint appears for new viewers and can be dismissed.
- Presentation Mode also shows a session-based `Activity Progress` overlay that tracks unique insight zones found in the current session.
- If a scene includes multiple-choice questions, Presentation Mode shows a per-scene score beneath the progress bar.

### Presentation Hotspot Behavior
- `info`: opens a cleaner reading-focused modal with title and body.
- `sceneLink`: navigates to destination scene.
- `externalLink`: opens URL in a new tab.
- `image`: opens an image viewer modal with title and optional caption pulled from the hotspot body.

### Session Progress
- Each unique insight zone activated in Preview / Presentation Mode counts as `1` point.
- Re-clicking the same zone does not add more points.
- Total available points equal the total number of insight zones in the current project.
- Progress is session-based only for now, so it resets on refresh or a new browser session.
- Multiple-choice questions also record one answer per question per session and update the active scene score.
- The completion overlay appears after all insight zones have been discovered and all multiple-choice questions have been answered in the current session.

### Marker Visual Legend
- `info`: white marker with `i`.
- `sceneLink`: purple orb with a subtle world/grid feel.
- `externalLink`: purple glowing dot.
- `image`: white glowing dot.
- `multipleChoice`: uses the baseline marker style in the viewer and opens a frosted question modal in Presentation Mode.
- Selected hotspots show a stronger ring/glow state for easier tracking.

Placement tip: click and release without dragging to place/move at the intended point.

Hotspot marker note: the viewer now uses a minimal native pannellum marker class (no custom tooltip anchor DOM) to keep marker placement aligned to the true hotspot coordinate. A `PANNELLUM_HOTSPOT_DEBUG` toggle is available in `PanoramaViewer.tsx` for coordinate diagnostics.

## Starter Panorama + Scene Library Assets
The starter project now opens with:
- `public/scene-library/starry-night-moon.jpg`

The predefined scene picker expects seven local panoramas under:
- `public/scene-library/`

Suggested files:
- `starry-night-moon.jpg`
- `The Construction Site.jpg`
- `The Village Road.jpg`
- `The Water Processing Plant.jpg`
- `The Forge.jpg`
- `The Refinement Factory.jpg`
- `The Fabrication Lab.jpg`
- `The Global Classroom.jpg`

If a scene points to a missing path, the viewer shows an error note. Place an equirectangular image at that path and refresh.

## Viewer Lifecycle Note
- The Pannellum viewer is initialized only when the active scene panorama URL changes.
- Hotspot edits and selection changes sync markers without rebuilding the viewer instance.
- React Strict Mode remains enabled; in development, React may mount/unmount twice on first render by design.

## How To Create A Linked Tour
1. Create at least two scenes.
2. Add a hotspot in scene A.
3. Select that hotspot and set `Destination Scene` in the hotspot editor.
4. Click the hotspot in the panorama viewer to navigate to the linked scene.
5. Optionally create return links from scene B back to scene A.

If a scene is deleted, any hotspot links pointing to that scene are cleared automatically.

## Export / Import Notes
- `Export Project` downloads current in-memory state with a sanitized project-name filename when possible (for example, `my-xr-project.json`).
- If the project name is empty after sanitization, export falls back to `project.json`.
- `Import Project` accepts a `.json` file and replaces current in-memory state after validation.
- Invalid JSON syntax or malformed structure shows an on-screen error.

## Presentation Package Export
- `Export Presentation Package` downloads three files for one curated pilot project:
- `*-index.html`: a presentation-oriented static viewer entry point
- `*-project.json`: the current project data
- `*-README.txt`: quick local review and hosting instructions
- Keep the exported files together in the same folder.
- For local review, serve that folder through a simple static server such as `python3 -m http.server` or `npx serve`.
- For bounded static hosting, upload the exported files together to a host such as GitHub Pages.
- The exported presentation opens directly in viewer mode and keeps hotspot behaviors for `info`, `image`, `sceneLink`, and `externalLink`.
- Current limitations:
- this is a lightweight pilot package for one project at a time
- it is not a full publishing platform
- large embedded Data URL assets can make the exported JSON file large
- the exported viewer currently loads pannellum from a CDN, so hosted or network-connected use is expected

## Local Autosave
- The editor autosaves the full project to browser `localStorage` shortly after changes.
- On load, the app restores the most recent valid local draft automatically.
- If local draft JSON is corrupted or invalid, it is ignored and the app falls back safely to the starter project.
- The sidebar shows local save state: `Saved locally`, `Unsaved changes`, or `Restored local draft`.
- `Reset Local Draft` remains available from `Project Inspector` and clears the local draft after confirmation.

## Local Uploads (Panorama + Image Hotspots)
- In **Active Scene Details**, use **Upload Panorama** to choose an image from your computer.
- On mobile, **Capture to Active Scene** can open the device camera when supported and replace the current scene media.
- **New Scene from Capture** and **New Scene from Image** let you turn a captured or selected photo into a brand-new scene inside the existing authoring flow.
- For `image` hotspots, use **Upload Image** in the hotspot editor.
- Uploads are converted to Data URLs and stored directly inside project data.
- Because assets are embedded, autosave restore and JSON export/import preserve uploaded files.
- Large image uploads can noticeably increase local draft size and exported JSON file size.
- Manual URL/path fields remain available as a fallback.
- This capture flow is a lightweight mobile bridge into scene authoring, not full AR capture, stitching, or world tracking.

## Hotspot Types
- `info`: standard insight annotation.
- `sceneLink`: navigates to another scene on click (`targetSceneId`).
- `externalLink`: opens an external URL in a new browser tab (`url`).
- `image`: opens a lightweight image preview (`imageUrl`).
- `multipleChoice`: opens a question modal in Presentation Mode and tracks one scored answer per session (`questionPrompt`, `answerOptions`, `correctAnswerIndex`, optional `feedbackText`).

### Example JSON (linked hotspots)
```json
{
  "id": "project-tour",
  "name": "Simple Linked Tour",
  "activeSceneId": "scene-lobby",
  "scenes": [
    {
      "id": "scene-lobby",
      "name": "Lobby",
      "panoramaUrl": "/sample-panorama.jpg",
      "hotspots": [
        {
          "id": "h-lobby-1",
          "type": "sceneLink",
          "title": "Go To Gallery",
          "body": "Move to the gallery scene.",
          "yaw": 15.2,
          "pitch": -2.3,
          "targetSceneId": "scene-gallery"
        }
      ]
    },
    {
      "id": "scene-gallery",
      "name": "Gallery",
      "panoramaUrl": "/sample-panorama.jpg",
      "hotspots": [
        {
          "id": "h-gallery-1",
          "type": "sceneLink",
          "title": "Back To Lobby",
          "body": "Return to lobby.",
          "yaw": -40.1,
          "pitch": 3.7,
          "targetSceneId": "scene-lobby"
        },
        {
          "id": "h-gallery-2",
          "type": "image",
          "title": "Art Note",
          "body": "This one is info-only.",
          "yaw": 65.8,
          "pitch": 11.9,
          "imageUrl": "https://example.com/art-note.jpg"
        }
      ]
    }
  ]
}
```

## Out of Scope in This Slice
- Drag-and-drop/advanced placement UX
- localStorage persistence
- Backend/auth/payments/AI integrations
- Image/video/3D hotspot types
