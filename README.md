# Universal YouTube-style Video Hotkeys

A browser extension that brings YouTube-style keyboard shortcuts to all video players across the web. Also enables double click-to-fullscreen, and removes custom video controls.

This is the only browser extension of its kind that actually works, and it works *everywhere*.

Also disables all custom video controls (can be toggled).

## Features

- **Smart video detection**: Automatically targets the most relevant video in viewport
- **Universal shortcuts**: Works on any website with HTML5 videos, including iframes and deeply nested shadow doms
- **YouTube-compatible hotkeys**: Uses the same shortcuts you're already familiar with. Not configurable.
- **Double-click fullscreen**: Click video twice to toggle fullscreen mode
- **Native controls**: Overrides custom video controls to show browser's native controls
- **Sound enhancement**: Optional setting to always unmute and maximize volume on video change
- **Lightweight**: Pure JavaScript, no dependencies, no bundling

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/pause video |
| `←` / `→` | Seek backward/forward 5 seconds |
| `↑` / `↓` | Volume up/down 5% (when video focused or fullscreen) |
| `Home` / `End` | Jump to start/end of video |
| `0`-`9` | Jump to 0%-90% of video duration |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Shift + >` | Increase speed by 25% (max 3.00x) |
| `Shift + <` | Decrease speed by 25% (min 0.25x) |
| Double-click video | Toggle fullscreen |

## Installation & Development

### Local Testing

1. **Clone/download** this repository
2. **Install dependencies**: `npm install`
3. **Run linting & type checking**: `npm run dev`

#### Firefox
1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file

#### Chrome
1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer mode** (toggle in top-right corner)
3. **Click "Load unpacked"** and select the project folder

5. **Visit any website** with videos (YouTube, Vimeo, etc.)
6. **Test the shortcuts** - they should work immediately!

### Configuration

- Click the extension icon in your browser toolbar to:
  - Toggle the extension on/off
  - Enable "Always enable sound" (unmutes and maximizes volume on video change)
  - View all available keyboard shortcuts

## Code Quality

- **Neostandard**: Modern ESLint config with tabs and minimal braces
- **TypeScript**: Full type checking via JSDoc comments
- **Zero dependencies**: Pure vanilla JavaScript
- **Modern ES2022**: Uses latest JavaScript features where supported

## Development

```bash
# Install dependencies
npm install

# Lint the code (also maybe install an ESLint IDE plugin)
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run TypeScript type checking
npm run type-check

# Run both linting and type checking
npm run dev
```

No build step required - just reload the extension in browser after changes.

## How It Works

The extension:
1. Injects a content script on every page
2. Continuously monitors for HTML5 `<video>` elements
3. Prioritizes currently playing videos, then largest video in viewport
4. Intercepts keyboard events and translates them to video API calls
5. Respects input fields and doesn't interfere with typing

## Limitations

- Only works with standard HTML5 video elements
- Some sites with heavily customized players (Netflix, etc.) may have limited compatibility
- Shortcuts are disabled when typing in input fields

## License

MIT

## AI

This project was built in large parts by an LLM (Copilot / Sonnet 4).