(() => {
	// @ts-expect-error internal flag
	if (window.__video_hotkeys_shadow_attach_hooked)
		return
	// @ts-expect-error internal flag
	window.__video_hotkeys_shadow_attach_hooked = true
	// eslint-disable-next-line @typescript-eslint/unbound-method
	let original = Element.prototype.attachShadow
	function dispatch (/** @type {Element} */ host, /** @type {ShadowRoot | null} */ shadow) {
		try {
			// store closed shadow root reference for later retrieval across realms if needed
			if (shadow && shadow.mode === 'closed')
				// @ts-expect-error store closed shadow root reference on host element
				host.__uvh_closed_shadow_root = shadow
			// Bubble an event from host so content script can read event.target without relying on CustomEvent detail (stripped in Chrome isolated world)
			host.dispatchEvent(new Event('video_hotkeys_shadow_root_attached', { bubbles: true }))
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
})()
