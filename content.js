/** @typedef {Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; }} ExtendedDocument */

/** @typedef {HTMLVideoElement & { webkitRequestFullscreen?: () => void; }} ExtendedVideoElement */

/** @typedef {EventTarget & { tagName?: string; isContentEditable?: boolean; }} ExtendedEventTarget */

/** @typedef {Object} VideoState @property {HTMLVideoElement} element @property {number} last_interaction */

/** @type {VideoState | null} */
let current_video = null

/** @type {boolean} */
let extension_enabled = true

/** Get the most relevant video element @returns {HTMLVideoElement | null} */
let get_current_video = () => {
	/** @type {NodeListOf<HTMLVideoElement>} */
	let videos = document.querySelectorAll('video')
	if (!videos.length) return null

	// Priority 1: Currently playing video
	let playing = Array.from(videos).find(v => !v.paused && !v.ended)
	if (playing) return playing

	// Priority 2: Video in viewport with largest area
	let in_viewport = Array.from(videos)
		.filter(v => {
			let rect = v.getBoundingClientRect()
			return rect.top < window.innerHeight &&
				rect.bottom > 0 &&
				rect.left < window.innerWidth &&
				rect.right > 0
		})
		.sort((a, b) => {
			let area_a = a.offsetWidth * a.offsetHeight
			let area_b = b.offsetWidth * b.offsetHeight
			return area_b - area_a
		})

	return in_viewport[0] ?? videos[0] ?? null
}

/**
 * Update current video reference
 */
let update_current_video = () => {
	let video = get_current_video()
	if (video && video !== current_video?.element) current_video = {
		element: video,
		last_interaction: Date.now()
	}
}

/**
 * Seek video by seconds
 * @param {number} seconds
 */
let seek_video = seconds => {
	if (!current_video) return
	let video = current_video.element
	video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
}

/**
 * Jump to percentage of video
+ * @param {number} percentage - 0 to 100
 */
let jump_to_percentage = percentage => {
	if (!current_video) return
	let video = current_video.element
	if (video.duration) video.currentTime = (percentage / 100) * video.duration
}

/**
 * Change playback speed
 * @param {number} multiplier
 */
let change_speed = multiplier => {
	if (!current_video) return
	let video = current_video.element
	let new_rate = Math.max(0.25, Math.min(3.0, video.playbackRate * multiplier))
	video.playbackRate = new_rate
}

/**
 * Toggle fullscreen
 */
let toggle_fullscreen = () => {
	if (!current_video) return
	let video = /** @type {ExtendedVideoElement} */ (current_video.element)
	let extended_document = /** @type {ExtendedDocument} */ (document)

	if (document.fullscreenElement || extended_document.webkitFullscreenElement) {
		if (document.exitFullscreen) document.exitFullscreen()
		else if (extended_document.webkitExitFullscreen) extended_document.webkitExitFullscreen()
	} else
		if (video.requestFullscreen) video.requestFullscreen()
		else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen()
}

/**
 * Check if event target is an input element
 * @param {Event} event
 * @returns {boolean}
 */
let is_input_target = event => {
	let target = /** @type {ExtendedEventTarget | null} */ (event.target)
	if (!target) return false

	let tag_name = target.tagName
	if (tag_name && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag_name)) return true

	return Boolean(target.isContentEditable)
}

/**
 * Handle video navigation shortcuts
 * @param {KeyboardEvent} event
 * @param {HTMLVideoElement} video
 * @returns {boolean} - Whether the event was handled
 */
let handle_video_shortcuts = (event, video) => {
	switch (event.code) {
		case 'ArrowLeft':
			seek_video(-5)
			return true
		case 'ArrowRight':
			seek_video(5)
			return true
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
			return true
		case 'Period':
			if (event.shiftKey) {
				change_speed(1.25)
				return true
			}
			break
		case 'Comma':
			if (event.shiftKey) {
				change_speed(0.8)
				return true
			}
			break
		case 'Digit0':
		case 'Digit1':
		case 'Digit2':
		case 'Digit3':
		case 'Digit4':
		case 'Digit5':
		case 'Digit6':
		case 'Digit7':
		case 'Digit8':
		case 'Digit9': {
			let digit = parseInt(event.code.slice(-1), 10)
			jump_to_percentage(digit * 10)
			return true
		}
	}
	return false
}

/**
 * Handle keyboard events
 * @param {KeyboardEvent} event
 */
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

/**
 * Initialize extension
 */
let init = () => {
	// Load settings
	chrome.storage.sync.get(['enabled'], result => {
		extension_enabled = result['enabled'] !== false
	})

	// Update video reference periodically
	setInterval(update_current_video, 1000)
	update_current_video()

	// Listen for keyboard events
	document.addEventListener('keydown', handle_keydown, true)

	// Listen for storage changes
	chrome.storage.onChanged.addListener(changes => {
		if (changes['enabled']) extension_enabled = changes['enabled'].newValue
	})
}

// Start when DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
else init()
