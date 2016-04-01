var keyboard = keyboard || {};

keyboard.keyMapMac = [
	8, 13, 18, 118, 112, 114, 116, 93,
	51, 87, 65, 52, 90, 83, 69, 1017,
	53, 82, 68, 54, 67, 70, 84, 88,
	55, 89, 71, 56, 66, 72, 85, 86,
	57, 73, 74, 48, 77, 75, 79, 78,
	187, 80, 76, 219, 190, 186, 221, 188,
	123, 220, 222, 192, 1018, 191, 36, 189,
	49, 9, 17, 50, 32, 17, 81, 27
];

keyboard.row = [];

keyboard.leftShiftIsDown = false;
keyboard.rightShiftIsDown = false;

keyboard.joystickUp = false;
keyboard.joystickDown = false;
keyboard.joystickLeft = false;
keyboard.joystickRight = false;
keyboard.fire = false;
keyboard.connectedJoystickPort = 1;

keyboard.getJoyStickByte = function(port) {
	if (port == keyboard.connectedJoystickPort) {
		return ((keyboard.joystickUp ? 0x01 : 0x00) |
			(keyboard.joystickDown ? 0x02 : 0x00) |
			(keyboard.joystickLeft ? 0x04 : 0x00) |
			(keyboard.joystickRight ? 0x08 : 0x00) |
			(keyboard.joystickFire ? 0x10 : 0x00));
	}
	else {
		return 0x00;
	}
}

document.onkeyup = function(e) {
	
	if ((e.keyCode >= 37) && (e.keyCode <= 40)) {
		keyboard.joystickUp = false;
		keyboard.joystickDown = false;
		keyboard.joystickLeft = false;
		keyboard.joystickRight = false;
	}
	
	if (e.keyCode == 32)
		keyboard.joystickFire = false;
	
	// Shift key
	if (e.keyCode == 16) {
		// left side
		if (e.location == 1) {
			keyboard.leftShiftIsDown = false;
			keyboard.row[0x02] = keyboard.row[0x02] & 0x7f;
		}
		// right side
		if (e.location == 2) {
			keyboard.rightShiftIsDown = false;
			keyboard.row[0x40] = keyboard.row[0x40] & 0xef; 
		}
	}
	
	var keyCode = e.keyCode;
	
	if (keyboard.rightShiftIsDown) {
		if (e.keyCode == 222)					// On Mac this key is changing code (2/")
			keyCode = 50; 
	}
	
	var keyboardMapValue = keyboard.keyMapMac.indexOf(keyCode);
	
	if (keyboardMapValue > -1) {
		var row = Math.floor(keyboardMapValue / 8);
		var col = (keyboardMapValue % 8);
		keyboard.row[1 << row] = ((keyboard.row[1 << row] & (1 << col)) > 0) ? keyboard.row[1 << row] - (1 << col) : keyboard.row[1 << row];
	}
	
};

document.onkeydown = function(e) {
	var doPrevent = false;
	
	// Disable the default actions for the F-keys + tab key
	var functionKeys = [112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 123, 9];
	if (functionKeys.indexOf(e.keyCode) > -1 || functionKeys.indexOf(e.which) > -1) {
		e.preventDefault();
	}
	
	// Prevent backspace to navigate back in the browser, but keep the function in some elements
	if (e.keyCode === 8) {
		var d = e.srcElement || e.target;
		if ((d.tagName.toLowerCase() === 'input' && 
			(
				d.type.toLowerCase() === 'text' 		||
				d.type.toLowerCase() === 'password' 	|| 
				d.type.toLowerCase() === 'file' 		|| 
				d.type.toLowerCase() === 'search' 		|| 
				d.type.toLowerCase() === 'email' 		|| 
				d.type.toLowerCase() === 'number' 		|| 
				d.type.toLowerCase() === 'date' )
			) || 
			d.tagName.toLowerCase() === 'textarea') {
			doPrevent = d.readOnly || d.disabled;
		}
		else {
			doPrevent = true;
		}
	}

	if (doPrevent) {
		e.preventDefault();
	}
	
	if (e.keyCode == 38)
		keyboard.joystickUp = true;
	if (e.keyCode == 40)
		keyboard.joystickDown = true;
	if (e.keyCode == 37)
		keyboard.joystickLeft = true;
	if (e.keyCode == 39)
		keyboard.joystickRight = true;
	if (e.keyCode == 32)
		keyboard.joystickFire = true;
	
	if (e.keyCode == 16) {
		// left side
		if (e.location == 1) {
			keyboard.leftShiftIsDown = true;
			keyboard.row[0x02] = keyboard.row[0x02] | 0x80;
		}
		// right side
		if (e.location == 2) {
			keyboard.rightShiftIsDown = true;
			keyboard.row[0x40] = keyboard.row[0x40] | 0x10; 
		}
	}
	
	var keyCode = e.keyCode;
	
	if (e.shiftKey) {
		if (e.keyCode == 222) {									// On Mac this key is changing code (2/")
			keyCode = 50;
		}
	}
	
	var keyboardMapValue = keyboard.keyMapMac.indexOf(keyCode);
	if (keyboardMapValue > -1) {
		var row = Math.floor(keyboardMapValue / 8);
		var col = (keyboardMapValue % 8);
		keyboard.row[1 << row] = keyboard.row[1 << row] | 1 << col;
	}
};