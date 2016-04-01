var memoryManager = memoryManager || {};
memoryManager.ram = memoryManager.ram || {};

memoryManager.ram.memory = [];

memoryManager.ram.onWriteByte = function(address, data) {
	memoryManager.ram.memory[address] = data;	
};

memoryManager.ram.onReadByte = function(address) {
	return memoryManager.ram.memory[address] || 0x00;
};