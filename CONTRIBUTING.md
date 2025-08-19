# Contributing to Universal Video Hotkeys

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`

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

Keeps a Set of all video elements of the page, of all iframes and shadow doms, also nested. Keeps watching for new video elements/iframe/shadow recursively using MutationObservers. To keep the video elements set up to date, we need custom observer logic, that's why the manifest does *not* have the `all_frames` option active - it would result in unnecessary duplicate scanning.

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
