# 05 Pilot Refinement Plan - Sesame Workshop

## Pilot Objective

This pilot phase is intended to validate whether the XR Editor MVP can support a real co-design and learning demonstration context before the team invests in Phase B platform work. The near-term goal is not backend scale or product infrastructure. It is to make the current local-first editor polished enough to present confidently, easy enough for first-time student creators to understand, and structured enough to support a credible authored example that can be discussed in a fellowship setting and later referenced in a public-facing case study.

In practical terms, this phase should answer three questions. First, can the MVP present an authored immersive learning experience clearly and professionally? Second, can students understand the authoring model well enough to ask questions and, if time permits, create simple experiences of their own? Third, can the project be packaged in a lightweight hosted form that is stable enough for a pilot session without pulling the team prematurely into backend or platform complexity?

## Audience Analysis

### Student audience

Students in the fellowship session are likely to approach the experience from a curiosity and usability perspective rather than a product evaluation perspective. They will need to understand what the immersive project is trying to teach, how navigation works, and what kinds of content hotspots can carry. If the authoring portion happens, they will also need a very short path from blank state to visible result.

Students should leave feeling that immersive experiences are understandable, buildable, and relevant to real skill-building pathways. They do not need to see platform depth. They need clarity, confidence, and a small number of obvious next actions.

### Institutional / purchasing audience

Institutional stakeholders and future purchasing audiences will likely evaluate the pilot differently. They will care less about the novelty of the editor itself and more about whether the authored example feels intentional, whether the learning framing is coherent, and whether the product direction appears credible and extensible.

This audience should come away with confidence that the tool can support structured immersive learning experiences, that the authoring workflow is approachable enough for guided use, and that the team has a believable path from a polished local MVP to a more scalable platform.

### What each audience needs to understand or feel

- Students need to feel: "I understand what this experience is doing, and I can imagine making one."
- Students need to understand: scenes, hotspots, preview flow, and basic content types.
- Institutional audiences need to feel: "This is polished, purposeful, and worth continued attention."
- Institutional audiences need to understand: the learning use case, the authored experience quality, and the bounded but credible publishing path.

## Current MVP Readiness

### What the editor can already do that supports the pilot

- Create multi-scene panorama experiences with scene-to-scene navigation.
- Support multiple hotspot content types: `info`, `sceneLink`, `externalLink`, and `image`.
- Upload local panoramas and hotspot images directly into the project.
- Save and restore work locally through autosave and JSON import/export.
- Present authored work in a cleaner Preview Mode foundation.
- Guide first-time use through onboarding and starter templates.
- Show a more polished interface than an internal-only prototype.

### What still needs refinement before pilot use

- Preview Mode still needs to feel more like a finished presentation surface than an editor in disguise.
- Hotspot content presentation should feel cleaner, more readable, and more intentional for students and stakeholders.
- Guided flows should reduce hesitation around "what do I do first?" for both authored demos and any student hands-on activity.
- The team needs one flagship example that demonstrates the product's strengths without exposing rough edges.
- Lightweight publish/export packaging needs a bounded approach so the authored experience can be shared or shown outside the editor context without Phase B infrastructure.

## Pilot Scope

The pre-Phase-B pilot scope should stay tightly focused on four refinement areas plus one authored deliverable:

- Presentation polish
- Guided flows
- Hotspot/content presentation improvements
- Lightweight publish/export packaging
- One flagship authored example experience

This scope is intentionally narrower than full productization. The point is to improve clarity, credibility, and readiness for a real session, not to solve backend, collaboration, or long-term distribution.

## Recommended Immediate Milestones

### 1. Presentation Mode polish

Strengthen Preview / Present behavior so the authored experience feels like a clean immersive viewer rather than a semi-hidden editor. This matters first because the pilot will be judged most directly on what people see and feel in the experience itself.

### 2. Guided first-run and demo flow refinement

Tighten onboarding, empty states, and starter cues so a facilitator can move quickly from explanation to demonstration. This reduces friction during a live session and lowers the risk that students stall during a short hands-on window.

### 3. Hotspot presentation and content readability pass

Improve the way info and image hotspots open and read in Preview / Present mode. This is critical because the authored example will succeed or fail based on how clearly content is delivered once a hotspot is clicked.

### 4. Flagship authored example production

Create one polished, story-driven immersive learning example aligned to the seven skill-building pathway context. This becomes the main artifact for the co-design session, the student discussion, and later stakeholder/case-study communication.

### 5. Bounded static publish/export packaging

Define and implement a narrow export/publish path for the pilot experience, suitable for static hosting. This milestone matters because the team needs a lightweight way to share or present the authored work outside the local editor without prematurely building platform infrastructure.

## Authored Flagship Experience Requirements

The flagship demo should be small enough to polish thoroughly and large enough to demonstrate the value of the system.

### Recommended structure

- 5 to 7 scenes total.
- Each scene should correspond to one stage, setting, or pathway moment rather than arbitrary panorama changes.
- The experience should map clearly to the skill-building pathway framing used in the session.

### Content requirements

- Include all major hotspot behaviors currently supported.
- Use `info` hotspots for explanation and instructional framing.
- Use `sceneLink` hotspots for guided movement through the experience.
- Use at least one `image` hotspot to demonstrate richer media support.
- Use `externalLink` only when it adds clear value and does not interrupt the pilot flow too aggressively.

### Experience quality requirements

- Student-friendly language with short, readable bodies and clear titles.
- Consistent visual and narrative structure across scenes.
- Clear beginning, middle, and end so the experience feels intentionally authored.
- Enough polish that a stakeholder could imagine the MVP becoming a real product.

### Stakeholder-facing polish requirements

- Project metadata should be clean and intentional.
- Scene names should read like presentation labels, not internal placeholders.
- Hotspot density should feel curated rather than cluttered.
- The experience should communicate a concrete educational use case, not just technical capability.

## Lightweight Publish/Export Packaging Recommendation

The recommended pilot strategy is a bounded static export approach. For this phase, the output does not need to become a full publishing platform. It only needs to package one authored project and its required assets into a stable, demo-ready bundle that can run via static hosting.

### Recommended approach

- Export a single project package containing:
- one project JSON
- a bounded asset set
- a lightweight viewer shell or hosted viewer page that loads that JSON locally

GitHub Pages or a similar static host is a reasonable fit for this pilot because it is low-cost, familiar, and sufficient for a single curated experience. A small hosted bundle with roughly 7 panoramas plus supporting media is feasible as long as the team intentionally manages asset size, compresses images appropriately, and avoids treating the pilot as an open-ended publishing system.

### Constraints and risks for static hosting

- Data URL embedding can make exported JSON files too large if used indiscriminately.
- Panorama assets may need optimization to stay within a practical static-hosting footprint.
- The pilot should assume a single curated experience or a very small set of authored experiences, not many user-generated projects.
- Lightweight hosting is suitable for demonstration and case-study support, but not yet for robust content management, analytics, access control, or large media libraries.

## Risks and Constraints

- Local-first limitations mean there is no shared editing, remote storage, or hosted project management.
- Asset size limits may become a practical constraint, especially if multiple large panoramas or embedded images are used without optimization.
- Session-time constraints mean students may only have enough time for light authoring, so the workflow must be immediately understandable.
- First-time student creators may still struggle with panorama selection, hotspot planning, or narrative structure unless the experience is strongly guided.
- If the authored flagship example is under-polished, stakeholders may interpret MVP roughness as a product-direction problem rather than an expected pre-Phase-B limitation.

## Success Criteria

### What success looks like for the co-design session

- Students can understand the authored experience without facilitator-heavy explanation.
- Students can identify how hotspots, scene navigation, and media support work.
- If the hands-on segment happens, students can make a simple scene or hotspot change without getting lost.
- The Q&A focuses on possibilities and use cases rather than confusion about core interactions.

### What success looks like for the case-study / purchasing audience

- The authored experience feels polished enough to present as a credible early product demonstration.
- The learning pathway framing is visible and understandable.
- The pilot shows that immersive learning experiences can be authored with a relatively simple workflow.
- The team can articulate a clear reason to invest in Phase B based on observed needs rather than speculation.

## Recommended Next Step After Pilot

The team should move into Phase B after the pilot once there is clear evidence that the authored experience resonates, the workflow is understandable in a real session, and the limits of the local-first/static approach are actively constraining progress. That is the right moment to begin backend/platform work because the team will then be solving validated problems: distribution, hosted project access, reusable publishing, asset management, and multi-user or institutional workflows.

If those pilot signals are weak, the next step should not be backend expansion. It should be another focused refinement cycle on presentation quality, author guidance, and published-experience clarity until the core value proposition lands more convincingly.
