/** @fileoverview Universal Video Hotkeys - Content Script */

import {
	setup_double_click_fullscreen,
	handle_shortcuts
} from './video.js'

/** @typedef {EventTarget & { tagName?: string; isContentEditable?: boolean; }} ExtendedEventTarget */
/** @typedef {Object} VideoState @property {HTMLVideoElement} element */

/** @type {VideoState | null} */
let current_video = null
/** @type {boolean} */
let extension_enabled = true
/** @type {boolean} */
let always_enable_sound = false
/** @type {Set<Document | ShadowRoot>} */
let observed_roots = new Set()
/** @type {Set<HTMLVideoElement>} */
let known_videos = new Set()

/** Log function with prefix @param {...any} args */
let log = (...args) => console.log('[VideoHotkeys]', ...args)

/** Get the most relevant video element @returns {HTMLVideoElement | null} */
let get_current_video = () => {
	if (!known_videos.size)
		return null

	let videos = Array.from(known_videos)

	let playing = videos.find(v => !v.paused && !v.ended)
	if (playing)
		return playing

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
		current_video = { element: video }

		if (always_enable_sound) {
			video.muted = false
			video.volume = 1.0
			log('Force sound: unmuted and volume set to 100%')
		}

		setup_double_click_fullscreen(video)
	}
}

/** Check if event target is an input element @param {Event} event @returns {boolean} */
let is_input_target = event => {
	let target = /** @type {ExtendedEventTarget | null} */ (event.target)
	if (!target)
		return false

	let tag_name = target.tagName
	if (tag_name && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag_name))
		return true

	return Boolean(target.isContentEditable)
}

/** Handle keyboard events @param {KeyboardEvent} event */
let handle_keydown = event => {
	if (!extension_enabled || !current_video)
		return

	if (is_input_target(event))
		return

	let video = current_video.element
	let handled = handle_shortcuts(event, video)

	if (handled) {
		event.preventDefault()
		event.stopPropagation()
	}
}

/** For a document/shadow root, recursively populate known_videos with video tags, setup observers for dom changes and start key listeners @param {Document | ShadowRoot} root */
let observe_root_recursively = root => {
	if (observed_roots.has(root))
		return
	observed_roots.add(root)

	root.addEventListener('keydown', /** @type {EventListener} */ (handle_keydown), true)
	log('Added keyboard listener to root:', root === document ? 'document' : 'shadow DOM')

	let elements = root.querySelectorAll('*')
	for (let element of elements) {
		if (element.tagName === 'VIDEO')
			known_videos.add(/** @type {HTMLVideoElement} */ (element))
		if (element.shadowRoot)
			observe_root_recursively(element.shadowRoot)
		if (element.tagName === 'IFRAME' && /** @type {HTMLIFrameElement} */ (element).contentDocument)
			observe_root_recursively(/** @type {HTMLIFrameElement} */ (element).contentDocument)
	}

	let observer = new MutationObserver(mutations => {
		let should_update = false

		for (let mutation of mutations)
			if (mutation.type === 'childList')
				for (let node of mutation.addedNodes)
					if (node.nodeType === Node.ELEMENT_NODE) {
						let element = /** @type {Element} */ (node)

						if (element.tagName === 'VIDEO') {
							known_videos.add(/** @type {HTMLVideoElement} */ (element))
							should_update = true
						}

						if (element.shadowRoot)
							observe_root_recursively(element.shadowRoot)

						if (element.tagName === 'IFRAME' && /** @type {HTMLIFrameElement} */ (element).contentDocument)
							observe_root_recursively(/** @type {HTMLIFrameElement} */ (element).contentDocument)
					}

		if (should_update)
			update_current_video()
	})

	observer.observe(root, { childList: true, subtree: true })
	log('MutationObserver setup for root:', root === document ? 'document' : 'shadow DOM')
}

/** Initialize extension */
let init = () => {
	log('Initializing comprehensive video detection')

	chrome.storage.sync.get(['enabled', 'always_enable_sound'], result => {
		if (chrome.runtime.lastError) {
			log('Storage error:', chrome.runtime.lastError)
			extension_enabled = true
			always_enable_sound = false
		} else {
			extension_enabled = result && result['enabled'] !== false
			always_enable_sound = result && result['always_enable_sound'] === true
		}
		log('Extension enabled:', extension_enabled)
		log('Always enable sound:', always_enable_sound)
	})

	observe_root_recursively(document)
	update_current_video()

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
if (document.readyState === 'complete')
	init()
else
	window.addEventListener('load', init)
