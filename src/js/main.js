/*
c64js - A commodore 64 emulator
(c) Mikael Borgbrant, 2015 - 2016, Some rights reserved
Email: mikael [dot] borgbrant [at] gmail [dot] com
*/

var main = main || {};

window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function (callback, element) {
			window.setTimeout(callback, 1000 / 60);
		};
})();

main.zoom = function (menuItemElement) {
	var emulatorContainer = document.getElementById('emulatorSize');
	var controlPanel = document.getElementById('controlPanel');
	if (emulatorContainer.className == 'zoom') {
		emulatorContainer.className = '';
		controlPanel.className = '';
		menuItemElement.className += menuItemElement.className.substr(0, menuItemElement.className.indexOf(' active'));
	} else {
		emulatorContainer.className = 'zoom';
		controlPanel.className = 'zoom';
		menuItemElement.className += ' active';
	}
}

main.fullscreen = function () {
	var isFullScreen = document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement || document.fullscreenElement;
	var elem = document.getElementById('screenCanvasFs');

	if (!isFullScreen) {
		if (elem.requestFullScreen) {
			elem.requestFullScreen();
		} else if (elem.msRequestFullscreen) {
			elem.msRequestFullscreen();
		} else if (elem.mozRequestFullScreen) {
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullScreen) {
			elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
		} else {
			alert('Fullscreen not supported. Try Firefox or Chrome.');
		}
	}
}

main.exitFullscreen = function () {
	var isFullScreen = document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement || document.fullscreenElement;
	if (isFullScreen) {
		if (document.cancelFullScreen) {
			document.cancelFullScreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		} else if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		} else if (document.webkitCancelFullScreen) {
			document.webkitCancelFullScreen();
		}
	}
}

main.stop = false;

main.start = function () {

	memoryManager.kernel = new Rom(0xe000, romDump.kernel);
	memoryManager.basic = new Rom(0xa000, romDump.basic);
	memoryManager.character = new Rom(0x0000, romDump.character);

	cpuMemoryManager.init();
	mos6510.init(cpuMemoryManager);
	vic2.init(vicMemoryManager);
    sid.init()

	var badLine = false;
	var cpuCycles = 0;
	var frameInterlaceToggle = 0;

	var doCycles = function () {

		frameInterlaceToggle++;
		if (frameInterlaceToggle > 0)
			frameInterlaceToggle = 0;

		/* (504 * 312) / 8 = 19656 */
		for (var i = 0; i < 19656; i++) {

			if (!badLine) {
				// High phase
				if (cpuCycles == 0) {
					cpuCycles = mos6510.process();
				}

				if (cpuCycles == 0) {
					console.log('pc: ' + mos6510.register.pc.toString(16));
					main.stop = true;
				}

				cpuCycles--;
			}
			// Low phase
			badLine = vic2.process(i, frameInterlaceToggle);

			if (main.stop) {
				break;
			}
		}

		// This should be in the clock loop, but it didn't work for now
		memoryManager.cia1.process(19656);
		memoryManager.cia2.process(19656);

		if (!main.stop) {
			window.requestAnimFrame(doCycles);
		} else {
			console.log('stopped!');
		}
	}

	doCycles();
}
