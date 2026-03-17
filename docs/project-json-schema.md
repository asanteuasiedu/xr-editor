# XR Editor Project JSON Schema (MVP-Oriented)

This document defines the project file structure used for export/import. It is intentionally lightweight and beginner-readable.

## Overview
- Root object type: `Project`
- File format: UTF-8 JSON (`.json`)
- MVP minimum: 1 scene, 0+ hotspots
- Future-ready field: `sceneLinks` exists in data model even if not authored in MVP UI

## Data Models

### Project
| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | string | Yes | Version of file format, for example `"1.0.0"`. |
| `id` | string | Yes | Unique project identifier (UUID or similar). |
| `name` | string | Yes | Human-readable project name. |
| `description` | string | No | Optional project summary text. |
| `createdAt` | string (ISO 8601) | Yes | Project creation timestamp. |
| `updatedAt` | string (ISO 8601) | Yes | Last updated timestamp. |
| `activeSceneId` | string | No | Scene currently selected when exported. |
| `scenes` | Scene[] | Yes | List of scenes in the project. Must include at least one for useful MVP editing. |

### Scene
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique scene identifier. |
| `name` | string | Yes | Scene display name. |
| `image` | object | Yes | Panorama source metadata. |
| `image.src` | string | Yes | Local/relative/embedded source reference used by app. |
| `image.width` | number | No | Panorama width in pixels (if known). |
| `image.height` | number | No | Panorama height in pixels (if known). |
| `initialView` | object | No | Default camera orientation for scene open. |
| `initialView.yaw` | number | No | Horizontal angle in degrees. |
| `initialView.pitch` | number | No | Vertical angle in degrees. |
| `initialView.fov` | number | No | Field of view in degrees. |
| `hotspots` | Hotspot[] | Yes | Insight Zones attached to this scene. Can be empty. |
| `sceneLinks` | SceneLink[] | Yes | Scene transitions. Keep as empty array in MVP if unused. |

### Hotspot
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique hotspot identifier. |
| `type` | string | Yes | Must be `"info"` in MVP. |
| `title` | string | Yes | Short label shown in UI. |
| `description` | string | Yes | Main informational text content. |
| `position` | object | Yes | Placement in spherical coordinates. |
| `position.yaw` | number | Yes | Horizontal position in degrees (commonly -180 to 180). |
| `position.pitch` | number | Yes | Vertical position in degrees (commonly -90 to 90). |
| `icon` | string | No | Optional marker icon token/name. |
| `createdAt` | string (ISO 8601) | No | Creation timestamp for ordering/auditing. |
| `updatedAt` | string (ISO 8601) | No | Last edit timestamp. |

### SceneLink
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique link identifier. |
| `fromSceneId` | string | Yes | Source scene ID. |
| `toSceneId` | string | Yes | Destination scene ID. |
| `label` | string | No | Optional UI label for navigation marker. |
| `position` | object | Yes | Placement within the source scene. |
| `position.yaw` | number | Yes | Horizontal position in source scene. |
| `position.pitch` | number | Yes | Vertical position in source scene. |

## Validation Rules (MVP)
- `schemaVersion`, `id`, `name`, `createdAt`, `updatedAt`, and `scenes` are required at project root.
- `scenes` must be an array of `Scene` objects.
- Every scene must have required fields: `id`, `name`, `image.src`, `hotspots`, `sceneLinks`.
- In MVP, every hotspot `type` should be `"info"`.
- IDs should be unique within their object type collections.

## Complete Example `project.json` (MVP)
```json
{
  "schemaVersion": "1.0.0",
  "id": "proj-9df8d3fb-2d6a-4f17-9f2f-c620ee3e6f11",
  "name": "Museum Lobby Tour",
  "description": "Single-scene MVP example with two insight zones.",
  "createdAt": "2026-03-06T14:00:00Z",
  "updatedAt": "2026-03-06T14:15:00Z",
  "activeSceneId": "scene-lobby-001",
  "scenes": [
    {
      "id": "scene-lobby-001",
      "name": "Main Lobby",
      "image": {
        "src": "assets/lobby-360.jpg",
        "width": 8192,
        "height": 4096
      },
      "initialView": {
        "yaw": 0,
        "pitch": 0,
        "fov": 75
      },
      "hotspots": [
        {
          "id": "hotspot-h1",
          "type": "info",
          "title": "Welcome Desk",
          "description": "Guests check in here before the guided experience.",
          "position": {
            "yaw": -25.5,
            "pitch": -4.2
          },
          "icon": "info",
          "createdAt": "2026-03-06T14:05:00Z",
          "updatedAt": "2026-03-06T14:05:00Z"
        },
        {
          "id": "hotspot-h2",
          "type": "info",
          "title": "Ceiling Installation",
          "description": "This suspended artwork was installed in 2024.",
          "position": {
            "yaw": 62.1,
            "pitch": 18.8
          },
          "icon": "star",
          "createdAt": "2026-03-06T14:10:00Z",
          "updatedAt": "2026-03-06T14:12:00Z"
        }
      ],
      "sceneLinks": []
    }
  ]
}
```
