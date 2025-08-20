/** @type {HTMLInputElement | null} */
let enabled_checkbox = null

// Initialize elements
let enabled_element = document.getElementById('enabled_toggle')
if (enabled_element instanceof HTMLInputElement)
	enabled_checkbox = enabled_element

/** Update checkbox state @param {boolean} enabled */
let update_checkboxes = enabled => {
	if (enabled_checkbox)
		enabled_checkbox.checked = enabled
}

/** Handle enabled toggle change */
let handle_enabled_change = () => {
	if (!enabled_checkbox)
		return
	let new_state = enabled_checkbox.checked
	void browser.storage.sync.set({ enabled: new_state })
	console.log('Extension toggled:', new_state ? 'enabled' : 'disabled')
}

// Initialize popup
void browser.storage.sync.get(['enabled']).then(result => {
	let enabled = result['enabled'] !== false
	update_checkboxes(enabled)
	console.log('Popup initialized, extension is:', enabled ? 'enabled' : 'disabled')
})

// Add change listeners
if (enabled_checkbox)
	enabled_checkbox.addEventListener('change', handle_enabled_change)
