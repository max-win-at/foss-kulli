# Foss Kulli

A simple, fast, and beautiful sticky notes Progressive Web App (PWA) for capturing your thoughts.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![PWA Ready](https://img.shields.io/badge/PWA-ready-brightgreen.svg)

## What It Does

Foss Kulli is a minimalist sticky notes application that runs entirely in your browser. Just start typing or paste from your clipboard to instantly create colorful sticky notes on a virtual whiteboard.

### Key Features

- **Instant Note Creation** - Start typing anywhere to create a note immediately
- **Clipboard Support** - Paste text directly to create notes
- **Search** - Quickly find notes with real-time search filtering
- **Offline Support** - Works without an internet connection (PWA)
- **Installable** - Add to home screen on mobile or desktop
- **Privacy-Focused** - All data stays in your browser's local storage
- **No Account Required** - No sign-up, no cloud sync, no tracking

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Alpine.js** | Reactive UI framework (lightweight alternative to Vue/React) |
| **Tailwind CSS** | Utility-first CSS framework (via CDN) |
| **Vanilla JavaScript** | Core application logic with ES6+ classes |
| **Local Storage API** | Persistent note storage in the browser |
| **Service Worker** | Offline caching and PWA functionality |
| **Web App Manifest** | PWA metadata for installation |

## Architecture

The application follows an **MVVM (Model-View-ViewModel)** pattern with dependency injection:

```
├── index.html              # Single page entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline support
├── css/
│   └── styles.css          # Custom styles + CSS variables
├── js/
│   ├── app.js              # Entry point & IoC container
│   ├── pwa-register.js     # PWA service worker registration
│   ├── services/
│   │   └── srv-local-storage.js   # Persistence layer
│   └── viewmodels/
│       ├── vm-dom.js              # Screen size & layout state
│       ├── vm-sticky-note.js      # Note model/entity
│       └── vm-white-board.js      # Main board logic & state
├── icons/                  # PWA icons (SVG sources + generated PNGs)
└── docs/
    └── PWA-DEPLOYMENT.md   # Deployment guide for web & app stores
```

### Component Overview

- **app.js** - Bootstraps the application, creates service instances, and registers Alpine.js components
- **VmWhiteBoard** - Main viewmodel managing notes array, editing state, search, and keyboard/paste handlers
- **VmStickyNote** - Individual note entity with id, text, position (x, y), and timestamp
- **VmDom** - Reactive viewport dimensions for responsive layout calculations
- **SrvLocalStorage** - Abstraction over localStorage for saving/loading notes

### Data Flow

```
User Input → Alpine.js Directives → VmWhiteBoard → SrvLocalStorage → localStorage
                                         ↓
                                   VmStickyNote[]
                                         ↓
                              Alpine.js Reactivity → DOM Update
```

## Getting Started

### Run Locally

Simply serve the files with any static web server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

### Generate PWA Icons

Before deploying, generate PNG icons from SVG sources:

```bash
# Requires ImageMagick
chmod +x generate-icons.sh
./generate-icons.sh
```

## Deployment

The app can be deployed to:

- **Web**: Any static hosting (GitHub Pages, Netlify, Vercel, etc.)
- **Android**: Google Play Store via TWA/PWABuilder
- **iOS**: App Store via PWABuilder or WebView wrapper
- **Windows**: Microsoft Store via MSIX package

See [docs/PWA-DEPLOYMENT.md](docs/PWA-DEPLOYMENT.md) for detailed instructions.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Mobile browsers with PWA support

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with 💛 for quick note-taking
