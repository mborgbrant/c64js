var memoryManager = memoryManager || {};
memoryManager.io = {};

memoryManager.io.onWriteByte = function(address, data) {
	
	/* VIC-II */
	if (address >= 0xd000 && address <= 0xd3ff) {
		vic2.onWriteByte(address, data);
	}
	
	/* SID */
	if (address >= 0xd400 && address <= 0xd7ff) {
        sidPlayer.synth.poke(address & 0x1f, data);
        if (address > 0xd418) {
            console.log("attempted digi poke:", address, data);
            sidPlayer.synth.pokeDigi(address, data);
        }
	}
	
	/* Color ram */
	if (address >= 0xd800 && address <= 0xdbff) {
		memoryManager.ram.onWriteByte(address, data);
	}
	
	/* CIA 1 */
	if (address >= 0xdc00 && address <= 0xdcff) {
		memoryManager.cia1.onWriteByte(address, data);
	} 
	
	/* CIA 2 */
	if (address >= 0xdd00 && address <= 0xddff) {
		memoryManager.cia2.onWriteByte(address, data);
	} 
	
};

memoryManager.io.onReadByte = function(address) {
	
	/* VIC-II */
	if (address >= 0xd000 && address <= 0xd3ff) {
		return vic2.onReadByte(address);
	}
	
	/* SID */
	if (address >= 0xd400 && address <= 0xd7ff) {
		
	}
	
	/* Color ram */
	if (address >= 0xd800 && address <= 0xdbff) {
		return memoryManager.ram.onReadByte(address);
	}
	
	/* CIA 1 */
	if (address >= 0xdc00 && address <= 0xdcff) {
		return memoryManager.cia1.onReadByte(address);
	} 
	
	/* CIA 2 */
	if (address >= 0xdd00 && address <= 0xddff) {
		return memoryManager.cia2.onReadByte(address);
	} 
		
};
