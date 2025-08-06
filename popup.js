/** @fileoverview Universal Video Hotkeys - Popup Script */

/** @type {HTMLElement | null} */
let enabled_toggle = document.getElementById('enabled_toggle')

/** Update toggle appearance @param {boolean} enabled */
let update_toggle = enabled => {
	if (!enabled_toggle) return
	if (enabled) enabled_toggle.classList.add('enabled')
	else enabled_toggle.classList.remove('enabled')
}

/** Toggle extension state */
let toggle_extension = () => {
	chrome.storage.sync.get(['enabled'], result => {
		let new_state = !(result['enabled'] !== false)
		chrome.storage.sync.set({ enabled: new_state })
		update_toggle(new_state)
	})
}

// Initialize popup
chrome.storage.sync.get(['enabled'], result => {
	let enabled = result['enabled'] !== false
	update_toggle(enabled)
})

// Add click listener
if (enabled_toggle) enabled_toggle.addEventListener('click', toggle_extension)
