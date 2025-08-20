// @ts-expect-error google stinks
window.browser ??= window.chrome

let get_checkbox = (/** @type {string} */ id) => {
	let el = document.getElementById(id)
	if (!(el instanceof HTMLInputElement))
		throw new Error(`Element with id ${id} is not an HTMLInputElement`)
	return el
}
let globally_enabled_checkbox = get_checkbox('globally_enabled_toggle')
let site_enabled_checkbox = get_checkbox('site_enabled_toggle')

let get_current_hostname = () => browser.tabs
	.query({ active: true, currentWindow: true })
	.then(tabs => new URL(tabs[0]?.url ?? '').hostname)
	.catch(() => null)

let get_state = () => browser.storage.sync
	.get(['globally_enabled', 'disabled_hosts'])
	.then(stored => ({
		globally_enabled: stored['globally_enabled'] !== false,
		disabled_hosts: Array.isArray(stored['disabled_hosts'])
			? stored['disabled_hosts'].filter(v => typeof v === 'string')
			: []
	}))

void (async () => {
	let host = await get_current_hostname()
	let { globally_enabled, disabled_hosts } = await get_state()
	globally_enabled_checkbox.checked = globally_enabled
	if (host)
		site_enabled_checkbox.checked = !disabled_hosts.includes(host)
})()

globally_enabled_checkbox.addEventListener('change', () =>
	void browser.storage.sync.set({ globally_enabled: globally_enabled_checkbox.checked }))

site_enabled_checkbox.addEventListener('change', async () => {
	let host = await get_current_hostname()
	if (!host)
		return
	let { disabled_hosts } = await get_state()
	let idx = disabled_hosts.indexOf(host)
	let enable_site = site_enabled_checkbox.checked
	if (enable_site && idx !== -1)
		disabled_hosts.splice(idx, 1)
	else if (!enable_site && idx === -1)
		disabled_hosts.push(host)
	void browser.storage.sync.set({ disabled_hosts })
})
