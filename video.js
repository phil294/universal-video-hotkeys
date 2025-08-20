/** @typedef {Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; }} ExtendedDocument */
/** @typedef {HTMLVideoElement & { webkitRequestFullscreen?: () => void; }} ExtendedVideoElement */

/** @type {HTMLDivElement | null} */
let speed_indicator = null

/** @param {unknown[]} args */
let _log = (...args) => { console.debug('[UniversalVideoHotkeys]', ...args) }

/** Create and show speed indicator overlay @param {number} speed */
globalThis.show_speed_indicator = speed => {
	if (speed_indicator)
		speed_indicator.remove()

	speed_indicator = document.createElement('div')
	speed_indicator.textContent = `${speed.toFixed(2)}x`
	speed_indicator.style.cssText = `
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 8px 16px;
		border-radius: 4px;
		font-family: Arial, sans-serif;
		font-size: 18px;
		font-weight: bold;
		z-index: 999999;
		pointer-events: none;
		user-select: none;
	`

	document.body.appendChild(speed_indicator)

	setTimeout(() => {
		if (speed_indicator) {
			speed_indicator.remove()
			speed_indicator = null
		}
	}, 1000)
}

/** Setup double-click fullscreen for video @param {HTMLVideoElement} video */
globalThis.setup_double_click_fullscreen = video => {
	video.removeEventListener('dblclick', handle_double_click)
	video.addEventListener('dblclick', handle_double_click)
}

/** Handle double-click on video for fullscreen @param {Event} event */
let handle_double_click = event => {
	event.preventDefault()
	event.stopPropagation()
	if (event.target instanceof HTMLVideoElement) {
		let video = event.target
		globalThis.toggle_fullscreen(video)
	}
}

/** Change volume by percentage @param {HTMLVideoElement} video @param {number} delta */
globalThis.change_volume = (video, delta) => {
	let old_volume = video.volume
	let new_volume = Math.max(0, Math.min(1, video.volume + (delta / 100)))
	video.volume = new_volume
	video.muted = false
	_log(`Volume change: ${(old_volume * 100).toFixed(0)}% → ${(new_volume * 100).toFixed(0)}%`)
}

/** Seek video by seconds @param {HTMLVideoElement} video @param {number} seconds */
globalThis.seek_video = (video, seconds) => {
	let old_time = video.currentTime
	video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
	_log(`Seek ${seconds > 0 ? '+' : ''}${String(seconds)}s: ${old_time.toFixed(1)}s → ${video.currentTime.toFixed(1)}s`)
}

/** Jump to percentage of video @param {HTMLVideoElement} video @param {number} percentage */
globalThis.jump_to_percentage = (video, percentage) => {
	if (video.duration) {
		let new_time = (percentage / 100) * video.duration
		video.currentTime = new_time
		_log(`Jump to ${String(percentage)}%: ${new_time.toFixed(1)}s`)
	}
}

/** Change speed by direction @param {HTMLVideoElement} video @param {number} direction */
globalThis.change_speed = (video, direction) => {
	let current_rate = video.playbackRate
	let new_rate = direction > 0
		? Math.min(3.0, current_rate + 0.25)
		: Math.max(0.25, current_rate - 0.25)
	video.playbackRate = new_rate
	_log(`Speed change: ${current_rate.toFixed(2)}x → ${new_rate.toFixed(2)}x`)
	globalThis.show_speed_indicator(new_rate)
}

/** Toggle play/pause @param {HTMLVideoElement} video */
globalThis.toggle_play_pause = video => {
	if (video.paused) {
		void video.play()
		_log('Play')
	} else {
		video.pause()
		_log('Pause')
	}
}

/** Toggle fullscreen @param {HTMLVideoElement} video */
globalThis.toggle_fullscreen = video => {
	if (document.fullscreenElement) {
		void document.exitFullscreen()
		_log('Exit fullscreen')
	} else {
		void video.requestFullscreen()
		_log('Enter fullscreen')
	}
}

/**
 * interpret a keyboard event into an abstract video action (no side effects)
 * @param {KeyboardEvent} event
 * @param {{ playback_rate: number, can_volume: boolean }} ctx
 * @returns {null | { action: 'toggle_play_pause' | 'seek' | 'volume' | 'jump_percentage' | 'change_speed' | 'toggle_fullscreen' | 'toggle_mute', seconds?: number, delta?: number, pct?: number, direction?: number }} action descriptor or null
 */
globalThis.interpret_shortcut = (event, ctx) => {
	if (event.altKey || event.ctrlKey || event.metaKey)
		return null
	if (event.shiftKey) {
		switch (event.code) {
			case 'Period': return { action: 'change_speed', direction: 1 }
			case 'Comma': return { action: 'change_speed', direction: -1 }
		}
		return null
	}
	switch (event.code) {
		case 'Space': return { action: 'toggle_play_pause' }
		case 'ArrowLeft': return { action: 'seek', seconds: -5 * ctx.playback_rate }
		case 'ArrowRight': return { action: 'seek', seconds: 5 * ctx.playback_rate }
		case 'ArrowUp': return ctx.can_volume ? { action: 'volume', delta: 5 } : null
		case 'ArrowDown': return ctx.can_volume ? { action: 'volume', delta: -5 } : null
		case 'Home': return { action: 'jump_percentage', pct: 0 }
		case 'End': return { action: 'jump_percentage', pct: 100 }
		case 'KeyF': return { action: 'toggle_fullscreen' }
		case 'KeyM': return { action: 'toggle_mute' }
		case 'Digit0': case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
		case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
			let digit = parseInt(event.code.slice(-1), 10)
			return { action: 'jump_percentage', pct: digit * 10 }
		}
	}
	return null
}

/** execute an abstract action on a given video @param {HTMLVideoElement} video @param {{ action: string, seconds?: number, delta?: number, pct?: number, direction?: number }} d */
globalThis.execute_action = (video, d) => {
	switch (d.action) {
		case 'toggle_play_pause': globalThis.toggle_play_pause(video); break
		case 'seek': globalThis.seek_video(video, d.seconds ?? 0); break
		case 'volume': globalThis.change_volume(video, d.delta ?? 0); break
		case 'jump_percentage': globalThis.jump_to_percentage(video, d.pct ?? 0); break
		case 'change_speed': globalThis.change_speed(video, d.direction ?? 0); break
		case 'toggle_fullscreen': globalThis.toggle_fullscreen(video); break
		case 'toggle_mute': video.muted = !video.muted; _log('Mute toggled:', video.muted ? 'muted' : 'unmuted'); break
	}
}

/** Handle video navigation shortcuts using interpret_shortcut @param {KeyboardEvent} event @param {HTMLVideoElement} video @returns {boolean} */
globalThis.handle_shortcuts = (event, video) => {
	let d = globalThis.interpret_shortcut(event, { playback_rate: video.playbackRate, can_volume: document.activeElement === video || document.fullscreenElement === video })
	if (!d)
		return false
	globalThis.execute_action(video, d)
	return true
}
