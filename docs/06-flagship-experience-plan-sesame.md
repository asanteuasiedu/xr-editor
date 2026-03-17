# 06 Flagship Experience Plan - Sesame Workshop

## Experience Purpose

The flagship experience should demonstrate that the XR Editor can produce a small but polished immersive learning activity that feels intentional, understandable, and relevant to real educational use cases. It should show how a multi-scene experience can guide a learner through structured content, combine different hotspot behaviors, and support a clear instructional narrative without requiring backend infrastructure or advanced media systems.

This matters for students because the experience needs to feel approachable, engaging, and legible enough that they can understand both the learner-facing interaction and the authoring logic behind it. It matters for institutional audiences because the same experience must signal that the MVP can support purposeful learning design, not just technical experimentation. The flagship project should therefore act as both a demo artifact and a proof-of-direction artifact.

## Audience Context

### Student audience

Students will likely encounter the flagship project after seeing a richer 3DVista example, so the XR Editor experience should not try to compete on complexity. Instead, it should make the core authoring model visible and believable: scenes, hotspots, guided movement, and embedded learning content.

Students should take away three things:

- Immersive learning experiences can be structured around clear educational pathways.
- A simple tool can still produce something that feels coherent and useful.
- They can imagine how they might create or adapt an experience of their own.

### Facilitator / institutional audience

Facilitators and institutional viewers will likely read the project as an indicator of product direction. They need to see a credible learning use case, clean authored flow, and clear signs that the MVP can support future classroom or programmatic use.

They should take away three things:

- The experience is organized around a meaningful learning framework rather than disconnected scenes.
- The tool supports multiple content and navigation patterns in a way that is understandable for guided deployment.
- The MVP already communicates enough product value to justify continued refinement and eventual Phase B investment.

## Recommended Experience Structure

### Total number of scenes

The flagship experience should use 6 to 8 scenes total. That is enough to show narrative and structural variety without creating too much production overhead or making the pilot feel long.

### Suggested beginning / middle / end flow

- Beginning: an orientation scene that frames the experience and introduces the seven skill-building pathways.
- Middle: a focused set of pathway scenes that illustrate how different types of skills or learning moments can be represented.
- End: a reflection or synthesis scene that ties the pathways together and points back to discussion, extension, or next-step thinking.

### How the seven skill-building pathways should be represented

The best approach for the pilot is a hybrid structure.

- Use one orientation scene to introduce all seven pathways at a high level.
- Use a smaller set of representative pathway scenes, each standing in for a cluster of related skill-building moments rather than requiring one scene per pathway.
- Use hotspots within those scenes to reference the full set of seven pathways so the framework is visible even if the authored project does not create seven fully distinct branches.

This hybrid model is the right balance for the pilot. It keeps production manageable while still signaling that the experience is grounded in a broader skill-building system.

## Scene Plan

### Scene 1 - Welcome / Orientation Hub

- Purpose: introduce the immersive activity, explain what the learner is exploring, and frame the seven skill-building pathways.
- Suggested media/panorama: a welcoming, high-level setting such as a classroom hub, innovation studio, or learning commons.
- Suggested hotspot behaviors:
- `info` hotspots for pathway summaries or facilitator framing
- `sceneLink` hotspots to enter the main pathway scenes
- optional `image` hotspot for a pathway map or visual legend

### Scene 2 - Observation and Discovery

- Purpose: show a skill-building moment focused on noticing, questioning, and interpreting context.
- Suggested media/panorama: an environment with multiple points of interest such as a lab, gallery, workshop, or field site.
- Suggested hotspot behaviors:
- `info` hotspots that model reflection prompts
- `image` hotspot that expands a supporting visual artifact
- `sceneLink` hotspot to move deeper into the experience

### Scene 3 - Collaboration and Communication

- Purpose: represent skills tied to teamwork, communication, and shared problem-solving.
- Suggested media/panorama: a team workspace, meeting area, or collaborative studio.
- Suggested hotspot behaviors:
- `info` hotspots highlighting roles, decisions, or discussion cues
- `externalLink` hotspot to a reference resource or example framework if needed
- `sceneLink` hotspot to continue the learning flow

### Scene 4 - Making and Iteration

- Purpose: demonstrate experimentation, building, prototyping, or iterative practice.
- Suggested media/panorama: a maker space, production area, or project table environment.
- Suggested hotspot behaviors:
- `info` hotspots showing iteration checkpoints
- `image` hotspot for before/after or process artifacts
- `sceneLink` hotspot onward to reflection or application

### Scene 5 - Application / Real-World Context

- Purpose: show how the pathway work connects to practical use, community context, or authentic outcomes.
- Suggested media/panorama: a workplace-like, community, or public-facing environment.
- Suggested hotspot behaviors:
- `info` hotspots connecting learning to real-world relevance
- `externalLink` hotspot to a supporting article, prompt, or related resource
- `sceneLink` hotspot to synthesis

### Scene 6 - Reflection / Synthesis

- Purpose: close the experience, connect the pathways back together, and support discussion after viewing.
- Suggested media/panorama: a calm summary setting such as a reflection room, gallery close-out, or presentation space.
- Suggested hotspot behaviors:
- `info` hotspots summarizing key takeaways
- optional `image` hotspot showing the full pathway map again
- optional `sceneLink` hotspot back to the orientation hub for replay or comparison

### Optional Scene 7 - "How We Built This" Author View

- Purpose: support the Q&A portion if time allows by showing how an authored scene can itself explain the making process.
- Suggested media/panorama: a simple production or design workspace.
- Suggested hotspot behaviors:
- `info` hotspots explaining scenes, hotspots, and guided flow
- `sceneLink` back to the main experience

## Hotspot Strategy

### `info`

Use `info` hotspots as the primary instructional layer. They should carry short, readable insight text, reflection prompts, or pathway explanations. They should not become dense paragraphs. In the flagship experience, `info` hotspots are the main way the educational framing becomes visible.

### `sceneLink`

Use `sceneLink` hotspots to maintain momentum and guide the learner through the experience. They should act as intentional transitions rather than arbitrary jumps. In the flagship example, every scene should have a clear next movement so the experience feels authored and not open-ended by accident.

### `externalLink`

Use `externalLink` hotspots sparingly. They should support the learning story, not interrupt it. One or two well-placed reference links are enough to show extensibility without sending students or stakeholders away from the core experience too often.

### `image`

Use `image` hotspots to surface supporting visuals such as pathway maps, process artifacts, annotated examples, or student-facing visual references. They are most useful when an image adds clarity that text alone would not provide.

## Student Experience Goals

Students should notice that the experience is organized and purposeful, not just exploratory. They should recognize that scenes and hotspots can represent different kinds of learning interactions, and that the seven pathways are being treated as a framework rather than a list of disconnected topics.

They should understand how an immersive activity can combine orientation, content, transitions, and reflection. Afterward, they should be able to discuss how scenes guide attention, how hotspot types serve different roles, and how they might structure a simple immersive learning experience of their own.

## Stakeholder / Case Study Goals

Target purchasing audiences and case-study readers should understand that the flagship experience demonstrates a credible instructional use case, not simply an XR proof of concept. The authored example should signal product value through clarity of flow, thoughtful use of media, and visible alignment to a skill-building framework.

The experience should communicate that the MVP can support:

- structured learning journeys
- lightweight authored media experiences
- guided student exploration
- a believable path toward broader institutional use

## Content Production Checklist

- Final decision on the skill-building pathway framing language used in the experience
- Scene-by-scene outline and sequence approval
- 6 to 8 panorama assets, optimized for pilot use
- Supporting images for pathway maps, artifacts, or example content
- Final hotspot titles and body text for each scene
- External link targets, if any, confirmed and stable
- Scene transition map showing how navigation works end to end
- Project metadata: title, description, organization/author label
- Presentation review pass for tone, readability, and stakeholder polish

## MVP Constraints

The pilot should intentionally keep several things simple.

- Limit the authored experience to one main flagship project.
- Keep the number of scenes bounded and curated.
- Prefer short, high-quality text over many hotspots.
- Use only the content types already supported well by the MVP.
- Treat publishing as a bounded static-hosting problem, not a full product feature.

The team should not attempt:

- complex branching logic that is hard to explain live
- large media libraries
- deep personalization or adaptive flows
- multi-user editing or hosted collaboration
- polished public distribution beyond a narrow pilot share path

## Recommended Production Sequence

1. Finalize the learning framing and decide exactly how the seven pathways will be represented in the hybrid structure.
2. Approve the scene list, scene order, and the role each scene plays in the beginning / middle / end flow.
3. Gather and optimize the panorama assets and supporting images.
4. Draft all hotspot titles, body copy, and transition labels before building in the editor.
5. Build the full scene structure in the XR Editor first, including scene names and navigation links.
6. Add `info` hotspots next so the instructional layer is in place early.
7. Add `image` and `externalLink` hotspots only where they materially improve understanding.
8. Review the experience in Presentation Mode and tighten pacing, readability, and hotspot density.
9. Conduct one internal walkthrough focused on student clarity and one walkthrough focused on stakeholder polish.
10. Freeze the flagship pilot build and prepare the lightweight publish/export package for the session.
