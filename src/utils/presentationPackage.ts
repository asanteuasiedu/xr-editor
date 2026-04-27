import type { Project } from '../types/project';
import { downloadTextFile, sanitizeFileBaseName } from './exportImport';

function getPackageBaseName(project: Project) {
  const base = sanitizeFileBaseName(project.name);
  return base || 'xr-presentation-package';
}

function createPresentationHtml(project: Project, jsonFileName: string) {
  const safeTitle = project.name || 'XR Presentation';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css" />
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7fb;
        --card: #ffffff;
        --border: #e6e8ef;
        --text: #1f2432;
        --muted: #6f7584;
        --accent: #7c6cff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top right, rgba(124, 108, 255, 0.12), transparent 24%),
          var(--bg);
      }
      .shell {
        min-height: 100vh;
        padding: 20px;
        display: grid;
        gap: 14px;
        grid-template-rows: auto auto 1fr;
      }
      .meta {
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(124, 108, 255, 0.18);
        border-radius: 18px;
        padding: 18px 20px;
        box-shadow: 0 12px 28px rgba(17, 22, 40, 0.08);
      }
      .kicker {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 800;
        color: #5a49de;
      }
      h1 {
        margin: 0;
        font-size: 1.7rem;
        line-height: 1.06;
      }
      .description {
        margin: 10px 0 0;
        color: var(--muted);
        max-width: 72ch;
        line-height: 1.55;
      }
      .scene-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 10px;
        color: var(--muted);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .hint {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 14px;
        background: #f5f2ff;
        border: 1px solid #d8d2ff;
        color: #4938be;
      }
      .hint p { margin: 0; font-size: 0.86rem; }
      .viewer-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: 0 16px 38px rgba(14, 20, 42, 0.14);
        padding: 12px;
        min-height: 420px;
      }
      .viewer {
        width: 100%;
        min-height: calc(100vh - 230px);
        border-radius: 14px;
        overflow: hidden;
      }
      .xr-marker {
        width: 14px;
        height: 14px;
        margin: 0;
        padding: 0;
        border: 2px solid #fff;
        border-radius: 999px;
        box-sizing: border-box;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(20, 30, 60, 0.35);
      }
      .xr-type-info { background: #3f5ea8; }
      .xr-type-sceneLink { background: #5a49de; border-color: #efe9ff; }
      .xr-type-externalLink { background: #b86821; border-color: #fff5e9; }
      .xr-type-image { background: #9d4df1; border-color: #f7edff; }
      .overlay {
        position: fixed;
        inset: 0;
        padding: 20px;
        background: rgba(18, 22, 40, 0.56);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 20;
      }
      .overlay.open { display: flex; }
      .modal {
        width: min(820px, 95vw);
        max-height: 86vh;
        overflow: auto;
        padding: 20px;
        background: var(--card);
        border-radius: 18px;
        border: 1px solid var(--border);
        box-shadow: 0 20px 48px rgba(12, 18, 34, 0.28);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }
      .modal-heading p {
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 800;
        color: #5a49de;
      }
      .modal-heading h2 {
        margin: 0;
        font-size: 1.16rem;
      }
      .modal-body {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.7;
        color: var(--text);
      }
      .modal img {
        display: block;
        max-width: 100%;
        max-height: 70vh;
        margin: 0 auto;
        border-radius: 14px;
        border: 1px solid var(--border);
      }
      .caption {
        margin: 12px 0 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .button {
        border: 1px solid var(--border);
        background: #f8f9ff;
        color: var(--text);
        border-radius: 999px;
        padding: 8px 14px;
        cursor: pointer;
        font-weight: 700;
      }
      .status {
        margin: 0;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(39, 31, 112, 0.92);
        color: #fff;
        display: none;
      }
      .status.open { display: block; }
      @media (max-width: 860px) {
        .shell { padding: 12px; }
        .hint { align-items: flex-start; flex-direction: column; }
        .viewer { min-height: calc(100vh - 280px); }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="meta">
        <p class="kicker">Presentation Package</p>
        <h1 id="project-title">Loading project...</h1>
        <div class="scene-meta">
          <span id="scene-name">Preparing scene</span>
          <span id="scene-count"></span>
        </div>
        <p class="description" id="project-description"></p>
      </section>
      <section class="hint" id="hint">
        <p>Tap hotspots to explore.</p>
        <button class="button" id="hide-hint" type="button">Hide</button>
      </section>
      <p class="status" id="status"></p>
      <section class="viewer-card">
        <div id="viewer" class="viewer" aria-label="Presentation viewer"></div>
      </section>
    </div>

    <div class="overlay" id="overlay">
      <div class="modal" id="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-heading">
            <p id="modal-kicker">Insight Zone</p>
            <h2 id="modal-title"></h2>
          </div>
          <button class="button" id="close-overlay" type="button">Close</button>
        </div>
        <div id="modal-content"></div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
    <script>
      const overlay = document.getElementById('overlay');
      const modal = document.getElementById('modal');
      const modalKicker = document.getElementById('modal-kicker');
      const modalTitle = document.getElementById('modal-title');
      const modalContent = document.getElementById('modal-content');
      const statusEl = document.getElementById('status');
      const viewerContainer = document.getElementById('viewer');
      let project = null;
      let viewer = null;
      let activeSceneId = null;
      let renderedHotspots = [];

      function showStatus(message) {
        statusEl.textContent = message;
        statusEl.classList.add('open');
      }

      function hideStatus() {
        statusEl.textContent = '';
        statusEl.classList.remove('open');
      }

      function openOverlay(kicker, title, contentHtml) {
        modalKicker.textContent = kicker;
        modalTitle.textContent = title;
        modalContent.innerHTML = contentHtml;
        overlay.classList.add('open');
      }

      function closeOverlay() {
        overlay.classList.remove('open');
        modalContent.innerHTML = '';
      }

      function getSceneById(sceneId) {
        return project.scenes.find((scene) => scene.id === sceneId) || project.scenes[0];
      }

      function updateMeta(scene) {
        document.getElementById('project-title').textContent = project.name || 'Untitled Project';
        document.getElementById('scene-name').textContent = scene.name || 'Untitled Scene';
        document.getElementById('scene-count').textContent = project.scenes.length + ' scene(s)';
        document.getElementById('project-description').textContent = project.projectObjective || project.description || '';
      }

      function normalizeExternalLink(rawUrl) {
        const trimmed = (rawUrl || '').trim();
        if (!trimmed) return null;
        const withProtocol = /^https?:\\/\\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
        try {
          const parsed = new URL(withProtocol);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
        } catch {
          return null;
        }
      }

      function handleHotspotClick(hotspot) {
        hideStatus();
        if (hotspot.type === 'sceneLink') {
          if (!hotspot.targetSceneId || hotspot.targetSceneId === activeSceneId) {
            showStatus('Destination scene is unavailable for this hotspot.');
            return;
          }
          renderScene(hotspot.targetSceneId);
          closeOverlay();
          return;
        }

        if (hotspot.type === 'externalLink') {
          const url = normalizeExternalLink(hotspot.url);
          if (!url) {
            showStatus('This external link is missing or invalid.');
            return;
          }
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }

        if (hotspot.type === 'image') {
          const src = (hotspot.imageUrl || '').trim();
          if (!src) {
            showStatus('This image hotspot is missing an image.');
            return;
          }
          const caption = hotspot.body ? '<p class="caption">' + hotspot.body.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' : '';
          openOverlay('Image Hotspot', hotspot.title || 'Image', '<img alt="" src="' + src + '" />' + caption);
          return;
        }

        openOverlay(
          'Insight Zone',
          hotspot.title || 'Info',
          '<p class="modal-body">' + (hotspot.body || 'No details provided.').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>'
        );
      }

      function syncHotspots(scene) {
        if (!viewer) return;

        renderedHotspots.forEach((hotspotId) => {
          try { viewer.removeHotSpot(hotspotId); } catch {}
        });
        renderedHotspots = [];

        scene.hotspots.forEach((hotspot) => {
          viewer.addHotSpot({
            id: hotspot.id,
            type: 'info',
            cssClass: 'xr-marker xr-type-' + hotspot.type,
            yaw: hotspot.yaw,
            pitch: hotspot.pitch,
            text: '',
            clickHandlerFunc: () => handleHotspotClick(hotspot)
          });
          renderedHotspots.push(hotspot.id);
        });
      }

      function buildViewerConfig(scene) {
        return {
          type: 'equirectangular',
          panorama: scene.panoramaUrl,
          autoLoad: true,
          showZoomCtrl: true,
          showFullscreenCtrl: false,
          hotSpots: []
        };
      }

      function renderScene(sceneId) {
        const scene = getSceneById(sceneId);
        activeSceneId = scene.id;
        updateMeta(scene);
        hideStatus();

        if (!viewer) {
          viewer = window.pannellum.viewer(viewerContainer, buildViewerConfig(scene));
          syncHotspots(scene);
          return;
        }

        viewer.destroy();
        viewer = window.pannellum.viewer(viewerContainer, buildViewerConfig(scene));
        syncHotspots(scene);
      }

      document.getElementById('close-overlay').addEventListener('click', closeOverlay);
      document.getElementById('hide-hint').addEventListener('click', () => {
        document.getElementById('hint').style.display = 'none';
      });
      overlay.addEventListener('click', closeOverlay);
      modal.addEventListener('click', (event) => event.stopPropagation());

      fetch('./${jsonFileName}')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Unable to load ${jsonFileName}');
          }
          return response.json();
        })
        .then((loadedProject) => {
          project = loadedProject;
          renderScene(project.activeSceneId || project.scenes[0].id);
        })
        .catch(() => {
          showStatus('Unable to load ${jsonFileName}. Make sure the exported HTML and JSON are hosted together.');
        });
    </script>
  </body>
</html>`;
}

function createPackageReadme(project: Project) {
  const projectName = project.name || 'XR Presentation';

  return `XR Editor Presentation Package
==============================

Project: ${projectName}

This pilot package contains:
- index.html
- project.json

How to use it locally:
- Put both files in the same folder.
- Serve that folder with a simple static server.
- Open index.html through that local server.

Examples:
- Python: python3 -m http.server
- Node: npx serve

How to host it:
- Upload both files to a static host such as GitHub Pages.
- Keep index.html and project.json in the same published directory.

What it does:
- Opens directly into a presentation-oriented viewer.
- Supports info, image, sceneLink, and externalLink hotspots.
- Hides editor controls.

Current limitations:
- This is a bounded pilot package for one curated project at a time.
- It is not a full publishing platform.
- Large embedded Data URL assets can make project.json very large.
- The exported viewer currently uses pannellum from a CDN, so internet access is expected unless you adapt the package further.
`;
}

export function exportPresentationPackage(project: Project) {
  const baseName = getPackageBaseName(project);
  const jsonFileName = `${baseName}-project.json`;
  downloadTextFile(`${baseName}-index.html`, createPresentationHtml(project, jsonFileName), 'text/html');
  downloadTextFile(jsonFileName, JSON.stringify(project, null, 2), 'application/json');
  downloadTextFile(`${baseName}-README.txt`, createPackageReadme(project), 'text/plain');
}
