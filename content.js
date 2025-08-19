/** @file Universal Video Hotkeys - Content Script */

/** @typedef {EventTarget & { tagName?: string; isContentEditable?: boolean; }} ExtendedEventTarget */
/** @typedef {object} VideoState @property {HTMLVideoElement} element */

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

/** @param {unknown[]} args */
let log = (...args) => { console.debug('[UniversalVideoHotkeys]', ...args) }

/** Get the most relevant video element @returns {HTMLVideoElement | null} */
let get_current_video = () => {
	if (!known_videos.size)
		return null

	let videos = Array.from(known_videos)

	let playing = videos.filter(v => !v.paused && !v.ended)
	if (playing.length === 1)
		return playing[0] ?? null

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
		log('Active video changed:', video.src || video.currentSrc || 'unknown source', video.src ? undefined : video)
		current_video = { element: video }

		if (always_enable_sound) {
			video.muted = false
			video.volume = 1.0
			log('Force sound: unmuted and volume set to 100%')
		}
	}
}

/** Check if event target is an input element @param {Event} event @returns {boolean} */
let is_input_target = event => {
	let target = event.target
	if (!(target instanceof HTMLElement))
		return false

	let tag_name = target.tagName
	if (tag_name && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag_name))
		return true

	return target.isContentEditable
}

/** Handle keyboard events @param {Event} event */
let handle_keydown = event => {
	if (!(event instanceof KeyboardEvent))
		return

	if (!extension_enabled || !current_video)
		return

	if (is_input_target(event))
		return

	let video = current_video.element
	let handled = globalThis.handle_shortcuts(event, video)

	if (handled) {
		event.preventDefault()
		event.stopPropagation()
	}
}

/** For a document/shadow root, recursively populate known_videos with video tags, setup observers for dom changes and start key listeners */
function observe_root_recursively (/** @type {Document | ShadowRoot} */ root, /** @type {string} */ origin) {
	if (observed_roots.has(root))
		return
	observed_roots.add(root)
	let root_title = root instanceof ShadowRoot ? 'shadow:' + root.host.tagName : root.nodeName
	log('Observing new root:', root_title, 'origin:', origin, ', total:', observed_roots.size)

	root.addEventListener('keydown', handle_keydown, true)

	let elements = root.querySelectorAll('*')
	for (let element of elements) {
		if (element.tagName === 'VIDEO' && element instanceof HTMLVideoElement) {
			log('Found video:', element.src || element.currentSrc || 'unknown source', element.src ? undefined : element)
			known_videos.add(element)
			globalThis.setup_double_click_fullscreen(element)
		}
		if (element.shadowRoot)
			observe_root_recursively(element.shadowRoot, 'shadow selector')
		// Track unresolved custom elements (hyphenated tag, no shadow yet).
		// This is important for inactive background tab loading in FF and maybe more
		else if (element.tagName.includes('-')) {
			log('Waiting for custom component without shadowRoot:', element.tagName)
			// When definition is ready, re-check shadow root (constructor may attach then)
			void customElements.whenDefined(element.tagName.toLowerCase()).then(() => {
				if (!element.isConnected || !element.shadowRoot)
					return
				observe_root_recursively(element.shadowRoot, 'custom component selector whenDefined')
			})
		}

		if (element.tagName === 'IFRAME' && element instanceof HTMLIFrameElement) {
			if (element.contentDocument)
				observe_root_recursively(element.contentDocument, 'iframe selector ' + element.src)

			// Add load listener to catch delayed availability or navigations
			element.addEventListener('load', () => {
				if (element.contentDocument)
					observe_root_recursively(element.contentDocument, 'iframe selector onload ' + element.src)
			}, { once: false })
		}
	}

	let observer = new MutationObserver(mutations => {
		let should_update = false

		for (let mutation of mutations)
			if (mutation.type === 'childList')
				for (let node of mutation.addedNodes)
					if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
						let element = node

						if (element.tagName === 'VIDEO' && element instanceof HTMLVideoElement) {
							log('Mutation: New video:', element.src || element.currentSrc || 'unknown source')
							known_videos.add(element)
							globalThis.setup_double_click_fullscreen(element)
							should_update = true
						}

						if (element.shadowRoot) {
							log('Mutation: Observing shadow root:', element.tagName)
							observe_root_recursively(element.shadowRoot, 'mutation node shadow')
						} else if (element.tagName.includes('-')) {
							log('Mutation: Waiting for custom component without shadowRoot:', element.tagName)
							void customElements.whenDefined(element.tagName.toLowerCase()).then(() => {
								if (!element.isConnected || !element.shadowRoot)
									return
								observe_root_recursively(element.shadowRoot, 'mutation node custom component whenDefined')
							})
						}

						if (element.tagName === 'IFRAME' && element instanceof HTMLIFrameElement) {
							if (element.contentDocument)
								observe_root_recursively(element.contentDocument, 'mutation node iframe ' + element.src)

							element.addEventListener('load', () => {
								if (element.contentDocument)
									observe_root_recursively(element.contentDocument, 'mutation node iframe onload ' + element.src)
							})
						}
					}

		if (should_update)
			update_current_video()
	})

	observer.observe(root, { childList: true, subtree: true })
}

/** injects a page-world hook to catch shadow root creations. necessary there's no api for that and mutation observer also isn't notified. */
function observe_shadow_root_attachments () {
	if (document.getElementById('__video_hotkeys_shadow_attach_hook'))
		return
	let script_element = document.createElement('script')
	script_element.id = '__video_hotkeys_shadow_attach_hook'
	script_element.textContent =
		`(() => {
			if (window.__video_hotkeys_shadow_attach_hooked)
				return
			window.__video_hotkeys_shadow_attach_hooked = true
			let original = Element.prototype.attachShadow
			function dispatch(/** @type {Element} */ host, /** @type {ShadowRoot | null} */ shadow) {
				try {
					window.dispatchEvent(new CustomEvent('video_hotkeys_shadow_root_attached', {
						host, shadow
					}))
				} catch (err) {
					console.debug('[UniversalVideoHotkeys] Failed to dispatch shadow root attached custom event', err)
				}
			}
			Element.prototype.attachShadow = function (/** @type {ShadowRootInit} */ root_init) {
				let shadow = original.call(this, root_init)
				dispatch(this, shadow)
				return shadow
			}
			queueMicrotask(() => {
				for (let el of document.querySelectorAll('*'))
					if (el.shadowRoot)
						dispatch(el, el.shadowRoot)
			})
		})()`
	document.documentElement.appendChild(script_element)
	log('Injected shadow attach root hook')
}
window.addEventListener('video_hotkeys_shadow_root_attached', event => {
	if (!(event instanceof CustomEvent))
		return
	// eslint-disable-next-line custom--no-jsdoc-cast/no-jsdoc-cast
	let { shadow, host } = /** @type {{ host?: Element | null, shadow?: ShadowRoot | null }} */ (event)
	if (shadow && !observed_roots.has(shadow)) {
		observe_root_recursively(shadow, 'shadow attach hook shadow')
		return
	}
	if (host?.shadowRoot && !observed_roots.has(host.shadowRoot))
		observe_root_recursively(host.shadowRoot, 'shadow attach hook host shadow')
})

let init = () => {
	log('Init')

	void browser.storage.sync.get(['enabled', 'always_enable_sound']).then(result => {
		if (browser.runtime.lastError) {
			log('Storage error:', browser.runtime.lastError)
			extension_enabled = true
			always_enable_sound = false
		} else {
			extension_enabled = result['enabled'] !== false
			always_enable_sound = result['always_enable_sound'] === true
		}
		log('Extension enabled:', extension_enabled)
		log('Always enable sound:', always_enable_sound)
	})

	// Needs to happen early as this hooks into prototype in host page
	observe_shadow_root_attachments()

	// console.time('init')
	observe_root_recursively(document, 'root document')
	// console.timeEnd('init')
	update_current_video()

	browser.storage.onChanged.addListener(changes => {
		if (changes['enabled']) {
			extension_enabled = Boolean(changes['enabled'].newValue)
			log('Extension enabled toggled:', extension_enabled ? 'enabled' : 'disabled')
		}
		if (changes['always_enable_sound']) {
			always_enable_sound = Boolean(changes['always_enable_sound'].newValue)
			log('Always enable sound toggled:', always_enable_sound ? 'enabled' : 'disabled')
		}
	})
}

// Start when DOM is ready
if (document.readyState === 'complete')
	init()
else
	window.addEventListener('load', init)
