var memoryManager = memoryManager || {};
memoryManager.cia2 = memoryManager.cia2 || {};

memoryManager.cia2.vicBankRawByte = 0x00;
memoryManager.cia2.vicBankMask = 0x00;

memoryManager.cia2.setVicBank = function(data) {
	
	memoryManager.cia2.vicBankRawByte = data;
	
	var config = (data & memoryManager.cia2.vicBankMask) & 0x03;
	var address = 0xc000 - (config * 0x4000);
	
	vicMemoryManager.vicBankAddress = address;
	
	if ((config & 0x01) == 0x01) {
		vicMemoryManager.isRomCharsAvailable = true;
	
		if ((config & 0x02) == 0x02)
			vicMemoryManager.romCharsAddress = 0x1000;
		else
			vicMemoryManager.romCharsAddress = 0x9000;
			
	} else {
		vicMemoryManager.isRomCharsAvailable = false;
	}
	
};

memoryManager.cia2.onWriteByte = function(address, data) {
	switch(address & 0x00ff) {
		case 0x00:
			this.setVicBank(data);
			break;
		case 0x02:
			memoryManager.cia2.vicBankMask = data;
			break;
		default:
			console.log('write to cia2: ' + data.toString(2) + ' @ ' + address.toString(16));
			break;
	}
};

memoryManager.cia2.onReadByte = function(address) {
	switch(address & 0x00ff) {
		case 0x00:
			return memoryManager.cia2.vicBankRawByte;
		case 0x02:
			return this.vicBankMask;
		default:
			console.log('Reading from cia2: ' + address.toString(16));
			break;
	}
};

memoryManager.cia2.process = function(clockTicksElapsed) {
	// mos6510.nmi = true;
};