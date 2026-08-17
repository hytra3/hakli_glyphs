# 📜 Hakli Glyph Recognizer

**Computer vision tool for documenting ancient Dhofari script inscriptions**

![Version](https://img.shields.io/badge/Version-v260218-blue)
![Status](https://img.shields.io/badge/Status-Production-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
![PWA](https://img.shields.io/badge/PWA-Enabled-purple)

---

## 🎯 Overview

The Hakli Glyph Recognizer is a browser-based tool for field documentation of ancient South Arabian inscriptions found in Dhofar, Oman. It uses computer vision (OpenCV.js) to detect and identify glyphs in inscription photographs, with full offline capability, Google Drive collaboration, and PDF booklet export for community review.

Built on the decipherment work of Ahmad Al-Jallad. Developed during active fieldwork with Hakli-speaking communities in Salalah, Dhofar.

**Live app:** [hudhud.dev](https://hudhud.dev)  
**Repository:** [github.com/hytra3/hakli_glyph_recognizer](https://github.com/hytra3/hakli_glyph_recognizer)

---

## ✅ Features

### Computer Vision
- Template matching via OpenCV.js (multi-scale, rotation-aware)
- Glyph isolation and segmentation
- Non-maximum suppression for duplicate removal
- Image preprocessing pipeline (contrast, threshold, denoise)
- Template learning from validated corrections

### Inscription Management
- `.hki` file format — complete inscription packages with metadata
- Sequential inscription IDs (e.g. `DH-2026-001`)
- Version history and change tracking
- Local autosave with IndexedDB
- Undo/redo support

### Collaboration (Google Drive)
- Sign in with Google to sync `.hki` files to a shared Drive folder
- Access control — owner/collaborator/public read roles
- Change tracking with attribution (`addedBy`, `addedAt`)
- Cloud chart sync — shared glyph chart for team training
- Warehouse: browse and load community inscriptions

### Export
- PDF booklets for tribal elder review
- HTML reports
- JSON detection data
- Annotated PNG images
- Plain text transcriptions

### PWA / Offline
- Installable as a Progressive Web App
- Service worker caches core assets and OpenCV.js
- Full offline capability after first load
- Works in remote field locations without connectivity

---

## 📁 File Structure

```
hakli_glyph_recognizer/
├── index.html                  # Main app (React, ~7200 lines)
├── sw.js                       # Service worker (offline/PWA)
├── manifest.json               # PWA manifest
├── chart-hakli.json            # Glyph chart (auto-loads)
├── favicon.png / hh-logo.png
│
├── src/
│   ├── core/
│   │   └── config.js           # App constants & settings
│   │
│   ├── utils/
│   │   └── helpers.js          # Shared utility functions
│   │
│   ├── storage/
│   │   ├── hki.js              # .hki file format & versioning
│   │   ├── cache.js            # localStorage management
│   │   ├── corrections.js      # Correction learning & memory
│   │   ├── change-tracker.js   # Attribution & audit trail
│   │   ├── drive-sync.js       # Google Drive integration
│   │   ├── access-control.js   # Owner/collaborator/public roles
│   │   ├── sync-manager.js     # Battery-efficient sync coordination
│   │   └── local-autosave.js   # IndexedDB autosave
│   │
│   ├── recognition/
│   │   ├── preprocessing.js    # Image enhancement pipeline
│   │   ├── isolation.js        # Glyph detection & segmentation
│   │   ├── matching.js         # Multi-scale template matching
│   │   ├── nms.js              # Duplicate removal & filtering
│   │   ├── validation.js       # Result validation
│   │   └── template-learning.js # Learn from user corrections
│   │
│   ├── reading/
│   │   ├── reading.js          # Reading order management
│   │   └── transcription.js    # Transcription generation
│   │
│   └── components/
│       ├── common/
│       │   ├── CommonComponents.jsx    # Shared UI elements
│       │   ├── DetectionCard.jsx       # Individual glyph card
│       │   └── AccessControlUI.jsx     # Permission controls
│       ├── panels/
│       │   ├── InscriptionPanel.jsx    # Main inscription view
│       │   └── ExportPanel.jsx         # Export options
│       └── modals/
│           ├── WarehouseModal.jsx      # Community inscription browser
│           ├── CollaboratorManager.jsx # Team access management
│           └── BookletGenerator.jsx    # PDF booklet creation
│
├── primary/                    # Primary glyph template images
├── variant/                    # Variant template images
└── examples/                   # Sample inscription photos
```

---

## 🚀 Quick Start

### Use the live app
Visit [hudhud.dev](https://hudhud.dev) — no installation needed. Sign in with Google to enable Drive sync and collaboration.

### Run locally
```bash
git clone https://github.com/hytra3/hakli_glyph_recognizer.git
cd hakli_glyph_recognizer
python3 -m http.server 8000
# Open http://localhost:8000
```

> Note: Must be served over HTTP/HTTPS — opening `index.html` directly as a file will not work due to module loading.

---

## 🔬 Basic Workflow

1. **Load image** — upload a photo of a stone inscription
2. **Preprocess** — adjust contrast, threshold, and denoise settings
3. **Detect** — run auto-detection or draw manual bounding boxes
4. **Validate** — confirm or correct each glyph identification
5. **Transcribe** — set reading order and generate transcription
6. **Save** — autosaved locally; sync to Drive when signed in
7. **Export** — PDF booklet, HTML report, or raw data

---

## ☁️ Google Drive Setup

Sign in with your Google account to:
- Sync `.hki` inscription files to the shared `Hakli_Inscriptions` folder
- Access inscriptions shared by collaborators
- Contribute to the shared glyph chart (training mode)

> **Note:** The app requests full Drive access in order to support collaboration across team members' files. The app only accesses files in the designated `Hakli_Inscriptions` folder.

---

## 📊 Tech Stack

- **React 18** — UI framework (in-browser Babel transpilation)
- **OpenCV.js 4.5** — Computer vision
- **Tailwind CSS** — Styling
- **jsPDF** — PDF booklet generation
- **Google Identity Services** — OAuth 2.0
- **Google Drive API v3** — Cloud storage
- **IndexedDB** — Local autosave
- **Service Worker** — Offline/PWA support

---

## 🎓 For Researchers

This tool is designed for linguistic and epigraphic fieldwork:
- **Offline-first** — works in remote areas without connectivity
- **Non-destructive** — original images never modified
- **Attributable** — all changes tracked with user and timestamp
- **Portable** — `.hki` files are self-contained and shareable
- **Printable** — booklet export suitable for community consultation

---

## 🏆 Credits

**Author:** marty heaton (© hudhud holdings)  
**Purpose:** Documenting endangered Dhofari script  
**Language:** Hakli (Modern South Arabian, Semitic)  
**Location:** Dhofar, Oman  
**Fieldwork:** Salalah, January–March 2026

Based on Al-Jallad's decipherment of ancient Dhofari script.

---

## 📄 License

MIT License — see LICENSE file for details.

---

**Last Updated:** February 2026 | **Version:** v260218
