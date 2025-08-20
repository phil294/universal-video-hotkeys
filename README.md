# Universal YouTube-style Video Hotkeys

A browser extension that brings YouTube-style keyboard shortcuts to all video players across the web. Also enables double click-to-fullscreen.

This is the only browser extension of its kind that actually works *everywhere* because it recursively observes iframes and shadow doms.

## Install

- Firefox: https://addons.mozilla.org/en-US/firefox/addon/universal-video-hotkeys/
- Chrome: tbd

## Features

- **Smart video detection**: Automatically targets the most relevant video in viewport
- **Universal shortcuts**: Works on any website with HTML5 videos, including iframes and deeply nested shadow doms
- **YouTube-compatible hotkeys**: Uses the same shortcuts you're already familiar with. Not configurable.
- **Double-click fullscreen**: Click video twice to toggle fullscreen mode
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

## Configuration

- Click the extension icon in your browser toolbar to:
  - Toggle the extension on/off
  - View all available keyboard shortcuts

## Building, Development and Contributing

See [./CONTRIBUTING.md](./CONTRIBUTING.md)

## Limitations

- Only works with standard HTML5 video elements
- Some sites with heavily customized players (Netflix, etc.) may have limited compatibility
- Shortcuts are disabled when typing in input fields
- While optimized for performance, it adds a small overhead

## Extension Permissions

- `activeTab` - Access current tab for video detection
- `storage` - Save user settings (enabled/disabled)
- No host permissions needed - works on any site with videos


## License

AGPL
