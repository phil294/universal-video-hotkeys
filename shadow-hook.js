(() => {
	// @ts-expect-error internal flag
	if (window.__video_hotkeys_shadow_attach_hooked)
		return
	// @ts-expect-error internal flag
	window.__video_hotkeys_shadow_attach_hooked = true
	// eslint-disable-next-line @typescript-eslint/unbound-method
	let original = Element.prototype.attachShadow
	function dispatch (/** @type {Element} */ host) {
		// Bubble an event from host so content script can read event.target without relying on CustomEvent detail (stripped in Chrome isolated world)
		host.dispatchEvent(new Event('video_hotkeys_shadow_root_attached', { bubbles: true }))
	}
	Element.prototype.attachShadow = function (/** @type {ShadowRootInit} */ root_init) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (root_init?.mode === 'closed') {
			console.warn('[UniversalVideoHotkeys] Forcing shadowRoot open', this, root_init)
			// force. see 0f4f49b / try-handle-closed-shadow-doms branch for alternative attempts
			root_init.mode = 'open'
		}
		let shadow = original.call(this, root_init)
		dispatch(this)
		return shadow
	}
	queueMicrotask(() => {
		for (let el of document.querySelectorAll('*'))
			if (el.shadowRoot)
				dispatch(el)
	})
})()
