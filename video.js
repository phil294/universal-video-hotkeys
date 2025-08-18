/** @fileoverview Video interaction functions */

/** @typedef {Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; }} ExtendedDocument */
/** @typedef {HTMLVideoElement & { webkitRequestFullscreen?: () => void; }} ExtendedVideoElement */

/** @type {HTMLDivElement | null} */
let speed_indicator = null

/** Create and show speed indicator overlay @param {number} speed */
export let show_speed_indicator = speed => {
	if (speed_indicator) speed_indicator.remove()

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
export let setup_double_click_fullscreen = video => {
	video.removeEventListener('dblclick', handle_double_click)
	video.addEventListener('dblclick', handle_double_click)
}

/** Handle double-click on video for fullscreen @param {Event} event */
let handle_double_click = event => {
	event.preventDefault()
	event.stopPropagation()
	let video = /** @type {HTMLVideoElement} */ (event.target)
	toggle_fullscreen(video)
}

/** Change volume by percentage @param {HTMLVideoElement} video @param {number} delta */
export let change_volume = (video, delta) => {
	let old_volume = video.volume
	let new_volume = Math.max(0, Math.min(1, video.volume + (delta / 100)))
	video.volume = new_volume
	video.muted = false
	console.log(`[VideoHotkeys] Volume change: ${(old_volume * 100).toFixed(0)}% → ${(new_volume * 100).toFixed(0)}%`)
}

/** Seek video by seconds @param {HTMLVideoElement} video @param {number} seconds */
export let seek_video = (video, seconds) => {
	let old_time = video.currentTime
	video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
	console.log(`[VideoHotkeys] Seek ${seconds > 0 ? '+' : ''}${seconds}s: ${old_time.toFixed(1)}s → ${video.currentTime.toFixed(1)}s`)
}

/** Jump to percentage of video @param {HTMLVideoElement} video @param {number} percentage */
export let jump_to_percentage = (video, percentage) => {
	if (video.duration) {
		let new_time = (percentage / 100) * video.duration
		video.currentTime = new_time
		console.log(`[VideoHotkeys] Jump to ${percentage}%: ${new_time.toFixed(1)}s`)
	}
}

/** Change playback speed @param {HTMLVideoElement} video @param {number} direction */
export let change_speed = (video, direction) => {
	let current_rate = video.playbackRate
	let new_rate = direction > 0
		? Math.min(3.0, current_rate + 0.25)
		: Math.max(0.25, current_rate - 0.25)
	video.playbackRate = new_rate
	console.log(`[VideoHotkeys] Speed change: ${current_rate.toFixed(2)}x → ${new_rate.toFixed(2)}x`)
	show_speed_indicator(new_rate)
}

/** Toggle play/pause @param {HTMLVideoElement} video */
export let toggle_play_pause = video => {
	if (video.paused) {
		video.play()
		console.log('[VideoHotkeys] Play')
	} else {
		video.pause()
		console.log('[VideoHotkeys] Pause')
	}
}

/** Toggle fullscreen @param {HTMLVideoElement} video */
export let toggle_fullscreen = video => {
	let extended_video = /** @type {ExtendedVideoElement} */ (video)
	let extended_document = /** @type {ExtendedDocument} */ (document)

	if (document.fullscreenElement || extended_document.webkitFullscreenElement) {
		if (document.exitFullscreen) document.exitFullscreen()
		else if (extended_document.webkitExitFullscreen) extended_document.webkitExitFullscreen()
		console.log('[VideoHotkeys] Exit fullscreen')
	} else {
		if (extended_video.requestFullscreen) extended_video.requestFullscreen()
		else if (extended_video.webkitRequestFullscreen) extended_video.webkitRequestFullscreen()
		console.log('[VideoHotkeys] Enter fullscreen')
	}
}

/** Handle video navigation shortcuts @param {KeyboardEvent} event @param {HTMLVideoElement} video @returns {boolean} */
export let handle_shortcuts = (event, video) => {
	switch (event.code) {
		case 'Space':
			toggle_play_pause(video)
			return true
		case 'ArrowLeft':
			seek_video(video, -5)
			return true
		case 'ArrowRight':
			seek_video(video, 5)
			return true
		case 'ArrowUp':
			if (document.activeElement === video || document.fullscreenElement === video) {
				change_volume(video, 5)
				return true
			}
			break
		case 'ArrowDown':
			if (document.activeElement === video || document.fullscreenElement === video) {
				change_volume(video, -5)
				return true
			}
			break
		case 'Home':
			jump_to_percentage(video, 0)
			return true
		case 'End':
			jump_to_percentage(video, 100)
			return true
		case 'KeyF':
			toggle_fullscreen(video)
			return true
		case 'KeyM':
			video.muted = !video.muted
			console.log('[VideoHotkeys] Mute toggled:', video.muted ? 'muted' : 'unmuted')
			return true
		case 'Period':
			if (event.shiftKey) {
				change_speed(video, 1)
				return true
			}
			break
		case 'Comma':
			if (event.shiftKey) {
				change_speed(video, -1)
				return true
			}
			break
		case 'Digit0': case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
		case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
			let digit = parseInt(event.code.slice(-1), 10)
			jump_to_percentage(video, digit * 10)
			return true
		}
	}
	return false
}
