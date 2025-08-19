/** @file Universal Video Hotkeys - Popup Script */

/** @type {HTMLInputElement | null} */
let enabled_checkbox = null
/** @type {HTMLInputElement | null} */
let sound_checkbox = null

// Initialize elements
let enabled_element = document.getElementById('enabled_toggle')
if (enabled_element instanceof HTMLInputElement)
	enabled_checkbox = enabled_element

let sound_element = document.getElementById('sound_toggle')
if (sound_element instanceof HTMLInputElement)
	sound_checkbox = sound_element

/** Update checkbox state @param {boolean} enabled @param {boolean} always_enable_sound */
let update_checkboxes = (enabled, always_enable_sound) => {
	if (enabled_checkbox)
		enabled_checkbox.checked = enabled
	if (sound_checkbox)
		sound_checkbox.checked = always_enable_sound
}

/** Handle enabled toggle change */
let handle_enabled_change = () => {
	if (!enabled_checkbox)
		return
	let new_state = enabled_checkbox.checked
	void browser.storage.sync.set({ enabled: new_state })
	console.log('Extension toggled:', new_state ? 'enabled' : 'disabled')
}

/** Handle sound toggle change */
let handle_sound_change = () => {
	if (!sound_checkbox)
		return
	let new_state = sound_checkbox.checked
	console.log('Always enable sound toggled:', new_state ? 'enabled' : 'disabled')
	return browser.storage.sync.set({ always_enable_sound: new_state })
}

// Initialize popup
void browser.storage.sync.get(['enabled', 'always_enable_sound']).then(result => {
	let enabled = result['enabled'] !== false
	let always_enable_sound = result['always_enable_sound'] === true
	update_checkboxes(enabled, always_enable_sound)
	console.log('Popup initialized, extension is:', enabled ? 'enabled' : 'disabled')
	console.log('Always enable sound is:', always_enable_sound ? 'enabled' : 'disabled')
})

// Add change listeners
if (enabled_checkbox)
	enabled_checkbox.addEventListener('change', handle_enabled_change)
if (sound_checkbox)
	sound_checkbox.addEventListener('change', () => { void handle_sound_change() })
