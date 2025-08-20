# Contributing and Developing Universal Video Hotkeys

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`

## Starting

### Firefox
1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file

### Chrome
1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer mode** (toggle in top-right corner)
3. **Click "Load unpacked"** and select the project folder

5. **Visit any website** with videos (YouTube, Vimeo, etc.)
6. **Test the shortcuts** - they should work immediately!

## Architecture Overview

### Core Components

- **`content.js`** - Main content script that sets up observers and handles video detection
- **`video.js`** - All video interaction functions (speed, seeking, volume, fullscreen, keyboard shortcuts)
- **`popup.js`** - Extension popup UI for settings

### Video Selection Logic

The `get_current_video()` function prioritizes:
1. **Playing videos** - Any video that's not paused/ended
2. **Visible videos** - In viewport, sorted by area (largest first)
3. **Fallback** - Any discovered video

### Design

#### Video Tracking

Keeps a Set of all video elements of the page, of all iframes and shadow doms, also nested. Keeps watching for new video elements/iframe/shadow recursively using MutationObservers. To keep the video elements set up to date, we need custom observer logic, that's why the manifest does *not* have the `all_frames` option active - it would result in unnecessary duplicate scanning and fails to work for global hotkeys on the root level. Maybe this could be solved with sophisticated message passing though (cross origin iframes?). Also some extra injections and hooks are in place (all in `content.js`) so there are refs even on closed shadow doms. Some hooks might be unnecessary or duplicate, but some might also not be reliable and `observe_root_recursively` prevents duplicate observations on the same element anyway. Also the extension runs at document_start so the `attachShadow` hook can be injected before any script from the webpage itself runs. Avoid `instanceof` checks: This is unreliable across iframes.

### Code aesthetics

Modern browser apis, ESM modules, no bundler, no minifier, highly opinionated linting rules, strict type checking with TypeScript's JSDoc (*no* `.ts` files).

For more guidelines when making a PR, see some of my other projects [here](https://github.com/phil294/GitLG/blob/master/CONTRIBUTING.md).

### Testing

- Test files in `/tests/` directory
- Covers various scenarios, but manually
- Start test server: `npm run test-serve`

## Making Changes

1. Everything above
1. Test in both Firefox and Chrome
1. Verify code style with `npm run dev`
