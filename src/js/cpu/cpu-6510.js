// TODO: Implement more illegal opcodes, so far SKB (skip next byte) is implemented
var mos6510 = mos6510 || {};

mos6510.memory = null;

mos6510.register = {
	a: 0x00,
	x: 0x00,
	y: 0x00,
	status: {
		//NV-BDIZC
		negative: false, overflow: false, break: false, decimal: false, interrupt: true, zero: false, carry: false,
		getStatusByte: function () {
			var statusByte = (this.negative ? 0x80 : 0) | (this.overflow ? 0x40 : 0) | 0x20 |
				(this.break ? 0x10 : 0) | (this.decimal ? 0x08 : 0) | (this.interrupt ? 0x04 : 0) |
				(this.zero ? 0x02 : 0) | (this.carry ? 0x01 : 0);
			return statusByte;
		},
		setStatusFlags: function (byte) {
			this.negative = (byte & 0x80) > 0;
			this.overflow = (byte & 0x40) > 0;
			this.break = (byte & 0x10) > 0;
			this.decimal = (byte & 0x08) > 0;
			this.interrupt = (byte & 0x04) > 0;
			this.zero = (byte & 0x02) > 0;
			this.carry = (byte & 0x01) > 0;
		}
	},
	sp: 0xff,
	pc: 0x0000,
};

mos6510.reset = function () {
	this.instructions.rst();
};

mos6510.pushToStack = function (byte) {
	mos6510.memory.writeByte(0x0100 + mos6510.register.sp, byte);
	if (--mos6510.register.sp < 0x00)
		mos6510.register.sp = 0xff;
};

mos6510.popFromStack = function () {
	if (++mos6510.register.sp > 0xff)
		mos6510.register.sp = 0;
	return mos6510.memory.readByte(0x0100 + (mos6510.register.sp));
};

mos6510.init = function (memoryModule) {
	this.memory = memoryModule;
	this.register.pc = mos6510.memory.readByte(0xfffc) | (mos6510.memory.readByte(0xfffd) << 8);
};

mos6510.getNextInstruction = function () {
	return this.memory.readByte(this.register.pc++);
};

mos6510.addressModeOperations = {
	Immediate: function () {
		return {
			valueAddr: mos6510.getNextInstruction(),
			pageBoundaryCrossed: false
		};
	},
	ZeroPage: function (isValue) {
		var addr = mos6510.getNextInstruction();
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: false
		};
	},
	ZeroPageX: function (isValue) {
		var addr = (mos6510.getNextInstruction() + mos6510.register.x) & 0xff;
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: false
		};
	},
	ZeroPageY: function (isValue) {
		var addr = (mos6510.getNextInstruction() + mos6510.register.y) & 0xff;
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: false
		};
	},
	Absolute: function (isValue) {
		var addr = mos6510.getNextInstruction() | (mos6510.getNextInstruction() << 8);
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: false
		};
	},
	AbsoluteX: function (isValue) {
		var memoryValue = mos6510.getNextInstruction() | (mos6510.getNextInstruction() << 8);
		var addr = (memoryValue + mos6510.register.x) & 0xffff;
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: ((memoryValue & 0xff00) != (addr & 0xff00)) ? true : false
		};
	},
	AbsoluteY: function (isValue) {
		var memoryValue = mos6510.getNextInstruction() | (mos6510.getNextInstruction() << 8);
		var addr = (memoryValue + mos6510.register.y) & 0xffff;
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: ((memoryValue & 0xff00) != (addr & 0xff00)) ? true : false
		};
	},
	IndirectX: function (isValue) {
		var argx = (mos6510.getNextInstruction() + mos6510.register.x) & 0xff;
		var addr = mos6510.memory.readByte(argx) | (mos6510.memory.readByte(argx + 1 & 0xff) << 8);
		return {
			valueAddr: isValue ? mos6510.memory.readByte(addr) : addr,
			pageBoundaryCrossed: false
		}
	},
	IndirectY: function (isValue) {
		var arg = mos6510.getNextInstruction();
		var lowBaseAddr = mos6510.memory.readByte(arg);
		var highBaseAddr = (mos6510.memory.readByte((arg + 1) & 0xff) << 8);
		var baseAddr = lowBaseAddr | highBaseAddr;
		var yAddr = (baseAddr + mos6510.register.y) & 0xffff;
		return {
			valueAddr: isValue ? mos6510.memory.readByte(yAddr) : yAddr,
			pageBoundaryCrossed: ((baseAddr & 0xff00) != (yAddr & 0xff00))
		}
	},
	Relative: function () {
		var relAddr = mos6510.getNextInstruction();
		if ((relAddr & 0x80) > 0)
			relAddr -= 0x100;
		return {
			valueAddr: relAddr,
			pageBoundaryCrossed: ((mos6510.register.pc & 0xff00) != ((mos6510.register.pc + relAddr) & 0xff00))
		}
	}
};

mos6510.instructions = {
	adc: function (value) {
		var result;
		if (mos6510.register.status.decimal) {
			result = (mos6510.register.a & 0x0f) + (value & 0x0f) + (mos6510.register.status.carry ? 1 : 0);
			if (result > 0x09)
				result += 0x06;
			if (result <= 0x0f)
				result = (result & 0x0f) + (mos6510.register.a & 0xf0) + (value & 0xf0);
			else
				result = (result & 0x0f) + (mos6510.register.a & 0xf0) + (value & 0xf0) + 0x10;

			mos6510.register.status.zero = !((mos6510.register.a + value + (mos6510.register.status.carry ? 1 : 0)) & 0xff)
			mos6510.register.status.negative = (result & 0x80) > 0;
			mos6510.register.status.overflow = (((mos6510.register.a ^ result) & 0x80) > 0) && !((mos6510.register.a ^ value) & 0x80);
			if ((result & 0x1f0) > 0x90)
				result += 0x60;
			mos6510.register.status.carry = (result & 0xff0) > 0xf0;
		}
		else {
			result = mos6510.register.a + value + (mos6510.register.status.carry ? 1 : 0);
			mos6510.register.status.zero = (result & 0xff) == 0;
			mos6510.register.status.negative = ((result & 0xff) & 0x80) > 0;
			mos6510.register.status.overflow = !((mos6510.register.a ^ value) & 0x80) && (((mos6510.register.a ^ result) & 0x80) > 0)
			mos6510.register.status.carry = result > 0xff;
		}
		mos6510.register.a = result & 0xff;
	},
	alr: function (value) {
		mos6510.register.a = (mos6510.register.a & value);
		mos6510.register.status.carry = (mos6510.register.a & 0x01) > 0;
		mos6510.register.a = mos6510.register.a >> 1;
		mos6510.register.status.negative = false;
		mos6510.register.status.zero = mos6510.register.a == 0;
	},
	anc: function (value) {
		mos6510.instructions.and(value);
		mos6510.register.status.carry = (mos6510.register.a & 0x80) > 0;
	},
	and: function (value) {
		mos6510.register.a &= value;
		mos6510.register.status.zero = mos6510.register.a == 0;
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
	},
	ane: function (value) {
		// This is an illegal instruction and is not safe to use.
		// The constant $ee can vary, and is depending on chip and/or temperature 
		mos6510.register.a = (mos6510.register.a | 0xee) & mos6510.register.x & value;
		mos6510.register.status.zero = mos6510.register.a == 0;
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
	},
	arr: function (value) {
		var andResult = mos6510.register.a & value;
		mos6510.register.a = andResult >> 1;

		if (mos6510.register.status.carry)
			mos6510.register.a |= 0x80;

		mos6510.register.status.zero = mos6510.register.a == 0;

		if (mos6510.register.status.decimal) {
			mos6510.register.status.negative = mos6510.register.status.carry;
			mos6510.register.status.overflow = (mos6510.register.a & 0x40) != (andResult & 0x40);
			
			// BCD fix up
			var andAl = andResult & 0x0f;
			var andAh = andResult >> 4;

			if (andAl + (andAl & 1) > 5)
				mos6510.register.a = (mos6510.register.a & 0xf0) | ((mos6510.register.a + 6) & 0x0f);

			if (andAh + (andAh & 1) > 5) {
				mos6510.register.status.carry = true;
				mos6510.register.a = (mos6510.register.a + 0x60) & 0xff;
			} else {
				mos6510.register.status.carry = false;
			}
		} else {
			mos6510.register.status.overflow = (((mos6510.register.a & 0x40) >> 1) ^ ((mos6510.register.a & 0x20))) > 0;
			mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
			mos6510.register.status.carry = (mos6510.register.a & 0x40) > 0;
		}
	},
	asl: function (value) {
		mos6510.register.status.carry = (value & 0x80) > 0;
		value = (value << 1) & 0xff;
		mos6510.register.status.zero = (value == 0);
		mos6510.register.status.negative = (value & 0x80) > 0;
		return value;
	},
	bcc: function (addr) {
		if (mos6510.register.status.carry === false) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bcs: function (addr) {
		if (mos6510.register.status.carry === true) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	beq: function (addr) {
		if (mos6510.register.status.zero === true) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bit: function (value) {
		mos6510.register.status.negative = (value & 0x80) > 0;
		mos6510.register.status.overflow = (value & 0x40) > 0;
		mos6510.register.status.zero = ((mos6510.register.a & value) == 0);
	},
	bmi: function (addr) {
		if (mos6510.register.status.negative === true) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bne: function (addr) {
		if (mos6510.register.status.zero === false) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bpl: function (addr) {
		if (mos6510.register.status.negative === false) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bvc: function (addr) {
		if (mos6510.register.status.overflow === false) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	bvs: function (addr) {
		if (mos6510.register.status.overflow === true) {
			mos6510.register.pc += addr;
			return true;
		}
		return false;
	},
	cmp: function (value) {
		var t = (mos6510.register.a - value) >>> 0;
		mos6510.register.status.carry = (mos6510.register.a >= (value & 0xff));
		mos6510.register.status.zero = (mos6510.register.a == (value & 0xff));
		mos6510.register.status.negative = (t & 0x80) > 0;
	},
	cpx: function (value) {
		var t = (mos6510.register.x - value) >>> 0;
		mos6510.register.status.carry = (mos6510.register.x >= (value & 0xff));
		mos6510.register.status.zero = (mos6510.register.x == (value & 0xff));
		mos6510.register.status.negative = (t & 0x80) > 0;
	},
	cpy: function (value) {
		var t = (mos6510.register.y - value) >>> 0;
		mos6510.register.status.carry = (mos6510.register.y >= (value & 0xff));
		mos6510.register.status.zero = (mos6510.register.y == (value & 0xff));
		mos6510.register.status.negative = (t & 0x80) > 0;
	},
	dec: function (value) {
		value = (value - 1) & 0xff;
		mos6510.register.status.negative = (value & 0x80) > 0
		mos6510.register.status.zero = (value == 0)
		return value;
	},
	eor: function (value) {
		mos6510.register.a = (mos6510.register.a ^ value) & 0xff;
		mos6510.register.status.zero = (mos6510.register.a == 0);
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
	},
	inc: function (value) {
		value = (value + 1) & 0xff;
		mos6510.register.status.negative = (value & 0x80) > 0;
		mos6510.register.status.zero = (value == 0);
		return value;
	},
	irq: function () {
		mos6510.pushToStack((mos6510.register.pc & 0xff00) >> 8);
		mos6510.pushToStack(mos6510.register.pc & 0x00ff);
		mos6510.pushToStack(mos6510.register.status.getStatusByte() & 0xef);  // clearing the break flag
		mos6510.register.pc = mos6510.memory.readByte(0xfffe) | (mos6510.memory.readByte(0xffff) << 8);
	},
	jmp: function (addr, isIndirect) {
		if (isIndirect)
			addr = (mos6510.memory.readByte(addr) + (mos6510.memory.readByte(addr + 1) << 8))
		mos6510.register.pc = addr;
	},
	jsr: function (addr) {
		mos6510.pushToStack((mos6510.register.pc - 1 & 0xff00) >> 8);
		mos6510.pushToStack(mos6510.register.pc - 1 & 0x00ff);
		mos6510.register.pc = addr;
	},
	lda: function (value) {
		mos6510.register.a = value;
		mos6510.register.status.zero = (mos6510.register.a == 0);
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
	},
	ldx: function (value) {
		mos6510.register.x = value;
		mos6510.register.status.zero = (mos6510.register.x == 0);
		mos6510.register.status.negative = (mos6510.register.x & 0x80) > 0;
	},
	ldy: function (value) {
		mos6510.register.y = value;
		mos6510.register.status.zero = (mos6510.register.y == 0);
		mos6510.register.status.negative = (mos6510.register.y & 0x80) > 0;
	},
	lsr: function (value) {
		mos6510.register.status.negative = false;
		mos6510.register.status.carry = (value & 0x01) > 0
		value = value >> 1;
		mos6510.register.status.zero = (value == 0);
		return value;
	},
	nmi: function () {
		mos6510.pushToStack((mos6510.register.pc & 0xff00) >> 8);
		mos6510.pushToStack(mos6510.register.pc & 0x00ff);
		mos6510.pushToStack(mos6510.register.status.getStatusByte() & 0xef);  // clearing the break flag
		mos6510.register.pc = mos6510.memory.readByte(0xfffa) | (mos6510.memory.readByte(0xfffb) << 8);
	},
	ora: function (value) {
		mos6510.register.a |= value;
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
		mos6510.register.status.zero = (mos6510.register.a == 0);
	},
	rol: function (value) {
		var t = value & 0x80;
		var result = value << 1 & 0xfe;
		result = result | (mos6510.register.status.carry ? 0x01 : 0x00);
		mos6510.register.status.carry = t > 0;
		mos6510.register.status.negative = (result & 0x80) > 0;
		mos6510.register.status.zero = (result == 0);
		return result;
	},
	ror: function (value) {
		var t = value & 0x01;
		var result = value >> 1 & 0x7f;
		result = result | (mos6510.register.status.carry ? 0x80 : 0x00);
		mos6510.register.status.carry = t > 0;
		mos6510.register.status.negative = (result & 0x80) > 0;
		mos6510.register.status.zero = (result == 0);
		return result;
	},
	rst: function () {
		mos6510.register.pc = mos6510.memory.readByte(0xfffc) | (mos6510.memory.readByte(0xfffd) << 8);
	},
	sbc: function (value) {
		var result = ((mos6510.register.a - value - (mos6510.register.status.carry ? 0 : 1)) >>> 0) & 0xffff;

		if (mos6510.register.status.decimal) {
			var result_decimal = (((mos6510.register.a & 0x0f) - (value & 0x0f) - (mos6510.register.status.carry ? 0 : 1)) >>> 0) & 0xffff;
			if (result_decimal & 0x10)
				result_decimal = ((result_decimal - 6) & 0x0f) | ((mos6510.register.a & 0xf0) - (value & 0xf0) - 0x10);
			else
				result_decimal = (result_decimal & 0x0f) | ((mos6510.register.a & 0xf0) - (value & 0xf0));
			if (result_decimal & 0x100)
				result_decimal -= 0x60;
		}

		mos6510.register.status.carry = (result < 0x100);
		mos6510.register.status.negative = (result & 0x80) > 0;
		mos6510.register.status.zero = (result & 0xff) == 0;
		mos6510.register.status.overflow = (((mos6510.register.a ^ result) & 0x80) > 0) && (((mos6510.register.a ^ value) & 0x80) > 0);

		mos6510.register.a = mos6510.register.status.decimal ? result_decimal & 0xff : result & 0xff;
	},
	sta: function (addr) {
		mos6510.memory.writeByte(addr, mos6510.register.a);
	},
	stx: function (addr) {
		mos6510.memory.writeByte(addr, mos6510.register.x);
	},
	sty: function (addr) {
		mos6510.memory.writeByte(addr, mos6510.register.y);
	}
};

mos6510.instructionMap = {
	0x00: function () {																			// BRK 
		++mos6510.register.pc;
		mos6510.pushToStack((mos6510.register.pc & 0xff00) >> 8);
		mos6510.pushToStack(mos6510.register.pc & 0x00ff);
		mos6510.pushToStack(mos6510.register.status.getStatusByte() | 0x10);
		mos6510.register.status.break = true
		mos6510.register.status.interrupt = true;
		mos6510.register.pc = mos6510.memory.readByte(0xfffe) | (mos6510.memory.readByte(0xffff) << 8);
		return 7;
	},
	0x01: function () {																			// ORA ($85,X) 
		mos6510.instructions.ora(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0x03: function() {																			// SLO ($44,X) -- ilegal opcode
		var addr = mos6510.addressModeOperations.IndirectX(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 8;
	},
	0x04: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x05: function () {																			// ORA $85 
		mos6510.instructions.ora(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 2;
	},
	0x06: function () {																			// ASL $85 
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0x07: function() {																			// SLO $85 -- illegal opcode
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 5;
	},
	0x08: function () {																			// PHP
		mos6510.pushToStack(mos6510.register.status.getStatusByte() | 0x10);
		return 3;
	},
	0x09: function () {																			// ORA #$85
		mos6510.instructions.ora(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x0a: function () {																			// ASL A
		mos6510.register.a = mos6510.instructions.asl(mos6510.register.a);
		return 2;
	},
	0x0b: function () {																			// ANC #$85 - illegal opcode
		mos6510.instructions.anc(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x0d: function () {																			// ORA $A5B6 
		mos6510.instructions.ora(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0x0e: function () {																			// ASL $4400
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0x0f: function() {																			// SLO $4443 -- ilegal opcode
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 7;
	},

	0x10: function () {																			// BPL $A5 
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bpl(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0x11: function () { 																		// ORA ($A5),Y
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.ora(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0x13: function() {																			// SLO ($44),Y -- illegal opcode
		var addr = mos6510.addressModeOperations.IndirectY(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 8;
	},
	0x14: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x15: function () {																			// ORA $A5,X 
		mos6510.instructions.ora(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 3;
	},
	0x16: function () {																			// ASL $44,X 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0x17: function() {																			// SLO $44,X -- illegal opcode
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 6;
	},
	0x18: function () {																			// CLC
		mos6510.register.status.carry = false;
		return 2;
	},
	0x19: function () {																			// ORA $A5B6,Y 
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.ora(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x1b: function() {																			// SLO $4400,Y -- ilegal opcode
		var addr = mos6510.addressModeOperations.AbsoluteY(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 7;
	},
	0x1d: function () { 																		// ORA $A5B6,X 
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.ora(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x1e: function () { 																		// ASL $4400,X
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 7;
	},
	0x1f: function() {																			// SLO $4400,X -- ilegal opcode
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.asl(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		mos6510.instructions.ora(mos6510.memory.readByte(addr));
		return 7;
	},

	0x20: function () {																			// JSR $A5B6 
		mos6510.instructions.jsr(mos6510.addressModeOperations.Absolute(false).valueAddr);
		return 6;
	},
	0x21: function () {																			// AND ($A5,X)
		mos6510.instructions.and(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},

	0x24: function () {																			// BIT $A5
		mos6510.instructions.bit(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 4;
	},
	0x25: function () {																			// AND $A5 
		mos6510.instructions.and(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 2;
	},
	0x26: function () {																			// ROL $A5 
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.rol(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0x28: function () {																			// PLP
		mos6510.register.status.setStatusFlags(mos6510.popFromStack());
		return 4;
	},
	0x29: function () {																			// AND #$A5
		mos6510.instructions.and(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x2a: function () {																			// ROL A
		mos6510.register.a = mos6510.instructions.rol(mos6510.register.a);
		return 2;
	},
	0x2b: function () {																			// ANC #$85 - illegal opcode
		mos6510.instructions.anc(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x2c: function () {																			// BIT $A5B6 
		mos6510.instructions.bit(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0x2d: function () {																			// AND $A5B6
		mos6510.instructions.and(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0x2e: function () { 																		// ROL $A5B6
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.rol(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},

	0x30: function () {																			//  BMI $A5
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bmi(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0x31: function () {																			// AND ($A5),Y 
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.and(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0x34: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x35: function () {																			// AND $A5,X 
		mos6510.instructions.and(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 3;
	},
	0x36: function () {																			// ROL $A5,X 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.rol(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0x38: function () {																			// SEC 
		mos6510.register.status.carry = true;
		return 2;
	},
	0x39: function () {																			// AND $A5B6,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.and(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x3d: function () {																			// AND $A5B6,X
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.and(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x3e: function () {																			// ROL $A5B6,X 
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.rol(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},

	0x40: function () {																			// RTI 
		mos6510.register.status.setStatusFlags(mos6510.popFromStack());
		var spl = mos6510.popFromStack();
		var sph = mos6510.popFromStack();
		mos6510.register.pc = spl | (sph << 8);
		return 6;
	},
	0x41: function () {																			// EOR ($A5,X)
		mos6510.instructions.eor(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0x44: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x45: function () {																			// EOR $A5 
		mos6510.instructions.eor(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0x46: function () {																			// LSR $A5 
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		mos6510.memory.writeByte(addr, mos6510.instructions.lsr(mos6510.memory.readByte(addr)));
		return 5;
	},
	0x48: function () {																			// PHA
		mos6510.pushToStack(mos6510.register.a);
		return 3;
	},
	0x49: function () {																			// EOR #$A5
		mos6510.instructions.eor(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x4a: function () {																			// LSR A 
		mos6510.register.a = mos6510.instructions.lsr(mos6510.register.a);
		return 2;
	},
	0x4b: function () {																			// ALR #$85 - illegal opcode
		mos6510.instructions.alr(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x4c: function () {																			// JMP $8532 
		mos6510.instructions.jmp(mos6510.addressModeOperations.Absolute(false).valueAddr, false);
		return 3;
	},
	0x4d: function () {																			// EOR $A5B6
		mos6510.instructions.eor(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0x4e: function () {																			// LSR $A5B6 
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		mos6510.memory.writeByte(addr, mos6510.instructions.lsr(mos6510.memory.readByte(addr)));
		return 6;
	},

	0x50: function () {																			// BVC $A5 
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bvc(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0x51: function () {																			// EOR ($A5),Y 
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.eor(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0x54: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x55: function () {																			// EOR $A5,X
		mos6510.instructions.eor(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0x56: function () {																			// LSR $A5,X 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		mos6510.memory.writeByte(addr, mos6510.instructions.lsr(mos6510.memory.readByte(addr)));
		return 6;
	},
	0x58: function () {																			// CLI 
		mos6510.register.status.interrupt = false;
		return 2;
	},
	0x59: function () {																			// EOR $A5B6,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.eor(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x5d: function () {																			// EOR $A5B6,X 
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.eor(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x5e: function () {																			// LSR $A5B6,X
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		mos6510.memory.writeByte(addr, mos6510.instructions.lsr(mos6510.memory.readByte(addr)));
		return 7;
	},

	0x60: function () {																			// RTS
		var l = mos6510.popFromStack();
		var h = mos6510.popFromStack();
		mos6510.register.pc = l + (h << 8) + 1;
		return 6;
	},
	0x61: function () {																			// ADC ($A5,X) 
		mos6510.instructions.adc(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0x64: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x65: function () {																			// ADC $A5 
		mos6510.instructions.adc(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0x66: function () {																			// ROR $A5  
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.ror(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0x68: function () { 																		// PLA
		mos6510.register.a = mos6510.popFromStack();
		mos6510.register.status.zero = mos6510.register.a == 0;
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
		return 4;
	},
	0x69: function () {																			// ADC #$A5
		mos6510.instructions.adc(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x6a: function () {																			// ROR A 
		mos6510.register.a = mos6510.instructions.ror(mos6510.register.a);
		return 2;
	},
	0x6b: function () {																			// ARR #$86 -- illegal opcode
		mos6510.instructions.arr(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x6c: function () {																			// JMP ($8532) 
		mos6510.instructions.jmp(mos6510.addressModeOperations.Absolute(false).valueAddr, true);
		return 5;
	},
	0x6d: function () {																			// ADC $A5B6 
		mos6510.instructions.adc(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 5;
	},
	0x6e: function () {																			// ROR $A5B6  
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.ror(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},

	0x70: function () {																			// BVS $A5 
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bvs(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0x71: function () {																			// ADC ($A5),Y 
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.adc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0x74: function () {																			// SKB -- illegal opcode
		return 2
	},
	0x75: function () {																			// ADC $A5,X
		mos6510.instructions.adc(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0x76: function () {																			// ROR $A5,X
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.ror(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0x78: function () {																			// SEI 
		mos6510.register.status.interrupt = true;
		return 2;
	},
	0x79: function () {																			// ADC $A5B6,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.adc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x7d: function () {																			// ADC $A5B6,X
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.adc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0x7e: function () {																			// ROR $A5B6,X
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.ror(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 7;
	},


	0x80: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x81: function () {																			// STA ($85,X) 
		var addr = mos6510.addressModeOperations.IndirectX(false).valueAddr;
		mos6510.instructions.sta(addr);
		return 6;
	},
	0x82: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0x83: function () {																			// SAX ($A5,X) -- illegal opcode
		var addr = mos6510.addressModeOperations.IndirectX(false).valueAddr;
		var result = (mos6510.register.a & mos6510.register.x) & 0xff;
		mos6510.memory.writeByte(addr, result);
		return 6;
	},
	0x84: function () {																			// STY $A5
		mos6510.instructions.sty(mos6510.addressModeOperations.ZeroPage(false).valueAddr);
		return 3;
	},
	0x85: function () {																			// STA $85
		mos6510.instructions.sta(mos6510.addressModeOperations.ZeroPage(false).valueAddr);
		return 3;
	},
	0x86: function () {																			// STX $A5
		mos6510.instructions.stx(mos6510.addressModeOperations.ZeroPage(false).valueAddr);
		return 3;
	},
	0x87: function () {																			// SAX $A5 -- illegal opcode
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var result = (mos6510.register.a & mos6510.register.x) & 0xff;
		mos6510.memory.writeByte(addr, result);
		return 3;
	},
	0x88: function () {																			// DEY 
		--mos6510.register.y;
		if (mos6510.register.y < 0)
			mos6510.register.y = 0xff;
		mos6510.register.status.zero = (mos6510.register.y == 0);
		mos6510.register.status.negative = (mos6510.register.y & 0x80) > 0;
		return 2;
	},
	0x89: function () {																			// SKB -- illegal opcode (nop instead?!?)
		mos6510.register.pc++
		return 2;
	},
	0x8a: function () {																			// TXA 
		mos6510.register.a = mos6510.register.x;
		mos6510.register.status.zero = (mos6510.register.a == 0);
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
		return 2;
	},
	0x8b: function () {																			// ANE -- illegal opcode
		mos6510.instructions.ane(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0x8c: function () {																			// STY $A5B6 
		mos6510.instructions.sty(mos6510.addressModeOperations.Absolute(false).valueAddr);
		return 4;
	},
	0x8d: function () {																			// STA $8532 
		mos6510.instructions.sta(mos6510.addressModeOperations.Absolute(false).valueAddr);
		return 4;
	},
	0x8e: function () {																			// STX $A5B6 
		mos6510.instructions.stx(mos6510.addressModeOperations.Absolute(false).valueAddr);
		return 4;
	},
	0x8f: function () {																			// SAX $A5E3 -- illegal opcode
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr
		var result = (mos6510.register.a & mos6510.register.x) & 0xff;
		mos6510.memory.writeByte(addr, result);
		return 4;
	},

	0x90: function () {																			// BCC $A5
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bcc(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0x91: function () {																			// STA ($85),Y 
		mos6510.instructions.sta(mos6510.addressModeOperations.IndirectY(false).valueAddr);
		return 6;
	},
	0x94: function () {																			// STY $A5,X
		mos6510.instructions.sty(mos6510.addressModeOperations.ZeroPageX(false).valueAddr);
		return 4;
	},
	0x95: function () {																			// STA $85,X
		mos6510.instructions.sta(mos6510.addressModeOperations.ZeroPageX(false).valueAddr);
		return 4;
	},
	0x96: function () {																			// STX $A5,Y
		mos6510.instructions.stx(mos6510.addressModeOperations.ZeroPageY(false).valueAddr);
		return 4;
	},
	0x97: function () {																			// SAX $A5,Y -- illegal opcode
		var addr = mos6510.addressModeOperations.ZeroPageY(false).valueAddr;
		var result = (mos6510.register.a & mos6510.register.x) & 0xff;
		mos6510.memory.writeByte(addr, result);
		return 4;
	},
	0x98: function () {																			// TYA 
		mos6510.register.a = mos6510.register.y;
		mos6510.register.status.zero = (mos6510.register.a == 0);
		mos6510.register.status.negative = (mos6510.register.a & 0x80) > 0;
		return 2;
	},
	0x99: function () {																			// STA $8532,Y
		mos6510.instructions.sta(mos6510.addressModeOperations.AbsoluteY(false).valueAddr);
		return 5;
	},
	0x9a: function () {																			// TXS
		mos6510.register.sp = mos6510.register.x;
		return 2;
	},
	0x9d: function () {																			// STA $8532,X
		mos6510.instructions.sta(mos6510.addressModeOperations.AbsoluteX(false).valueAddr);
		return 5;
	},

	0xa0: function () {																			// LDY #$A5
		mos6510.instructions.ldy(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xa1: function () {																			// LDA ($85,X)
		mos6510.instructions.lda(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0xa2: function () {																			// LDX #$85
		mos6510.instructions.ldx(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xa3: function () {																			// LAX ($D3,X) -- illegal opcode
		var value = mos6510.addressModeOperations.IndirectX(true).valueAddr;
		mos6510.register.a = value;
		mos6510.register.x = value;
		mos6510.register.status.zero = value == 0;
		mos6510.register.status.negative = (value & 0x80) > 0;
		return 6;
	},
	0xa4: function () {																			// LDY $A5
		mos6510.instructions.ldy(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xa5: function () {																			// LDA $85
		mos6510.instructions.lda(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xa6: function () {																			// LDX $85 
		mos6510.instructions.ldx(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xa7: function () {																			// LAX $D3 -- illegal opcode
		var value = mos6510.addressModeOperations.ZeroPage(true).valueAddr;
		mos6510.register.a = value;
		mos6510.register.x = value;
		mos6510.register.status.zero = value == 0;
		mos6510.register.status.negative = (value & 0x80) > 0;
		return 3;
	},
	0xa8: function () {																			// TAY
		mos6510.register.y = mos6510.register.a;
		mos6510.register.status.zero = (mos6510.register.y == 0);
		mos6510.register.status.negative = (mos6510.register.y & 0x80) > 0;
		return 2;
	},
	0xa9: function () {																			// LDA #$85
		mos6510.instructions.lda(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xaa: function () {																			// TAX 
		mos6510.register.x = mos6510.register.a;
		mos6510.register.status.zero = (mos6510.register.x == 0);
		mos6510.register.status.negative = (mos6510.register.x & 0x80) > 0;
		return 2;
	},
	0xac: function () {																			// LDY $A5B6
		mos6510.instructions.ldy(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xad: function () {																			// LDA $8532
		mos6510.instructions.lda(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xae: function () {																			// LDX $8532
		mos6510.instructions.ldx(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xaf: function () {																			// LAX $4343 -- illegal opcode
		var value = mos6510.addressModeOperations.Absolute(true).valueAddr;
		mos6510.register.a = value;
		mos6510.register.x = value;
		mos6510.register.status.zero = value == 0;
		mos6510.register.status.negative = (value & 0x80) > 0;
		return 4;
	},

	0xb0: function () {																			// BCS $32
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bcs(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0xb1: function () {																			// LDA ($85),Y
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.lda(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0xb3: function () {																			// LAX ($34),Y -- illegal opcode
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.lda(valueEnv.valueAddr);
		mos6510.instructions.ldx(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0xb4: function () {																			// LDY $A5,X
		mos6510.instructions.ldy(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0xb5: function () {																			// LDA $85,X
		mos6510.instructions.lda(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0xb6: function () {																			// LDX $85,Y
		mos6510.instructions.ldx(mos6510.addressModeOperations.ZeroPageY(true).valueAddr);
		return 4;
	},
	0xb7: function () {																			// LAX $43,Y -- illegal opcode
		var value = mos6510.addressModeOperations.ZeroPageY(true).valueAddr;
		mos6510.register.a = value;
		mos6510.register.x = value;
		mos6510.register.status.zero = value == 0;
		mos6510.register.status.negative = (value & 0x80) > 0;
		return 4;
	},
	0xb8: function () {																			// CLV
		mos6510.register.status.overflow = false;
		return 2;
	},
	0xb9: function () {																			// LDA $8532,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.lda(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xba: function () {																			// TSX 
		mos6510.register.x = mos6510.register.sp;
		mos6510.register.status.zero = (mos6510.register.x == 0);
		mos6510.register.status.negative = (mos6510.register.x & 0x80) > 0;
		return 2;
	},
	0xbc: function () {																			// LDY $A5B6,X
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.ldy(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xbd: function () {																			// LDA $8532,X
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.lda(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xbe: function () {																			// LDX $8532,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.ldx(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xbf: function () {																			// LAX $3432,Y -- illegal opcode
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.register.a = valueEnv.valueAddr;
		mos6510.register.x = valueEnv.valueAddr;
		mos6510.register.status.zero = valueEnv.valueAddr == 0;
		mos6510.register.status.negative = (valueEnv.valueAddr & 0x80) > 0;
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},

	0xc0: function () {																			// CPY #$A5
		mos6510.instructions.cpy(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xc1: function () {																			// CMP ($A5,X)
		mos6510.instructions.cmp(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0xc2: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0xc3: function () {																			// DCP ($65,X) -- illegal opcode 
		var addr = mos6510.addressModeOperations.IndirectX(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 8;
	},
	0xc4: function () {																			// CPY $A5
		mos6510.instructions.cpy(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xc5: function () {																			// CMP $A5
		mos6510.instructions.cmp(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xc6: function () {																			// DEC $A5
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0xc7: function () {																			// DCP $65 -- illegal opcode 
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0xc8: function () {																			// INY
		mos6510.register.y = (mos6510.register.y + 1) & 0xff;
		mos6510.register.status.zero = (mos6510.register.y == 0);
		mos6510.register.status.negative = (mos6510.register.y & 0x80) > 0;
		return 2;
	},
	0xc9: function () {																			// CMP #$A5
		mos6510.instructions.cmp(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xca: function () {																			// DEX
		--mos6510.register.x;
		if (mos6510.register.x < 0)
			mos6510.register.x = 0xff;
		mos6510.register.status.zero = (mos6510.register.x == 0);
		mos6510.register.status.negative = (mos6510.register.x & 0x80) > 0;
		return 2;
	},
	0xcc: function () {																			// CPY $A5B6 
		mos6510.instructions.cpy(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xcd: function () {																			// CMP $A5B6
		mos6510.instructions.cmp(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xce: function () {																			// DEC $A5B6 
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0xcf: function () {																			// DCP $A5B6 -- illegal opcode 
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 6;
	},

	0xd0: function () {																			// BNE $A5
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.bne(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0xd1: function () {																			// CMP ($A5),Y
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.cmp(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0xd3: function () {																			// DCP ($65),Y -- illegal opcode  
		var addr = mos6510.addressModeOperations.IndirectY(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 8;
	},
	0xd4: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0xd5: function () {																			// CMP $A5,X 
		mos6510.instructions.cmp(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0xd6: function () {																			// DEC $A5,X 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0xd7: function () {																			// DCP $65,X -- illegal opcode 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0xd8: function () {																			// CLD
		mos6510.register.status.decimal = false;
		return 2;
	},
	0xd9: function () {																			// CMP $A5B6,Y
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.cmp(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xdb: function () {																			// DCP $65F4,Y -- illegal opcode  
		var addr = mos6510.addressModeOperations.AbsoluteY(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 7;
	},
	0xdd: function () {																			// CMP $A5B6,X
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.cmp(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xde: function () {																			// DEC $A5B6,X 
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 7;
	},
	0xdf: function () {																			// DCP $A5B6,X -- illegal opcode 
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.dec(mos6510.memory.readByte(addr));
		mos6510.instructions.cmp(value);
		mos6510.memory.writeByte(addr, value);
		return 7;
	},

	0xe0: function () {																			// CPX #$A5
		mos6510.instructions.cpx(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xe1: function () {																			// SBC ($A5,X)
		mos6510.instructions.sbc(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 6;
	},
	0xe2: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0xe3: function () {																			// ISC ($54,X) -- illegal opcode
		mos6510.instructions.inc(mos6510.addressModeOperations.IndirectX(false).valueAddr);
		mos6510.instructions.sbc(mos6510.addressModeOperations.IndirectX(true).valueAddr);
		return 8;
	},
	0xe4: function () {																			// CPX $A5
		mos6510.instructions.cpx(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xe5: function () {																			// SBC $A5
		mos6510.instructions.sbc(mos6510.addressModeOperations.ZeroPage(true).valueAddr);
		return 3;
	},
	0xe6: function () {																			// INC $A5
		var addr = mos6510.addressModeOperations.ZeroPage(false).valueAddr;
		var value = mos6510.instructions.inc(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 5;
	},
	0xe8: function () {																			// INX
		mos6510.register.x = (mos6510.register.x + 1) & 0xff;
		mos6510.register.status.zero = (mos6510.register.x == 0);
		mos6510.register.status.negative = (mos6510.register.x & 0x80) > 0;
		return 2;
	},
	0xe9: function () {																			// SBC #$A5
		mos6510.instructions.sbc(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xea: function () {																			// NOP
		return 2;
	},
    0xeb: function () {																			// SBC #$A5 -- illegal opcode
		mos6510.instructions.sbc(mos6510.addressModeOperations.Immediate().valueAddr);
		return 2;
	},
	0xec: function () {																			// CPX $A5B6
		mos6510.instructions.cpx(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xed: function () {																			// SBC $A5B6
		mos6510.instructions.sbc(mos6510.addressModeOperations.Absolute(true).valueAddr);
		return 4;
	},
	0xee: function () {																			// INC $A5B6
		var addr = mos6510.addressModeOperations.Absolute(false).valueAddr;
		var value = mos6510.instructions.inc(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},

	0xf0: function () {																			// BEQ $A5
		var addrEnv = mos6510.addressModeOperations.Relative();
		var isBranch = mos6510.instructions.beq(addrEnv.valueAddr);
		if (!isBranch)
			return 2;
		return addrEnv.pageBoundaryCrossed ? 4 : 3;
	},
	0xf1: function () {																			// SBC ($A5),Y
		var valueEnv = mos6510.addressModeOperations.IndirectY(true);
		mos6510.instructions.sbc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 6 : 5;
	},
	0xf4: function () {																			// SKB -- illegal opcode
		return 2;
	},
	0xf5: function () {																			// SBC $A5,X
		mos6510.instructions.sbc(mos6510.addressModeOperations.ZeroPageX(true).valueAddr);
		return 4;
	},
	0xf6: function () {																			// INC $A5,X 
		var addr = mos6510.addressModeOperations.ZeroPageX(false).valueAddr;
		var value = mos6510.instructions.inc(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 6;
	},
	0xf8: function () {																			// SED 
		mos6510.register.status.decimal = true;
		return 2;
	},
	0xf9: function () {																			// SBC $A5B6,Y 
		var valueEnv = mos6510.addressModeOperations.AbsoluteY(true);
		mos6510.instructions.sbc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xfd: function () {																			// SBC $A5B6,X 
		var valueEnv = mos6510.addressModeOperations.AbsoluteX(true);
		mos6510.instructions.sbc(valueEnv.valueAddr);
		return valueEnv.pageBoundaryCrossed ? 5 : 4;
	},
	0xfe: function () {																			// INC $A5B6,X
		var addr = mos6510.addressModeOperations.AbsoluteX(false).valueAddr;
		var value = mos6510.instructions.inc(mos6510.memory.readByte(addr));
		mos6510.memory.writeByte(addr, value);
		return 7;
	}
};
	
// interrupts has occured
mos6510.irq = false;
mos6510.nmi = false;
	
// Returns the number of cycles the operation took.
mos6510.process = function () {

	if (this.irq) {
		this.irq = false;
		if (this.register.status.interrupt == false) {
			this.instructions.irq();
			return 2;
		}
	}

	if (this.nmi) {
		this.nmi = false;
		if (this.register.status.interrupt == false) {
			this.instructions.nmi();
			return 2;
		}
	}

	var instructionToExecute = this.getNextInstruction();

	if (this.instructionMap[instructionToExecute])
		return this.instructionMap[instructionToExecute]();
	else {
		console.log('ERROR: Could not execute opcode $' + instructionToExecute.toString(16) + ' @ $' + mos6510.register.pc.toString(16));
		return 0;
	}
};