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

/** Handle video navigation shortcuts @param {KeyboardEvent} event @param {HTMLVideoElement} video @returns {boolean} */
globalThis.handle_shortcuts = (event, video) => {
	if (event.altKey || event.ctrlKey || event.metaKey)
		return false
	if (event.shiftKey) {
		switch (event.code) {
			case 'Period':
				globalThis.change_speed(video, 1)
				return true
			case 'Comma':
				globalThis.change_speed(video, -1)
				return true
		}
		return false
	}
	switch (event.code) {
		case 'Space':
			globalThis.toggle_play_pause(video)
			return true
		case 'ArrowLeft':
			globalThis.seek_video(video, -5 * video.playbackRate)
			return true
		case 'ArrowRight':
			globalThis.seek_video(video, 5 * video.playbackRate)
			return true
		case 'ArrowUp':
			if (document.activeElement === video || document.fullscreenElement === video) {
				globalThis.change_volume(video, 5)
				return true
			}
			break
		case 'ArrowDown':
			if (document.activeElement === video || document.fullscreenElement === video) {
				globalThis.change_volume(video, -5)
				return true
			}
			break
		case 'Home':
			globalThis.jump_to_percentage(video, 0)
			return true
		case 'End':
			globalThis.jump_to_percentage(video, 100)
			return true
		case 'KeyF':
			globalThis.toggle_fullscreen(video)
			return true
		case 'KeyM':
			video.muted = !video.muted
			_log('Mute toggled:', video.muted ? 'muted' : 'unmuted')
			return true
		case 'Digit0': case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
		case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
			let digit = parseInt(event.code.slice(-1), 10)
			globalThis.jump_to_percentage(video, digit * 10)
			return true
		}
	}
	return false
}
