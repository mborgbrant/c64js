var vicMemoryManager = vicMemoryManager || {};

vicMemoryManager.vicBankAddress = 0x0000;
vicMemoryManager.romCharsAddress = 0x1000;
vicMemoryManager.isRomCharsAvailable = true;

vicMemoryManager.readByte = function(address) {
	// Colour memory, This one is a special case since the 4 MSB lines are hard wired to the VIC-II chip
	if ((address >= 0xd800) && (address <= 0xdbff)) {
		return memoryManager.ram.onReadByte(address);
	}
	
	if (vicMemoryManager.isRomCharsAvailable && address >= vicMemoryManager.romCharsAddress && address <= vicMemoryManager.romCharsAddress + 0x0fff) {
		return memoryManager.character.onReadByte(address - vicMemoryManager.romCharsAddress);
	}

	return memoryManager.ram.onReadByte(this.vicBankAddress + address);;
};

vicMemoryManager.writeByte = function(address, data) {
	if ((address >= 0xd800) && (address <= 0xdbff)) {
		// Colour memory, This one is a special case since the 4 MSB lines are hard wired to the VIC-II chip
		memoryManager.ram.onWriteByte(address, data);
	} else {
		memoryManager.ram.onWriteByte(this.vicBankAddress + address, data);
	}
};