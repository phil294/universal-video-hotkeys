/** @fileov// Handle checkbox changes
checkbox.addEventListener('change', () => {
	let enabled = checkbox.checked
	chrome.storage.sync.set({enabled})
	console.log('Extension', enabled ? 'enabled' : 'disabled')
})Universal Video Hotkeys - Popup Script */

/** @type {HTMLInputElement | null} */
let enabled_checkbox = /** @type {HTMLInputElement | null} */ (document.getElementById('enabled_toggle'))

/** Update checkbox state @param {boolean} enabled */
let update_checkbox = enabled => {
	if (!enabled_checkbox) return
	enabled_checkbox.checked = enabled
}

/** Handle checkbox change */
let handle_toggle_change = () => {
	if (!enabled_checkbox) return
	let new_state = enabled_checkbox.checked
	chrome.storage.sync.set({ enabled: new_state })
	console.log('Extension toggled:', new_state ? 'enabled' : 'disabled')
}

// Initialize popup
chrome.storage.sync.get(['enabled'], result => {
	let enabled = result && result['enabled'] !== false
	update_checkbox(enabled)
	console.log('Popup initialized, extension is:', enabled ? 'enabled' : 'disabled')
})

// Add change listener
if (enabled_checkbox) enabled_checkbox.addEventListener('change', handle_toggle_change)
