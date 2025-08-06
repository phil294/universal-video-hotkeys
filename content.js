/** @fileoverview Universal Video Hotkeys - Content Script @author GitHub Copilot */

/** @typedef {Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; }} ExtendedDocument */
/** @typedef {HTMLVideoElement & { webkitRequestFullscreen?: () => void; }} ExtendedVideoElement */
/** @typedef {EventTarget & { tagName?: string; isContentEditable?: boolean; }} ExtendedEventTarget */
/** @typedef {Object} VideoState @property {HTMLVideoElement} element @property {number} last_interaction */

/** @type {VideoState | null} */
let current_video = null
/** @type {boolean} */
let extension_enabled = true
/** @type {boolean} */
let always_enable_sound = false
/** @type {MutationObserver | null} */
let video_observer = null
/** @type {HTMLDivElement | null} */
let speed_indicator = null

/** Log function with prefix @param {...any} args */
let log = (...args) => console.log('[VideoHotkeys]', ...args)

/** Create and show speed indicator overlay @param {number} speed */
let show_speed_indicator = speed => {
	if (!current_video) return

	// Remove existing indicator
	if (speed_indicator) speed_indicator.remove()

	// Create new indicator
	speed_indicator = document.createElement('div')
	speed_indicator.textContent = `${speed.toFixed(2)}x`
	speed_indicator.style.cssText = `
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 8px 16px;
		border-radius: 4px;
		font-family: Arial, sans-serif;
		font-size: 18px;
		font-weight: bold;
		z-index: 999999;
		pointer-events: none;
		user-select: none;
	`

	document.body.appendChild(speed_indicator)

	// Auto-remove after 1 second
	setTimeout(() => {
		if (speed_indicator) {
			speed_indicator.remove()
			speed_indicator = null
		}
	}, 1000)
}

/** Recursively find all video elements including shadow DOM and iframes @param {Document | DocumentFragment | ShadowRoot} root @returns {HTMLVideoElement[]} */
let find_all_videos = root => {
	let start_time = performance.now()
	/** @type {HTMLVideoElement[]} */
	let videos = []

	try {
		// Find direct video elements
		videos.push(...Array.from(root.querySelectorAll('video')))

		// Search shadow DOMs
		let elements_with_shadow = root.querySelectorAll('*')
		for (let element of elements_with_shadow) if (element.shadowRoot) try {
			videos.push(...find_all_videos(element.shadowRoot))
		} catch (/** @type {any} */ e) {
			log('Shadow DOM search error:', String(e.message || e))
		}

		// Search iframes (same-origin only, others will throw security errors)
		let iframes = root.querySelectorAll('iframe')
		for (let iframe of iframes) try {
			if (iframe.contentDocument) videos.push(...find_all_videos(iframe.contentDocument))
		} catch (/** @type {any} */ e) {
			log('Iframe search error (likely cross-origin):', iframe.src || 'about:blank', String(e.message || e))
		}

		// Search object/embed elements (Flash, legacy video)
		try {
			let objects = root.querySelectorAll('object[type*="video"], object[data*=".mp4"], object[data*=".webm"], embed[type*="video"]')
			for (let obj of objects) {
				// Check if object contains video element
				let html_obj = /** @type {HTMLObjectElement} */ (obj)
				try {
					if (html_obj.contentDocument) {
						let object_videos = html_obj.contentDocument.querySelectorAll('video')
						videos.push(...Array.from(object_videos))
					}
				} catch (/** @type {any} */ e) {
					log('Object/embed content access error:', String(e.message || e))
				}
			}
		} catch (/** @type {any} */ e) {
			log('Object/embed search error:', String(e.message || e))
		}
	} catch (/** @type {any} */ e) {
		log('Critical video search error:', String(e.message || e), String(e.stack || ''))
	}

	let search_time = performance.now() - start_time
	if (search_time > 50) log(`Video search took ${search_time.toFixed(1)}ms (found ${videos.length} videos)`)

	return videos
}

/** Get the most relevant video element @returns {HTMLVideoElement | null} */
let get_current_video = () => {
	let videos = find_all_videos(document)
	if (!videos.length) return null

	// Priority 1: Currently playing video
	let playing = videos.find(v => !v.paused && !v.ended)
	if (playing) return playing

	// Priority 2: Video in viewport with largest area
	let in_viewport = videos
		.filter(v => {
			let rect = v.getBoundingClientRect()
			return rect.top < window.innerHeight &&
				rect.bottom > 0 &&
				rect.left < window.innerWidth &&
				rect.right > 0 &&
				rect.width > 0 &&
				rect.height > 0
		})
		.sort((a, b) => {
			let area_a = a.offsetWidth * a.offsetHeight
			let area_b = b.offsetWidth * b.offsetHeight
			return area_b - area_a
		})

	return in_viewport[0] ?? videos[0] ?? null
}

/** Update current video reference */
let update_current_video = () => {
	let video = get_current_video()
	if (video && video !== current_video?.element) {
		log('Active video changed:', video.src || video.currentSrc || 'unknown source')
		current_video = { element: video, last_interaction: Date.now() }

		// Apply sound settings if enabled
		if (always_enable_sound) {
			video.muted = false
			video.volume = 1.0
			log('Force sound: unmuted and volume set to 100%')
		}

		// Add double-click listener for fullscreen
		setup_double_click_fullscreen(video)
	}
}

/** Setup double-click fullscreen for video @param {HTMLVideoElement} video */
let setup_double_click_fullscreen = video => {
	// Remove existing listener to avoid duplicates
	video.removeEventListener('dblclick', handle_double_click)
	video.addEventListener('dblclick', handle_double_click)
}

/** Handle double-click on video for fullscreen @param {Event} event */
let handle_double_click = event => {
	event.preventDefault()
	event.stopPropagation()
	toggle_fullscreen()
	log('Double-click fullscreen triggered')
}

/** Change volume by percentage @param {number} delta - Volume change (-100 to 100) */
let change_volume = delta => {
	if (!current_video) return
	let video = current_video.element
	let old_volume = video.volume
	let new_volume = Math.max(0, Math.min(1, video.volume + (delta / 100)))
	video.volume = new_volume
	video.muted = false // Unmute when changing volume
	log(`Volume change: ${(old_volume * 100).toFixed(0)}% → ${(new_volume * 100).toFixed(0)}%`)
}

/** Seek video by seconds @param {number} seconds */
let seek_video = seconds => {
	if (!current_video) return
	let video = current_video.element
	let old_time = video.currentTime
	video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
	log(`Seek ${seconds > 0 ? '+' : ''}${seconds}s: ${old_time.toFixed(1)}s → ${video.currentTime.toFixed(1)}s`)
}

/** Jump to percentage of video @param {number} percentage - 0 to 100 */
let jump_to_percentage = percentage => {
	if (!current_video) return
	let video = current_video.element
	if (video.duration) {
		let new_time = (percentage / 100) * video.duration
		video.currentTime = new_time
		log(`Jump to ${percentage}%: ${new_time.toFixed(1)}s`)
	}
}

/** Change playback speed in fixed 25% steps @param {number} direction - 1 for faster, -1 for slower */
let change_speed = direction => {
	if (!current_video) return
	let video = current_video.element
	let current_rate = video.playbackRate
	let new_rate = direction > 0
		? Math.min(3.0, current_rate + 0.25)
		: Math.max(0.25, current_rate - 0.25)
	video.playbackRate = new_rate
	log(`Speed change: ${current_rate.toFixed(2)}x → ${new_rate.toFixed(2)}x`)

	// Show speed indicator overlay
	show_speed_indicator(new_rate)
}

/** Toggle play/pause */
let toggle_play_pause = () => {
	if (!current_video) return
	let video = current_video.element
	if (video.paused) {
		video.play()
		log('Play')
	} else {
		video.pause()
		log('Pause')
		// The current one may be way out of viewport by now
		update_current_video()
	}
}

/** Toggle fullscreen */
let toggle_fullscreen = () => {
	if (!current_video) return
	let video = /** @type {ExtendedVideoElement} */ (current_video.element)
	let extended_document = /** @type {ExtendedDocument} */ (document)

	if (document.fullscreenElement || extended_document.webkitFullscreenElement) {
		if (document.exitFullscreen) document.exitFullscreen()
		else if (extended_document.webkitExitFullscreen) extended_document.webkitExitFullscreen()
		log('Exit fullscreen')
	} else {
		if (video.requestFullscreen) video.requestFullscreen()
		else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen()
		log('Enter fullscreen')
	}
}

/** Check if event target is an input element @param {Event} event @returns {boolean} */
let is_input_target = event => {
	let target = /** @type {ExtendedEventTarget | null} */ (event.target)
	if (!target) return false

	let tag_name = target.tagName
	if (tag_name && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag_name)) return true

	return Boolean(target.isContentEditable)
}

/** Handle video navigation shortcuts @param {KeyboardEvent} event @param {HTMLVideoElement} video @returns {boolean} - Whether the event was handled */
let handle_video_shortcuts = (event, video) => {
	switch (event.code) {
		case 'Space':
			toggle_play_pause()
			return true
		case 'ArrowLeft':
			seek_video(-5)
			return true
		case 'ArrowRight':
			seek_video(5)
			return true
		case 'ArrowUp':
			// Volume up only if video has focus or is fullscreen
			if (document.activeElement === video || document.fullscreenElement === video ||
			/** @type {ExtendedDocument} */ (document).webkitFullscreenElement === video) {
				change_volume(5)
				return true
			}
			break
		case 'ArrowDown':
			// Volume down only if video has focus or is fullscreen
			if (document.activeElement === video || document.fullscreenElement === video ||
			/** @type {ExtendedDocument} */ (document).webkitFullscreenElement === video) {
				change_volume(-5)
				return true
			}
			break
		case 'Home':
			jump_to_percentage(0)
			return true
		case 'End':
			jump_to_percentage(100)
			return true
		case 'KeyF':
			toggle_fullscreen()
			return true
		case 'KeyM':
			video.muted = !video.muted
			log('Mute toggled:', video.muted ? 'muted' : 'unmuted')
			return true
		case 'Period':
			if (event.shiftKey) {
				change_speed(1)
				return true
			}
			break
		case 'Comma':
			if (event.shiftKey) {
				change_speed(-1)
				return true
			}
			break
		case 'Digit0': case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
		case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
			let digit = parseInt(event.code.slice(-1), 10)
			jump_to_percentage(digit * 10)
			return true
		}
	}
	return false
}

/** Handle keyboard events @param {KeyboardEvent} event */
let handle_keydown = event => {
	if (!extension_enabled || !current_video) return

	// Don't interfere with input fields
	if (is_input_target(event)) return

	let video = current_video.element
	let handled = handle_video_shortcuts(event, video)

	if (handled) {
		event.preventDefault()
		event.stopPropagation()
		current_video.last_interaction = Date.now()
	}
}

/** Setup video observer using modern MutationObserver */
let setup_video_observer = () => {
	if (video_observer) video_observer.disconnect()

	video_observer = new MutationObserver(mutations => {
		let should_update = false
		try {
			for (let mutation of mutations) {
				// Check for new elements that might contain videos
				if (mutation.type === 'childList') for (let node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) {
					let element = /** @type {Element} */ (node)
					// Check if it's a video, contains videos, has shadow DOM, is an iframe, object, or embed
					if (
						element.tagName === 'VIDEO' ||
						element.querySelector('video') ||
						element.shadowRoot ||
						element.tagName === 'IFRAME' ||
						element.tagName === 'OBJECT' ||
						element.tagName === 'EMBED'
					) {
						should_update = true
						break
					}
				}
				if (should_update) break
			}
		} catch (/** @type {any} */ e) {
			log('MutationObserver error:', String(e.message || e))
			should_update = true // Update anyway in case of errors
		}
		if (should_update) update_current_video()
	})

	try {
		video_observer.observe(document.body, {
			childList: true,
			subtree: true
		})
		log('Aggressive video observer initialized')
	} catch (/** @type {any} */ e) {
		log('MutationObserver setup error:', String(e.message || e))
	}
}

/** Initialize iframe content scripts for same-origin iframes */
let setup_iframe_observers = () => {
	let start_time = performance.now()
	let iframes = document.querySelectorAll('iframe')
	let success_count = 0

	for (let iframe of iframes) try {
		if (iframe.contentDocument && iframe.contentWindow) {
			// Add keyboard listener to iframe
			iframe.contentDocument.addEventListener('keydown', handle_keydown, true)
			success_count++
			log('Added keyboard listener to iframe:', iframe.src || 'about:blank')
		}
	} catch (/** @type {any} */ e) {
		log('Iframe setup error (likely cross-origin):', iframe.src || 'about:blank', String(e.message || e))
	}

	let setup_time = performance.now() - start_time
	if (setup_time > 10 || success_count > 0) log(`Iframe setup took ${setup_time.toFixed(1)}ms (${success_count}/${iframes.length} iframes accessible)`)
}

/** Initialize extension */
let init = () => {
	log('Initializing aggressive video detection (shadow DOM + iframes)')

	// Load settings
	chrome.storage.sync.get(['enabled', 'always_enable_sound'], result => {
		if (chrome.runtime.lastError) {
			log('Storage error:', chrome.runtime.lastError)
			extension_enabled = true // Default to enabled on error
			always_enable_sound = false
		} else {
			extension_enabled = result && result['enabled'] !== false
			always_enable_sound = result && result['always_enable_sound'] === true
		}
		log('Extension enabled:', extension_enabled)
		log('Always enable sound:', always_enable_sound)
	})

	// Setup modern video detection with shadow DOM and iframe support
	setup_video_observer()
	setup_iframe_observers()
	update_current_video()

	// Listen for keyboard events
	document.addEventListener('keydown', handle_keydown, true)

	// Listen for storage changes
	chrome.storage.onChanged.addListener(changes => {
		if (changes['enabled']) {
			extension_enabled = changes['enabled'].newValue
			log('Extension toggled:', extension_enabled ? 'enabled' : 'disabled')
		}
		if (changes['always_enable_sound']) {
			always_enable_sound = changes['always_enable_sound'].newValue
			log('Always enable sound toggled:', always_enable_sound ? 'enabled' : 'disabled')
		}
	})
}

// Start when DOM is ready
if (document.readyState === 'complete') init()
else window.addEventListener('load', init)
