var memoryManager = memoryManager || {};
memoryManager.cia1 = memoryManager.cia1 || {};

memoryManager.cia1.getKeyboardMatrixCol = function() {
	// TODO: support that several cols are selected at one time
	var col = keyboard.currentMatrixValue[1];
	return col;
}

memoryManager.cia1.getKeyboardMatrixRow = function() {
	// TODO: support that several rows are selected at one time
	var row = keyboard.currentMatrixValue[0];
	return row;
}

memoryManager.cia1.directionOfPortA = 0x00;
memoryManager.cia1.directionOfPortB = 0x00;

memoryManager.cia1.timer_A = 0x0000;
memoryManager.cia1.timer_A_latch = 0x0000;
memoryManager.cia1.timer_A_isStarted = false;
memoryManager.cia1.timer_A_underflow = false;
memoryManager.cia1.timer_A_restartOnUnderflow = false;
memoryManager.cia1.timer_A_irq_enabled = false;

memoryManager.cia1.timer_B = 0x0000;
memoryManager.cia1.timer_B_latch = 0x0000;
memoryManager.cia1.timer_B_isStarted = false;
memoryManager.cia1.timer_B_underflow = false;
memoryManager.cia1.timer_B_restartOnUnderflow = false;
memoryManager.cia1.timer_B_irq_enabled = false;

memoryManager.cia1.tod = {
	tenthSecondsBCD: 0x00,
	alarmTenthSecondsBCD: 0x00
}

memoryManager.cia1.rows = 0x00;

memoryManager.cia1.onWriteByte = function(address, data) {
	switch(address & 0x000f) { // The CIA 1 register are according to https://www.c64-wiki.com/wiki/CIA mirrored each 16 Bytes
		// data port A	- when read/write: keyboard matrix rows
		case 0x00:
			// keyboard row
			memoryManager.cia1.rows = data & memoryManager.cia1.directionOfPortA;
			break;
		// data port B
		case 0x01:
			break;
		// direction of data port A (0 = read only, 1 = read and write)
		case 0x02:
			console.log('direction of port a: ' + data.toString(2));
			memoryManager.cia1.directionOfPortA = data;
			break;
		// direction of data port B (0 = read only, 1 = read and write)
		case 0x03:
			console.log('direction of port b: ' + data.toString(2));
			memoryManager.cia1.directionOfPortB = data;
			break;
		case 0x04:
			memoryManager.cia1.timer_A_latch = (memoryManager.cia1.timer_A_latch & 0xff00) | data;
			break;
		case 0x05:
			memoryManager.cia1.timar_A_latch = (memoryManager.cia1.timer_A_latch & 0x00ff) | (data << 8);
			break;
		case 0x06:
			memoryManager.cia1.timer_B_latch = (memoryManager.cia1.timer_B_latch & 0xff00) | data;
			break;
		case 0x07:
			memoryManager.cia1.timer_B_latch = (memoryManager.cia1.timer_B_latch & 0x00ff) | (data << 8);
			break;
		/* 0x08 - 0x0b = TOD */
		/* 0x0c = The byte within this register will be shifted bitwise to or from the SP-pin with every positive slope at the CNT-pin. */
		case 0x0d:
			/* TODO: rest */
			memoryManager.cia1.timer_A_irq_enabled = (data & 0x01) > 0;
			memoryManager.cia1.timer_B_irq_enabled = (data & 0x02) > 0;

			// unsure if this this is correct behaivor
			if ((data & 0x80) == 0) {
				memoryManager.cia1.timer_A_irq_enabled  = false;
				memoryManager.cia1.timer_B_irq_enabled  = false;
			} else {
				memoryManager.cia1.timer_A_irq_enabled = true;
				memoryManager.cia1.timer_B_irq_enabled = true;
			}
			break;
		case 0x0e:
			/* TODO: rest */
			memoryManager.cia1.timer_A_isStarted = (data & 0x01) > 0;
			memoryManager.cia1.timer_A_restartOnUnderflow = (data & 0x08) == 0;
			if ((data & 0x10) > 0)
				memoryManager.cia1.timer_A = memoryManager.cia1.timer_A_latch;
			break;
		case 0x0f:
			/* TODO: rest */
			memoryManager.cia1.timer_B_isStarted = (data & 0x01) > 0;
			memoryManager.cia1.timer_B_restartOnUnderflow = (data & 0x08) == 0;
			if ((data & 0x10) > 0)
				memoryManager.cia1.timer_B = memoryManager.cia1.timer_B_latch;
			break;
		default:
			break;
	}
};

memoryManager.cia1.onReadByte = function(address) {
	switch(address & 0x000f) { // The CIA 1 register are according to https://www.c64-wiki.com/wiki/CIA mirrored each 16 Bytes
		// data port A	- joystick port 2
		case 0x00:
			return keyboard.getJoyStickByte(1) ^ 0xff;
		// data port B
		case 0x01:
			// when read/write state: keyboard matrix cols
			// when read state: joystick port 1
			// seems like read/write state has no function here
			if ((memoryManager.cia1.rows == 0xff) || (memoryManager.cia1.rows == 0x00))
				return ((memoryManager.cia1.rows ^ 0xff) | keyboard.getJoyStickByte(0)) ^ 0xff;
			var keyboardColVal = (keyboard.row[memoryManager.cia1.rows ^ 0xff] || 0x00);
			return (keyboardColVal | keyboard.getJoyStickByte(0)) ^ 0xff;

		// direction of data port A (0 = read only, 1 = read and write)
		case 0x02:
			return memoryManager.cia1.directionOfPortA;
		// direction of data port B (0 = read only, 1 = read and write)
		case 0x03:
			return memoryManager.cia1.directionOfPortB;
		case 0x04:
			return memoryManager.cia1.timer_A & 0x00ff;
		case 0x05:
			return (memoryManager.cia1.timerA & 0xff00) >> 8;
		case 0x06:
			return memoryManager.cia1.timer_B & 0x00ff;
		case 0x07:
			return (memoryManager.cia1.timer_B & 0xff00) >> 8;
		/* 0x08 - 0x0b = TOD */
		// READ; Bit 0..3: Tenth seconds in BCD-format ($0-$9), Bit 4..7: always 0
		case 0x08:
			// debug only
			return ~~(Math.random() * 10);
		// Bit 0..3: Single seconds in BCD-format ($0-$9), Bit 4..6: Ten seconds in BCD-format ($0-$5), Bit 7: always 0
		case 0x09:
			// debug only
			return ~~(Math.random() * 10);
		// Bit 0..3: Single minutes in BCD-format( $0-$9), Bit 4..6: Ten minutes in BCD-format ($0-$5), Bit 7: always 0
		case 0x0A:
			// debug only
			return 0x48;
		// Bit 0..3: Single hours in BCD-format ($0-$9), Bit 4..6: Ten hours in BCD-format ($0-$5), Bit 7: Differentiation AM/PM, 0=AM, 1=PM
		// Writing into this register stops TOD, until register 8 (TOD 10THS) will be read.
		case 0x0B:
			// debug only
			return 0x11;
		/* 0x0c = The byte within this register will be shifted bitwise to or from the SP-pin with every positive slope at the CNT-pin. */
		case 0x0d:
			/* TODO */
			break;
		case 0x0e:
			/* TODO */
			break;
		default:
			break;
	}
};

memoryManager.cia1.process = function(clockTicksElapsed) {

	// Timer A
	if (this.timer_A_isStarted) {
		if (this.timer_A > 0) {
			this.timer_A -= clockTicksElapsed;
		}
		else {
			this.timer_A = 0;
		}
		if (this.timer_A <= 0) {
			if (this.timer_A_restartOnUnderflow) {
				this.timer_A = this.timer_A_latch;
			} else {
				this.timer_A_underflow = true;
				this.timer_A_isStarted = false;
			}

			if (this.timer_A_irq_enabled) {
				mos6510.irq = true;
			}
		}
	}

	// Timer B
	if (this.timer_B_isStarted) {
		if (this.timer_B > 0) {
			this.timer_B -= clockTicksElapsed;
		}
		else {
			this.timer_B = 0;
		}
		if (this.timer_B <= 0) {
			if (this.timer_B_restartOnUnderflow) {
				this.timer_B = this.timer_B_latch;
			} else {
				this.timer_B_underflow = true;
				this.timer_B_isStarted = false;
			}

			if (this.timer_B_irq_enabled) {
				mos6510.irq = true;
			}
		}
	}
};
