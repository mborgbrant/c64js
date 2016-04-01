var cpuMemoryManager = cpuMemoryManager || {};

cpuMemoryManager.memoryMode = 31;
cpuMemoryManager.kernelMemoryModes = [31, 30, 14, 27, 26, 10, 15, 11, 7, 6, 3, 2];
cpuMemoryManager.basicMemoryModes = [31, 27, 15, 11];
cpuMemoryManager.characterMemoryModes = [27, 26, 10, 25, 9, 11, 3, 2];
cpuMemoryManager.ioMemoryModes = [31, 30, 14, 29, 13, 23, 22, 21, 20, 19, 18, 17, 16, 15, 7, 6, 5];

cpuMemoryManager.init = function() {
	memoryManager.ram.onWriteByte(0x0000, 0x2f);		// Data Direction Register
	memoryManager.ram.onWriteByte(0x0000, 0x37);		// Processor port
};

cpuMemoryManager.readByte = function(address) {
	
	/* Kernel */
	if ( address >= 0xe000 && address <= 0xffff && (this.kernelMemoryModes.indexOf(this.memoryMode) > -1) ) {
		return memoryManager.kernel.onReadByte(address);
	}
	
	/* Basic */
	if ( address >= 0xa000 && address <= 0xbfff && (this.basicMemoryModes.indexOf(this.memoryMode) > -1) ) {
		return memoryManager.basic.onReadByte(address);
	}
	
	/* Character */
	if ( address >= 0xd000 && address <= 0xdfff && (this.characterMemoryModes.indexOf(this.memoryMode) > -1) ) {
		return memoryManager.character.onReadByte(address - 0xd000);
	}
	
	/* IO */
	if ( address >= 0xd000 && address <= 0xdfff && (this.ioMemoryModes.indexOf(this.memoryMode) > -1) ) {
		return memoryManager.io.onReadByte(address);
	}
	
	return memoryManager.ram.onReadByte(address);
};

cpuMemoryManager.writeByte = function(address, data) {
	/* IO */
	if ( address >= 0xd000 && address <= 0xdfff && (this.ioMemoryModes.indexOf(this.memoryMode) > -1) ) {
		memoryManager.io.onWriteByte(address, data);
	}
	
	memoryManager.ram.onWriteByte(address, data);
	
	/* Bank switching */
	if ((address == 0x01)) {
		memoryManager.ram.onWriteByte(0x0001, memoryManager.ram.onReadByte(0x0000) & memoryManager.ram.onReadByte(0x0001));   
		this.memoryMode = 0x18 | (memoryManager.ram.onReadByte(0x0001) & 0x07);
	}	
};