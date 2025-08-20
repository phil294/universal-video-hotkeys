/** @type {boolean} */
let extension_enabled = true
/** @type {Set<Document | ShadowRoot>} */
let observed_roots = new Set()
/** @type {Set<HTMLVideoElement>} */
let known_videos = new Set()
/** Closed shadow roots can't be reopened later and need to be captured at creation time. @type {WeakMap<Element, ShadowRoot>} */
let closed_shadow_root_by_host = new WeakMap()

let is_same_origin_iframe = (() => { try { return window.top !== window && window.top?.location.origin === window.location.origin } catch { return false }})() // eslint-disable-line
let is_top_frame = window.top === window
let is_cross_origin_iframe = !is_top_frame && !is_same_origin_iframe
let allow_keyboard_listeners = true // is_top_frame // true because they only trigger when frame is focused anyway in which case the root shortcuts wouldn't work

/** @type {HTMLVideoElement | null} */
let current_local_video = null
/** Remote coordination */
/** @typedef {{ frame_id: string, video_id: number, iframe: HTMLIFrameElement, rect: { top:number,left:number,width:number,height:number }, playing: boolean, paused: boolean, duration: number, playback_rate: number, volume: number, muted: boolean }} RemoteVideo */
/** @type {Map<string, RemoteVideo>} */
let remote_videos = new Map()
/** @type {RemoteVideo | null} */
let current_remote_video = null
/** @type {'local' | 'remote'} */
let active_source = 'local'

let document_id = Math.random().toString(36).slice(2) + '-' + location.href.slice(0, 100)
if (is_cross_origin_iframe)
	window.top?.postMessage({ uvh: true, type: 'frame_init', frame_id: document_id }, '*')

/** @param {unknown[]} args */
let log = (...args) => { console.debug(`[UniversalVideoHotkeys:${document_id}:${new Date().toLocaleTimeString()}]`, ...args) }

function find_iframe_by_window (/** @type {Window | null} */ win) {
	if (!win)
		return null
	let roots = new Set(observed_roots)
	roots.add(document)
	for (let root of roots) {
		// root can be Document or ShadowRoot
		if (!('querySelectorAll' in root))
			continue
		for (let iframe of root.querySelectorAll('iframe'))
			try {
				if (iframe.contentWindow === win)
					return iframe
			} catch {}
	}
	return null
}

/** @param {RemoteVideo} rv */
function remote_rect_composed (rv) {
	let iframe_rect = rv.iframe.getBoundingClientRect()
	return {
		left: iframe_rect.left + rv.rect.left,
		top: iframe_rect.top + rv.rect.top,
		width: rv.rect.width,
		height: rv.rect.height,
		right: iframe_rect.left + rv.rect.left + rv.rect.width,
		bottom: iframe_rect.top + rv.rect.top + rv.rect.height
	}
}
/** @param {{ top:number,bottom:number,left:number,right:number }} rect */
let rect_is_visible = rect => rect.top + 50 < innerHeight && rect.bottom - 50 > 0 && rect.left + 50 < innerWidth && rect.right - 50 > 0
/** @param {HTMLVideoElement | null | undefined} video */
let is_local_video_visible = video => {
	if (!video)
		return false
	let r = video.getBoundingClientRect()
	return rect_is_visible(r)
}
/** @param {RemoteVideo | null | undefined} remote */
let is_remote_video_visible = remote => {
	if (!remote)
		return false
	return rect_is_visible(remote_rect_composed(remote))
}
function get_best_remote_video () {
	let list = Array.from(remote_videos.values())
	let playing = list.filter(v => v.playing && is_remote_video_visible(v))
	if (playing[0])
		return playing[0]
	for (let v of list)
		if (is_remote_video_visible(v))
			return v
	return list[0] ?? null
}

// Pure instanceofs can fail across iframes / Firefox Xrays. The below helper functions are cross-realm safe.
/** @param {Element} el @returns {el is HTMLVideoElement} */
let element_is_video = el =>
	el.nodeName === 'VIDEO' && 'play' in el
/** @param {Element} el @returns {el is HTMLIFrameElement} */
let element_is_iframe = el =>
	el.nodeName === 'IFRAME'
/** @param {Document | ShadowRoot} el @returns {el is ShadowRoot} */
let doc_is_shadow_root = el =>
	el.constructor.name === 'ShadowRoot'
/** @param {Node} node @returns {node is Element} */
let node_is_element = node =>
	node.nodeType === Node.ELEMENT_NODE
/** @param {EventTarget} target @returns {target is HTMLElement} */
let event_target_is_html = target =>
	'inert' in target && 'innerText' in target && 'autocorrect' in target
/** @param {Event} event @returns {event is KeyboardEvent} */
let event_is_keyboard = event =>
	'key' in event

/** choose first playing, else first visible with 50px margin */
let get_best_local_video = () => {
	let vids = Array.from(known_videos)
	for (let v of vids)
		if (!v.paused && !v.ended && is_local_video_visible(v))
			return v
	for (let v of vids)
		if (is_local_video_visible(v))
			return v
	return vids[0] ?? null
}
let update_current_video = () => {
	let local_video = get_best_local_video()
	let remote_video = is_top_frame ? get_best_remote_video() : null
	let chosen_source = 'local'
	if (remote_video && !local_video)
		chosen_source = 'remote'
	else if (remote_video && local_video) {
		let local_playing = !local_video.paused && !local_video.ended
		let remote_playing = remote_video.playing
		if (remote_playing && !local_playing)
			chosen_source = 'remote'
		else if (remote_playing === local_playing)
			if (!is_local_video_visible(local_video) && is_remote_video_visible(remote_video))
				chosen_source = 'remote'
	}
	if (chosen_source === 'local') {
		current_remote_video = null
		if (local_video && local_video !== current_local_video) {
			log('Active video changed (local):', local_video.src || local_video.currentSrc || 'unknown source', local_video.src ? undefined : local_video)
			current_local_video = local_video
		}
		active_source = 'local'
	} else if (remote_video) {
		current_local_video = null
		if (remote_video !== current_remote_video) {
			log('Active video changed (remote): frame', remote_video.frame_id, 'video', remote_video.video_id)
			current_remote_video = remote_video
		}
		active_source = 'remote'
	}
}
let update_current_video_debouncer = -1
let update_current_video_debounced = () => {
	clearTimeout(update_current_video_debouncer)
	update_current_video_debouncer = window.setTimeout(update_current_video, 250)
}

/** Check if event target is an input element @param {Event} event @returns {boolean} */
let is_input_target = event => {
	let target = event.target
	if (!target || !event_target_is_html(target))
		return false
	if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		return true
	return target.isContentEditable
}

let event_to_action = (/** @type {Event} */ event) => {
	if (!extension_enabled || !event_is_keyboard(event) || is_input_target(event))
		return null
	if (event.altKey || event.ctrlKey || event.metaKey)
		return null
	update_current_video()
	let video = active_source === 'local' ? current_local_video : current_remote_video
	let playback_rate = active_source === 'local' ? current_local_video?.playbackRate : current_remote_video?.playback_rate
	if (!video || !playback_rate)
		return
	// determine whether volume shortcuts should be enabled: if active element or fullscreen element is inside the video bounds (within 5px tolerance).
	// cannot compare for active/fullscreenElement directly because in several situations, this might be a wrapper div, or a sibling controls element etc. so this seems like the only solution.
	let can_volume = false
	if (active_source === 'local' && current_local_video) {
		let video_rect = current_local_video.getBoundingClientRect()
		/** @param {Element | null | undefined} el @returns {boolean} */
		let within = el => {
			if (!el)
				return false
			let box = el.getBoundingClientRect()
			return box.top >= video_rect.top - 5 && box.left >= video_rect.left - 5 && box.right <= video_rect.right + 5 && box.bottom <= video_rect.bottom + 5
		}
		can_volume = within(document.activeElement) || within(document.fullscreenElement)
	}
	return globalThis.interpret_shortcut(event, { playback_rate, can_volume })
}
let handle_keydown = (/** @type {Event} */ event) => {
	let action = event_to_action(event)
	if (!action)
		return
	event.preventDefault()
	event.stopImmediatePropagation()
	if (active_source === 'local' && current_local_video) {
		globalThis.execute_action(current_local_video, action)
		return
	}
	if (current_remote_video)
		current_remote_video.iframe.contentWindow?.postMessage({ uvh: true, type: 'action', frame_id: current_remote_video.frame_id, video_id: current_remote_video.video_id, action }, '*')
}
let handle_keyup = (/** @type {Event} */ event) => {
	if (!event_to_action(event))
		return
	event.preventDefault()
	event.stopImmediatePropagation()
}

/** For a document/shadow root, recursively populate known_videos with video tags, setup observers for dom changes and start key listeners */
function observe_root_recursively (/** @type {Document | ShadowRoot} */ root, /** @type {string} */ origin) {
	if (observed_roots.has(root))
		return
	observed_roots.add(root)
	let root_title = doc_is_shadow_root(root) ? 'shadow:' + root.host.tagName : root.nodeName
	log('Observing new root:', root_title, 'origin:', origin, ', total:', observed_roots.size)

	if (allow_keyboard_listeners) {
		root.addEventListener('keydown', handle_keydown, true)
		root.addEventListener('keyup', handle_keyup, true)
	}

	let elements = root.querySelectorAll('*')
	for (let element of elements)
		if (handle_new_element(element, 'scan'))
			update_current_video_debounced()

	let observer = new MutationObserver(mutations => {
		for (let mutation of mutations)
			if (mutation.type === 'childList')
				for (let node of mutation.addedNodes)
					if (node_is_element(node))
						if (handle_new_element(node, 'mutation'))
							update_current_video_debounced()
	})
	observer.observe(root, { childList: true, subtree: true })
}

/** Handle a newly encountered element. Returns true if this call added a video. */
function handle_new_element (/** @type {Element} */ element, /** @type {'scan' | 'mutation'} */ origin) {
	if (element_is_video(element)) {
		if (!known_videos.has(element)) {
			log(origin + ': New video', element.src || element.currentSrc || element.src || element)
			known_videos.add(element)
			globalThis.setup_double_click_fullscreen(element)
			if (is_cross_origin_iframe)
				register_child_video_to_top(element)
			return true
		}
		return false
	}
	if (element.shadowRoot)
		observe_root_recursively(element.shadowRoot, origin + ': shadow')
	else {
		let closed_shadow = closed_shadow_root_by_host.get(element)
		if (closed_shadow)
			observe_root_recursively(closed_shadow, origin + ': shadow closed map')
		else if (element.tagName.includes('-')) {
			// unresolved custom element (no shadow yet). shouldn't be necessary bc attach hook.
			log(origin + ': Waiting for custom component without shadowRoot:', element.tagName)
			void customElements.whenDefined(element.tagName.toLowerCase()).then(() => {
				if (!element.isConnected)
					return
				let late_closed = closed_shadow_root_by_host.get(element)
				if (late_closed)
					observe_root_recursively(late_closed, origin + ': custom component whenDefined closed map')
				else if (element.shadowRoot)
					observe_root_recursively(element.shadowRoot, origin + ': custom component whenDefined')
			})
		}
	}
	if (element_is_iframe(element)) {
		if (element.contentDocument) {
			observe_root_recursively(element.contentDocument, origin + ': iframe ' + element.src)
			observe_shadow_root_attachments(element.contentDocument, origin + ': iframe ' + element.src)
		}
		// Load listener to catch delayed availability or navigations
		element.addEventListener('load', () => {
			if (element.contentDocument) {
				observe_root_recursively(element.contentDocument, origin + ': iframe onload ' + element.src)
				observe_shadow_root_attachments(element.contentDocument, origin + ': iframe onload ' + element.src)
			}
		}, { once: false })
	}
	return false
}

/** injects a page-world hook to catch shadow root creations. necessary there's no api for that and mutation observer also isn't notified. */
function observe_shadow_root_attachments (/** @type {Document} */ root, /** @type {string} */ origin) {
	if (root.getElementById('__video_hotkeys_shadow_attach_hook'))
		return
	let script_element = root.createElement('script')
	script_element.id = '__video_hotkeys_shadow_attach_hook'
	script_element.textContent =
		`(() => {
			if (window.__video_hotkeys_shadow_attach_hooked)
				return
			window.__video_hotkeys_shadow_attach_hooked = true
			let original = Element.prototype.attachShadow
			function dispatch(/** @type {Element} */ host, /** @type {ShadowRoot | null} */ shadow) {
				try {
					window.top.dispatchEvent(new CustomEvent('video_hotkeys_shadow_root_attached', {
						detail: { host, shadow }
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
	root.documentElement.appendChild(script_element)
	log('Injected shadow attach root hook into', origin, 'at', root.location.href)
}
window.addEventListener('video_hotkeys_shadow_root_attached', event => {
	// eslint-disable-next-line custom--no-jsdoc-cast/no-jsdoc-cast
	let { detail: { shadow, host } } = /** @type {CustomEvent<{ host?: Element | null, shadow?: ShadowRoot | null }>} */ (event)
	if (shadow) {
		if (host && !host.shadowRoot) {
			log('Shadow attach hook: host without shadowRoot, storing closed shadow root for', host.tagName)
			closed_shadow_root_by_host.set(host, shadow)
		}
		observe_root_recursively(shadow, 'shadow attach hook shadow')
		return
	}
	if (host) {
		let closed_shadow = closed_shadow_root_by_host.get(host)
		if (closed_shadow) {
			observe_root_recursively(closed_shadow, 'shadow attach hook closed map')
			return
		}
		if (host.shadowRoot)
			observe_root_recursively(host.shadowRoot, 'shadow attach hook host shadow')
	}
})

void browser.storage.sync.get(['globally_enabled', 'disabled_hosts']).then(result => {
	if (browser.runtime.lastError) {
		log('Storage error:', browser.runtime.lastError)
		extension_enabled = true
	} else {
		let globally_enabled = result['globally_enabled'] !== false
		let disabled_hosts_raw = result['disabled_hosts'] ?? []
		let disabled_hosts = Array.isArray(disabled_hosts_raw) ? disabled_hosts_raw : []
		let host = location.hostname
		extension_enabled = globally_enabled && !disabled_hosts.includes(host)
	}

	log('Extension enabled:', extension_enabled)
})

log('Init')
if (is_same_origin_iframe)
	log('Skipping init in same-origin iframe (root handles videos)')
else {
	// Needs to happen early as this hooks into prototype in host page
	observe_shadow_root_attachments(document, 'root document')

	// console.time('init')
	observe_root_recursively(document, 'root document')
	// console.timeEnd('init')

	window.addEventListener('scroll', update_current_video_debounced, { passive: true })

	browser.storage.onChanged.addListener(changes => {
		if (!changes['globally_enabled'] && !changes['disabled_hosts'])
			return
		void browser.storage.sync.get(['globally_enabled', 'disabled_hosts']).then(result => {
			let globally_enabled = result['globally_enabled'] !== false
			let disabled_hosts_raw = result['disabled_hosts'] ?? []
			let disabled_hosts = Array.isArray(disabled_hosts_raw) ? disabled_hosts_raw : []
			let host = location.hostname
			extension_enabled = globally_enabled && !disabled_hosts.includes(host)
			log('Extension enabled recalculated:', extension_enabled ? 'enabled' : 'disabled')
		})
	})
}

/** @type {Map<number, HTMLVideoElement>} */
let this_cross_origin_frame_child_video_by_id = new Map()
let child_next_video_id = 1
function register_child_video_to_top (/** @type {HTMLVideoElement} */ video) {
	if (!is_cross_origin_iframe)
		return
	let id = child_next_video_id++
	this_cross_origin_frame_child_video_by_id.set(id, video)
	post_child_video_state_to_top('video_added', video, id)
	for (let event_name of ['loadedmetadata', 'pause', 'play', 'ratechange', 'seeked', 'volumechange', 'ended', 'error'])
		video.addEventListener(event_name, () =>
			post_child_video_state_to_top('state', video, id))
}
function post_child_video_state_to_top (/** @type {'video_added' | 'state'} */ type, /** @type {HTMLVideoElement} */ video, /** @type {number} */ id) {
	if (!is_cross_origin_iframe)
		return
	log('post child state to top', type, 'video', id, video.src || video.currentSrc || video.src || video)
	let rect = video.getBoundingClientRect()
	window.top?.postMessage({ uvh: true, type, frame_id: document_id, video_id: id, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, playing: !video.paused && !video.ended, paused: video.paused, duration: video.duration || 0, playback_rate: video.playbackRate, volume: video.volume, muted: video.muted }, '*')
}
/** @typedef {{ uvh?: boolean, type?: 'action', frame_id?: string, video_id?: number, action?: { action: string, seconds?: number, delta?: number, pct?: number, direction?: number } }} ActionMessage */
/** @typedef {{ uvh?: boolean, type?: 'video_added' | 'state' | 'frame_init', frame_id?: string, video_id?: number, rect?: { top:number,left:number,width:number,height:number }, playing?: boolean, paused?: boolean, duration?: number, playback_rate?: number, volume?: number, muted?: boolean }} StateMessage */
/** @param {unknown} x @returns {x is ActionMessage} */
let is_action_message = x => !!x && typeof x === 'object' && 'type' in x && x.type === 'action'
/** @param {unknown} x @returns {x is StateMessage} */
let is_state_message = x => !!x && typeof x === 'object' && 'type' in x && typeof x.type === 'string' && ['video_added', 'state', 'frame_init'].includes(x.type)

if (is_cross_origin_iframe)
	window.addEventListener('message', event => {
		if (!is_action_message(event.data) || !event.data.uvh || event.data.frame_id !== document_id || typeof event.data.video_id !== 'number' || !event.data.action)
			return
		let video = this_cross_origin_frame_child_video_by_id.get(event.data.video_id)
		if (!video)
			return
		globalThis.execute_action(video, event.data.action)
		post_child_video_state_to_top('state', video, event.data.video_id)
	})

if (is_top_frame)
	window.addEventListener('message', event => {
		if (!is_state_message(event.data) || !event.data.uvh)
			return
		if (event.data.type === 'frame_init')
			return
		if (event.data.type !== 'video_added' && event.data.type !== 'state')
			return
		if (typeof event.data.frame_id !== 'string' || typeof event.data.video_id !== 'number')
			return
		let win_source = event.source
		let win = (win_source && typeof win_source === 'object' && 'closed' in win_source) ? win_source : null
		if (!win)
			return
		let iframe = find_iframe_by_window(win)
		if (!iframe)
			return
		let key = event.data.frame_id + ':' + String(event.data.video_id)
		let existing = remote_videos.get(key)
		log('Received remote video update:', event.data.type, 'for frame', event.data.frame_id, 'video', event.data.video_id, 'iframe', iframe.src || iframe.srcdoc || iframe.src || iframe, 'already existing', !!existing)
		let rect = event.data.rect && typeof event.data.rect === 'object' ? event.data.rect : { top: 0, left: 0, width: 0, height: 0 }
		if (!existing)
			remote_videos.set(key, { frame_id: event.data.frame_id, video_id: event.data.video_id, iframe, rect, playing: !!event.data.playing, paused: !!event.data.paused, duration: event.data.duration ?? 0, playback_rate: event.data.playback_rate ?? 1, volume: event.data.volume ?? 0, muted: !!event.data.muted })
		else {
			existing.rect = rect
			existing.playing = !!event.data.playing
			existing.paused = !!event.data.paused
			existing.duration = event.data.duration ?? existing.duration
			existing.playback_rate = event.data.playback_rate ?? existing.playback_rate
			existing.volume = event.data.volume ?? existing.volume
			existing.muted = !!event.data.muted
		}
		update_current_video_debounced()
	})
