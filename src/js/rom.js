const Rom = function (baseAddress, memoryDump) {
	this.baseAddress = baseAddress;
	this.memoryDump = memoryDump;
}

Rom.prototype.onReadByte = function (address) {
	return this.memoryDump[address - this.baseAddress]
}