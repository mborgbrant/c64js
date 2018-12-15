// TODO: Implement Interrupts for events
// TODO: Implement Bad lines

var vic2 = vic2 || {};

vic2.screenCanvas = null;
vic2.screenCanvasContext = null;
vic2.doubleBufferCanvas = null;
vic2.doubleBufferContext = null;
vic2.doubleBufferImageData = null;

vic2.sprites = {
	sprites: [ 
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
		{ x: 0, y: 0, enabled: false, doubleHeight: false, doubleWidth: false, isBehindContents: false, multicolor: false, color: 0x00, collisionBackground: false },
	],

	spritesEnabledRawByte : 0x00,
	doubleHeightRawByte: 0x00,
	isBehindContentsRawByte: 0x00,
	multiColorRawByte: 0x00,
	doubleWidthRawByte: 0x00,

	setSpritePositions: {
		0x00: function(data) { vic2.sprites.sprites[0].x = (vic2.sprites.sprites[0].x & 0x100) | data; },
		0x01: function(data) { vic2.sprites.sprites[0].y = data; },
		0x02: function(data) { vic2.sprites.sprites[1].x = (vic2.sprites.sprites[1].x & 0x100) | data; },
		0x03: function(data) { vic2.sprites.sprites[1].y = data; },
		0x04: function(data) { vic2.sprites.sprites[2].x = (vic2.sprites.sprites[2].x & 0x100) | data; },
		0x05: function(data) { vic2.sprites.sprites[2].y = data; },
		0x06: function(data) { vic2.sprites.sprites[3].x = (vic2.sprites.sprites[3].x & 0x100) | data; },
		0x07: function(data) { vic2.sprites.sprites[3].y = data; },
		0x08: function(data) { vic2.sprites.sprites[4].x = (vic2.sprites.sprites[4].x & 0x100) | data; },
		0x09: function(data) { vic2.sprites.sprites[4].y = data; },
		0x0a: function(data) { vic2.sprites.sprites[5].x = (vic2.sprites.sprites[5].x & 0x100) | data; },
		0x0b: function(data) { vic2.sprites.sprites[5].y = data; },
		0x0c: function(data) { vic2.sprites.sprites[6].x = (vic2.sprites.sprites[6].x & 0x100) | data; },
		0x0d: function(data) { vic2.sprites.sprites[6].y = data; },
		0x0e: function(data) { vic2.sprites.sprites[7].x = (vic2.sprites.sprites[7].x & 0x100) | data; },
		0x0f: function(data) { vic2.sprites.sprites[7].y = data; },
		0x10: function(data) {
			vic2.sprites.sprites[0].x = ((data & 0x01) << 8) | (vic2.sprites.sprites[0].x & 0xff);
			vic2.sprites.sprites[1].x = ((data & 0x02) << 7) | (vic2.sprites.sprites[1].x & 0xff);
			vic2.sprites.sprites[2].x = ((data & 0x04) << 6) | (vic2.sprites.sprites[2].x & 0xff);
			vic2.sprites.sprites[3].x = ((data & 0x08) << 5) | (vic2.sprites.sprites[3].x & 0xff);
			vic2.sprites.sprites[4].x = ((data & 0x10) << 4) | (vic2.sprites.sprites[4].x & 0xff);
			vic2.sprites.sprites[5].x = ((data & 0x20) << 3) | (vic2.sprites.sprites[5].x & 0xff);
			vic2.sprites.sprites[6].x = ((data & 0x40) << 2) | (vic2.sprites.sprites[6].x & 0xff);
			vic2.sprites.sprites[7].x = ((data & 0x80) << 1) | (vic2.sprites.sprites[7].x & 0xff);
		}
	},

	getSpritePositions: {
		0x00: function() { return vic2.sprites.sprites[0].x & 0xff; },
		0x01: function() { return vic2.sprites.sprites[0].y; },
		0x02: function() { return vic2.sprites.sprites[1].x & 0xff; },
		0x03: function() { return vic2.sprites.sprites[1].y; },
		0x04: function() { return vic2.sprites.sprites[2].x & 0xff; },
		0x05: function() { return vic2.sprites.sprites[2].y; },
		0x06: function() { return vic2.sprites.sprites[3].x & 0xff; },
		0x07: function() { return vic2.sprites.sprites[3].y; },
		0x08: function() { return vic2.sprites.sprites[4].x & 0xff; },
		0x09: function() { return vic2.sprites.sprites[4].y; },
		0x0a: function() { return vic2.sprites.sprites[5].x & 0xff; },
		0x0b: function() { return vic2.sprites.sprites[5].y; },
		0x0c: function() { return vic2.sprites.sprites[6].x & 0xff; },
		0x0d: function() { return vic2.sprites.sprites[6].y; },
		0x0e: function() { return vic2.sprites.sprites[7].x & 0xff; },
		0x0f: function() { return vic2.sprites.sprites[7].y; },
		0x10: function() { 
			return ((vic2.sprites.sprites[0] & 0x100) >> 8) | ((vic2.sprites.sprites[1] & 0x100) >> 7) | 
				((vic2.sprites.sprites[2] & 0x100) >> 6) | ((vic2.sprites.sprites[3] & 0x100) >> 5) | ((vic2.sprites.sprites[4] & 0x100) >> 4) | 
				((vic2.sprites.sprites[5] & 0x100) >> 3) | ((vic2.sprites.sprites[6] & 0x100) >> 2) | ((vic2.sprites.sprites[7] & 0x100) >> 1);
		}
	},

	setSpritesEnabled: function(data) {
		vic2.sprites.sprites[0].enabled = (data & 0x01) > 0;
		vic2.sprites.sprites[1].enabled = (data & 0x02) > 0;
		vic2.sprites.sprites[2].enabled = (data & 0x04) > 0;
		vic2.sprites.sprites[3].enabled = (data & 0x08) > 0;
		vic2.sprites.sprites[4].enabled = (data & 0x10) > 0;
		vic2.sprites.sprites[5].enabled = (data & 0x20) > 0;
		vic2.sprites.sprites[6].enabled = (data & 0x40) > 0;
		vic2.sprites.sprites[7].enabled = (data & 0x80) > 0;
		vic2.sprites.spritesEnabledRawByte = data;
	},

	getEnabledSprites: function() {
		return vic2.sprites.spritesEnabledRawByte;
	},

	setSpriteDoubleHeight: function(data) {
		vic2.sprites.sprites[0].doubleHeight = (data & 0x01) > 0;
		vic2.sprites.sprites[1].doubleHeight = (data & 0x02) > 0;
		vic2.sprites.sprites[2].doubleHeight = (data & 0x04) > 0;
		vic2.sprites.sprites[3].doubleHeight = (data & 0x08) > 0;
		vic2.sprites.sprites[4].doubleHeight = (data & 0x10) > 0;
		vic2.sprites.sprites[5].doubleHeight = (data & 0x20) > 0;
		vic2.sprites.sprites[6].doubleHeight = (data & 0x40) > 0;
		vic2.sprites.sprites[7].doubleHeight = (data & 0x80) > 0;
		vic2.sprites.doubleHeightRawByte = data;
	},

	getSpriteDoubleHeight: function() {
		return vic2.sprites.doubleHeightRawByte;
	},

	setSpriteDoubleWidth: function(data) {
		vic2.sprites.sprites[0].doubleWidth = (data & 0x01) > 0;
		vic2.sprites.sprites[1].doubleWidth = (data & 0x02) > 0;
		vic2.sprites.sprites[2].doubleWidth = (data & 0x04) > 0;
		vic2.sprites.sprites[3].doubleWidth = (data & 0x08) > 0;
		vic2.sprites.sprites[4].doubleWidth = (data & 0x10) > 0;
		vic2.sprites.sprites[5].doubleWidth = (data & 0x20) > 0;
		vic2.sprites.sprites[6].doubleWidth = (data & 0x40) > 0;
		vic2.sprites.sprites[7].doubleWidth = (data & 0x80) > 0;
		vic2.sprites.doubleWidthRawByte = data;
	},

	getSpriteDoubleWidth: function() {
		return vic2.sprites.doubleWidthRawByte;
	},

	setSpritePriority: function(data) {
		vic2.sprites.sprites[0].isBehindContents = (data & 0x01) > 0;
		vic2.sprites.sprites[1].isBehindContents = (data & 0x02) > 0;
		vic2.sprites.sprites[2].isBehindContents = (data & 0x04) > 0;
		vic2.sprites.sprites[3].isBehindContents = (data & 0x08) > 0;
		vic2.sprites.sprites[4].isBehindContents = (data & 0x10) > 0;
		vic2.sprites.sprites[5].isBehindContents = (data & 0x20) > 0;
		vic2.sprites.sprites[6].isBehindContents = (data & 0x40) > 0;
		vic2.sprites.sprites[7].isBehindContents = (data & 0x80) > 0;
		vic2.sprites.isBehindContentsRawByte = data;
	},

	getSpritePriority: function() {
		return vic2.sprites.isBehindContentsRawByte;
	},

	setSpriteMulticolor: function(data) {
		vic2.sprites.sprites[0].multicolor = (data & 0x01) > 0;
		vic2.sprites.sprites[1].multicolor = (data & 0x02) > 0;
		vic2.sprites.sprites[2].multicolor = (data & 0x04) > 0;
		vic2.sprites.sprites[3].multicolor = (data & 0x08) > 0;
		vic2.sprites.sprites[4].multicolor = (data & 0x10) > 0;
		vic2.sprites.sprites[5].multicolor = (data & 0x20) > 0;
		vic2.sprites.sprites[6].multicolor = (data & 0x40) > 0;
		vic2.sprites.sprites[7].multicolor = (data & 0x80) > 0;
		vic2.sprites.multiColorRawByte = data;
	},

	getSpriteMulticolor: function() {
		return vic2.sprites.multiColorRawByte;
	},

	getSpritesBackgroundCollision: function() {
		return (vic2.sprites.sprites[0].collisionBackground ? 0x01 : 0) |
			(vic2.sprites.sprites[1].collisionBackground ? 0x02 : 0) |
			(vic2.sprites.sprites[2].collisionBackground ? 0x04 : 0) |
			(vic2.sprites.sprites[3].collisionBackground ? 0x08 : 0) |
			(vic2.sprites.sprites[4].collisionBackground ? 0x10 : 0) |
			(vic2.sprites.sprites[5].collisionBackground ? 0x20 : 0) |
			(vic2.sprites.sprites[6].collisionBackground ? 0x40 : 0) |
			(vic2.sprites.sprites[7].collisionBackground ? 0x80 : 0)       
	},

	clearSpritesBackgroundCollision: function() {
		console.log('clearing sprite background collisions'); 
		for (var i = 0; i < 8; i++) {
			vic2.sprites.sprites[i].collisionBackground = false;
		}
	}
};

vic2.screenControlRegister = {
	yScroll: 0x03,				// vertical scroll (0-7) 
	screenHeight: true,			// false = 24 rows, 						true = 25 rows 
	screenOn: true,				// false = screen is covered by border, 	true = Screen on, normal screen contents are visible
	renderMode: false,			// false = Text mode, 						true = Bitmap mode
	extendedBackground: false,	// false = Extended background mode off, 	true = Extended background mode on
	currentRasterLine: 0x000,
	interruptRasterLine: 0x000,
	xScroll : 0x00,				// horizontal scroll (0-7)
	screenWidth: true,			// false = 38 columns						true = 40 columns
	multiColor: false,

	setControlRegister1: function(data) {
		vic2.screenControlRegister.yScroll = data & 0x07;
		vic2.screenControlRegister.screenHeight = (data & 0x08) > 0;
		vic2.screenControlRegister.screenOn = (data & 0x10) > 0;
		vic2.screenControlRegister.renderMode = (data & 0x20) > 0;
		vic2.screenControlRegister.extendedBackground = (data & 0x40) > 0;
		vic2.screenControlRegister.interruptRasterLine = ((data & 0x80) << 1) | (vic2.screenControlRegister.interruptRasterLine & 0xff);
		if (vic2.screenControlRegister.extendedBackground) {
			console.log('extended background in on');
		}
	},

	getControlRegister1: function() {
		return (vic2.screenControlRegister.yScroll & 0x07) | (vic2.screenControlRegister.screenHeight ? 0x08 : 0x00) |
			(vic2.screenControlRegister.screenOn ? 0x10 : 0x00) | (vic2.screenControlRegister.renderMode ? 0x20 : 0x00) |
			(vic2.screenControlRegister.extendedBackground ? 0x40 : 0x00) | ((vic2.screenControlRegister.currentRasterLine & 0x100) >> 1); 
	},

	setRasterInterrupt: function(data) {
		vic2.screenControlRegister.interruptRasterLine = (vic2.screenControlRegister.interruptRasterLine & 0x100) | (data & 0xff);
	},

	getCurrentRasterLineLowBits: function() {
		return vic2.screenControlRegister.currentRasterLine & 0xff;
	},

	setControlRegister2: function(data) {
		vic2.screenControlRegister.xScroll = data & 0x07;
		vic2.screenControlRegister.screenWidth = (data & 0x08) > 0;
		vic2.screenControlRegister.multiColor = (data & 0x10) > 0;
		/*
		if (vic2.screenControlRegister.multiColor)
			console.log('multicolor is on');
		else
			console.log('multicolor is off');
		*/
	},

	getControlRegister2: function() {
		return (vic2.screenControlRegister.xScroll & 0x07) | (vic2.screenControlRegister.screenWidth ? 0x08 : 0x00) |
			(vic2.screenControlRegister.multiColor ? 0x10 : 0x00);
	}
};

vic2.memorySetupRegister = {
	pointerToCharMemory: 0x0000,
	pointerToBitmapMemory: 0x0000,
	pointerToScreenMemory: 0x0000,
	rawByte: 0x00,

	setMemorySetupRegister: function(data) {
		vic2.memorySetupRegister.rawByte = data;
		vic2.memorySetupRegister.pointerToCharMemory = ((data & 0x0e) >> 1) * 0x0800;
		vic2.memorySetupRegister.pointerToBitmapMemory = ((data & 0x0e) >> 3) * 0x2000;
		vic2.memorySetupRegister.pointerToScreenMemory = ((data & 0xf0) >> 4) * 0x400;
	}
};

vic2.interruptRegister = {
	// Skipping lightpen for interrupts
	events: {
		rasterLineOccured: false,
		spriteBackgroundCollisionOccured: false,
		spriteSpriteCollisionOccured: false
	},
	mask: {
		rasterLineEnabled: false,
		spriteBackgroundCollisionEnabled: false,
		spriteSpriteCollisionEnabled: false,
		rawByte: 0x00
	},

	setInterruptMask: function(data) {
		if ((data & 0x01) > 0)
			console.log('raster line interrupt enabled');
		else
			console.log('raster line interrupt disabled');

		vic2.interruptRegister.mask.rawByte = data;
		vic2.interruptRegister.mask.rasterLineEnabled = (data & 0x01) > 0;
		vic2.interruptRegister.mask.spriteBackgroundCollisionEnabled = (data & 0x02) > 0;
		vic2.interruptRegister.mask.spriteSpriteCollisionEnabled = (data & 0x04) > 0;
	},

	getInterruptMask: function() {
		return vic2.interruptRegister.mask.rawByte;
	},

	getInterruptStatusRegister: function() {
		return ((vic2.interruptRegister.events.rasterLineOccured && vic2.interruptRegister.mask.rasterLineEnabled) || 
			(vic2.interruptRegister.events.spriteBackgroundCollisionOccured && vic2.interruptRegister.mask.spriteBackgroundCollisionEnabled) ||
			(vic2.interruptRegister.events.spriteSpriteCollisionOccured && vic2.interruptRegister.mask.spriteSpriteCollisionEnabled)) ? 0x80 : 0x00 |
			vic2.interruptRegister.events.spriteSpriteCollisionOccured ? 0x04 : 0x00 |
			vic2.interruptRegister.events.spriteBackgroundCollisionOccured ? 0x02 : 0x00 |
			vic2.interruptRegister.events.rasterLineOccured ? 0x01 : 0x00;
	},
	ackEvents: function(data) {
		vic2.interruptRegister.events.rasterLineOccured = (data & 0x01) == 0;
		vic2.interruptRegister.events.spriteBackgroundCollisionOccured = (data & 0x02) == 0;
		vic2.interruptRegister.events.spriteSpriteCollisionOccured = (data & 0x04) == 0;
	}

};

vic2.frameSpriteCollisions = [];

vic2.borderColor = 0x00;
vic2.backgroundColor = 0x00;
vic2.extraBackgroundColor1 = 0x00;
vic2.extraBackgroundColor2 = 0x00;
vic2.extraBackgroundColor3 = 0x00;
vic2.extraSpriteColor1 = 0x00;
vic2.extraSpriteColor2 = 0x00;

vic2.memory = null;

vic2.onWriteByte = function(address, data) {
	// since vic2 memory map is repeated every 64 bytes
	if (address > 0xd03f) {
		var tmpAddress = address - 0xd000;
		tmpAddress = tmpAddress % 0x40;
		address = tmpAddress + 0xd000;
	}

	// set sprite positions
	if (address >= 0xd000 && address <= 0xd010) { this.sprites.setSpritePositions[address-0xd000](data); }
	// set control register 1
	if (address == 0xd011) { this.screenControlRegister.setControlRegister1(data); }
	// set raster interrupt
	if (address == 0xd012) { this.screenControlRegister.setRasterInterrupt(data); }
	// 0xd013 lightpen x, skipping this.
	// 0xd014 lightpen y, skipping this.
	// enable sprites
	if (address == 0xd015) { this.sprites.setSpritesEnabled(data); }
	// set control register 2
	if (address == 0xd016) { this.screenControlRegister.setControlRegister2(data); }
	// set sprite double height
	if (address == 0xd017) { this.sprites.setSpriteDoubleHeight(data); }
	// set memory setup register
	if (address == 0xd018) { this.memorySetupRegister.setMemorySetupRegister(data); }
	// acknowledge interrupts
	if (address == 0xd019) { this.interruptRegister.ackEvents(data); }
	// set interrupt masks
	if (address == 0xd01a) { this.interruptRegister.setInterruptMask(data); }
	// set sprite priority
	if (address == 0xd01b) { this.sprites.setSpritePriority(data); }
	// set sprite multicolor
	if (address == 0xd01c) { this.sprites.setSpriteMulticolor(data); }
	// set sprite double width
	if (address == 0xd01d) { this.sprites.setSpriteDoubleWidth(data); }
	
	// set sprite-background collisions
	if (address == 0xd01f) { this.sprites.clearSpritesBackgroundCollision(); }
	
	// set border color
	if (address == 0xd020) { this.borderColor = data; }
	// set background color
	if (address == 0xd021) { this.backgroundColor = data; }
	// set extra background color #1
	if (address == 0xd022) { this.extraBackgroundColor1 = data; }
	// set extra background color #2
	if (address == 0xd023) { this.extraBackgroundColor2 = data; }
	// set extra background color #3
	if (address == 0xd024) { this.extraBackgroundColor3 = data; }
	// Sprite extra color #1
	if (address == 0xd025) { this.extraSpriteColor1 = data; }
	// Sprite extra color #2
	if (address == 0xd026) { this.extraSpriteColor2 = data; }
	
	// set sprite colors 
	if ((address >= 0xd027) && (address <= 0xd02e)) {
		var spritePos = address - 0xd027;
		this.sprites.sprites[spritePos].color = data & 0x0f;
	}
	
}

vic2.onReadByte = function(address) {
	// since vic2 memory map is repeated every 64 bytes
	if (address > 0xd03f) {
		var tmpAddress = address - 0xd000;
		tmpAddress = tmpAddress % 0x40;
		address = tmpAddress + 0xd000;
	}

	// get sprite positions
	if (address >= 0xd000 && address <= 0xd010) { return this.sprites.getSpritePositions[address-0xd000](); }
	// get control register 1
	if (address == 0xd011) { return this.screenControlRegister.getControlRegister1(); }
	// get current raster line
	if (address == 0xd012) { return this.screenControlRegister.getCurrentRasterLineLowBits(); }
	// 0xd013 lightpen x, skipping this.
	// 0xd014 lightpen y, skipping this.
	// get enabled sprites
	if (address == 0xd015) { return this.sprites.getEnabledSprites(); }
	// get control register 2
	if (address == 0xd016) { return this.screenControlRegister.getControlRegister2(); }
	// get sprite double height
	if (address == 0xd017) { return this.sprites.getSpriteDoubleHeight(); }
	// get memory setup register
	if (address == 0xd018) { return this.memorySetupRegister.rawByte; }
	// get interrupts status
	if (address == 0xd019) { return this.interruptRegister.getInterruptStatusRegister(); }
	// get interrupt masks
	if (address == 0xd01a) { return this.interruptRegister.getInterruptMask(); }
	// get sprite priority
	if (address == 0xd01b) { return this.sprites.getSpritePriority(); }
	// get sprite multicolor
	if (address == 0xd01c) { return this.sprites.getSpriteMulticolor(); }
	// get sprite double width
	if (address == 0xd01d) { return this.sprites.getSpriteDoubleWidth(); }

	// get sprite-background collisions
	if (address == 0xd01f) { return this.sprites.getSpritesBackgroundCollision(); }

	// get border color
	if (address == 0xd020) { return this.borderColor; }
	// get background color
	if (address == 0xd021) { return this.backgroundColor; }
	// get extra background color #1
	if (address == 0xd022) { return this.extraBackgroundColor1; }
	// get extra background color #2
	if (address == 0xd023) { return this.extraBackgroundColor2; }
	// get extra background color #3
	if (address == 0xd024) { return this.extraBackgroundColor3; }
	// Sprite extra color #1
	if (address == 0xd025) { return this.extraSpriteColor1; }
	// Sprite extra color #2
	if (address == 0xd026) { return this.extraSpriteColor2; }


	// get sprite colors 
	if ((address >= 0xd027) && (address <= 0xd02e)) {
		var spritePos = address - 0xd027;
		return this.sprites.sprites[spritePos].color;
	}
}

vic2.colorPalette = [
	0x000000, 0xffffff, 0x68372b, 0x70a4b2,
	0x6f3d86, 0x588d43, 0x352879, 0xb8c76f,
	0x6f4f25, 0x433900, 0x9a6759, 0x444444,
	0x6c6c6c, 0x9ad284, 0x6c5eB5, 0x959595
];

vic2.init = function(memoryManager) {
	this.memory = memoryManager;
}

vic2.setScreenCanvas = function(canvasObject) {
	this.screenCanvas = canvasObject;
	this.screenCanvasContext = this.screenCanvas.getContext('2d');
	this.doubleBufferCanvas = document.createElement('canvas');
	this.doubleBufferCanvas.width = this.screenCanvas.width;
	this.doubleBufferCanvas.height = this.screenCanvas.height;
	this.doubleBufferContext = this.doubleBufferCanvas.getContext('2d');
	this.doubleBufferImageData = this.doubleBufferContext.createImageData(this.doubleBufferCanvas.width, this.doubleBufferCanvas.height);
};

vic2.putPixel = function(x, y, c) {
	if ((x > 383) || (x < 0) || (y > 271) || (y < 0))
		return;

	var position = (y * 384 + x) * 4;
	var color = this.colorPalette[c & 0x0f];

	this.doubleBufferImageData.data[position + 0] = (color & 0xff0000) >> 16;	// red
	this.doubleBufferImageData.data[position + 1] = (color & 0x00ff00) >> 8;	// green
	this.doubleBufferImageData.data[position + 2] = (color & 0x0000ff);			// blue
	this.doubleBufferImageData.data[position + 3] = 0xff;						// alpha
}

vic2.getPixel = function(x, y) {
	var position = (y * 384 + x) * 4;
	var hexColor = this.doubleBufferImageData.data[position + 0] << 16 | 
		this.doubleBufferImageData.data[position + 1] << 8 | 
		this.doubleBufferImageData.data[position + 2];
	var color = this.colorPalette.indexOf(hexColor);
	return color;
}

vic2.renderStandardCharacterMode = function(x, y, dx, dy) {
	var col = x >> 3;
	var rowPos = (y >> 3) * 40;
	var content = vic2.memory.readByte(vic2.memorySetupRegister.pointerToScreenMemory + rowPos + col);
	var charMemPos = vic2.memorySetupRegister.pointerToCharMemory + (content * 8);	
	var color = vic2.memory.readByte(0xd800 + rowPos + col);
	if ((vic2.memory.readByte(charMemPos + y % 8) & (0x80 >> x % 8)) > 0) {
		this.putPixel(dx + this.screenControlRegister.xScroll, dy + this.screenControlRegister.yScroll - 3 , color);
		return { rendered: true, renderedBackgroundColor: color == vic2.backgroundColor, badLine: y % 8 == 0 };
	}
	return { rendered: false, renderedBackgroundColor: false, badLine: false };
};

vic2.renderMultiColorCharacterMode = function(x, y, dx, dy) {
	var col = x >> 3;
	var rowPos = (y >> 3) * 40;
	var color = vic2.memory.readByte(0xd800 + (rowPos + col));
	if ((color & 0x08) > 0) {
		var textMemPos = vic2.memorySetupRegister.pointerToScreenMemory + (rowPos + col);
		var charMemPos = vic2.memorySetupRegister.pointerToCharMemory + (vic2.memory.readByte(textMemPos) * 8);
		var xOffset = x % 8;
		xOffset -= xOffset % 2;
		var colorBits = (vic2.memory.readByte(charMemPos + y % 8) & (0xc0 >> xOffset)) >> 6 - xOffset;
		color = [vic2.backgroundColor, vic2.extraBackgroundColor1, vic2.extraBackgroundColor2, color & 0x07][colorBits];
		this.putPixel(dx  + this.screenControlRegister.xScroll, dy + this.screenControlRegister.yScroll - 3, color);
		return { rendered: true, renderedBackgroundColor: colorBits < 2, badLine: y % 8 == 0 };
	} else {
		// if bit 3 of the color is high, this char should be rendered in standard mode
	return vic2.renderStandardCharacterMode(x, y, dx, dy);
	}
	return { rendered: false, renderedBackgroundColor: false , badLine: false};
}

vic2.renderStandardBitmapMode = function(x, y, dx, dy) {
	var col = x >> 3, rowPos = (y >> 3) * 40;
	if ((vic2.memory.readByte(vic2.memorySetupRegister.pointerToBitmapMemory + (rowPos + col) * 8 + y % 8) & (0x80 >> x % 8)) > 0) {
		var color = vic2.memory.readByte(vic2.memorySetupRegister.pointerToScreenMemory + rowPos + col) >> 4;
		this.putPixel(dx + this.screenControlRegister.xScroll, dy + this.screenControlRegister.yScroll - 3, color);
		return { rendered: true, renderedBackgroundColor: color == vic2.backgroundColor, badLine: y % 8 == 0 };
	}
	return { rendered: false, renderedBackgroundColor: false, badLine: false };
};

vic2.renderMultiColorBitmapMode = function(x, y, dx, dy) {
	var col = x >> 3, rowPos = (y >> 3) * 40, color;
	switch ((vic2.memory.readByte(vic2.memorySetupRegister.pointerToBitmapMemory + (rowPos + col) * 8 + y % 8) >> (7 - x & 6)) & 3) {
		case 0:
			return { rendered: false, renderedBackgroundColor: false, badLine: false };
		case 1:
			color = vic2.memory.readByte(vic2.memorySetupRegister.pointerToScreenMemory + rowPos + col) >> 4;
			break;
		case 2:
			color = vic2.memory.readByte(vic2.memorySetupRegister.pointerToScreenMemory + rowPos + col) & 15;
			break;
		case 3:
			color = vic2.memory.readByte(0xd800 + rowPos + col);
			break;
	}
	this.putPixel(dx + this.screenControlRegister.xScroll, dy + this.screenControlRegister.yScroll - 3, color);
	return { rendered: true, renderedBackgroundColor: color == vic2.backgroundColor, badLine: y % 8 == 0 };
}

vic2.renderSprites = function(rx, ry, renderedBackgroundColorUnder) {

	var baseAddressSpriteVectors = vic2.memorySetupRegister.pointerToScreenMemory + 0x3f8;

	for (var z = 7; z >= 0; z--) {
		var sprite = this.sprites.sprites[z];
		if (sprite.enabled) {

			var width =  24 + (sprite.doubleWidth ? 24 : 0);
			var height = 21 + (sprite.doubleHeight ? 21 : 0);
			
			var addressSpriteVector = baseAddressSpriteVectors + z;
		
			var addressSpriteDataAddress = this.memory.readByte(addressSpriteVector) * 64;

			if ((rx >= sprite.x + 8) && (rx < sprite.x + width + 8) && (ry >= sprite.y - 13) && (ry < sprite.y + height - 13)) {

				// Will this works with multicolor backgrounds? otherwise use "renderedBackgroundColorUnder"
				var underColor = this.getPixel(rx,ry);
				if (underColor != this.backgroundColor) {
					if (sprite.isBehindContents) {
						continue;
					}
				}

				var dx = rx - (sprite.x + 8);
				var dy = ry - (sprite.y - 13);
				dx = (sprite.doubleWidth ? Math.floor(dx / 2) : dx);
				dy = (sprite.doubleHeight ? Math.floor(dy / 2) : dy);

				var pos = dy * 24 + dx;

				var spriteDataByte = this.memory.readByte(addressSpriteDataAddress + Math.floor(pos / 8));

				if (sprite.multicolor) {
					var offsetX = dx % 8;
					offsetX -= offsetX % 2
					var colorBits = (spriteDataByte & (0x80 >> offsetX % 8 | 0x40 >> offsetX % 8)) >> 6 - offsetX;
					var color = [0x00, vic2.extraSpriteColor1, sprite.color, vic2.extraSpriteColor2][colorBits];
					if (colorBits > 0) {
						// sprite to background collision detection
						if (!renderedBackgroundColorUnder) { 
							//sprite.collisionBackground = true;
							this.frameSpriteCollisions[z] = true;  
						}
						this.putPixel(rx, ry, color);
					} 
				} else {
					if ((spriteDataByte & (0x80 >> (dx % 8))) > 0) {
						// sprite to background collision detection
						if (!renderedBackgroundColorUnder) { 
							//sprite.collisionBackground = true;
							this.frameSpriteCollisions[z] = true;  
						}
						this.putPixel(rx, ry, sprite.color);
					}   
				}
			}
		}
	}
}

vic2.rasterBeam = 0;

vic2.process = function(frameCycle, frameInterlaceToggle) {	
	var badLine = false;

	var screenMargin = this.screenControlRegister.screenWidth ? 0 : 8;

	for (var i = 0; i < 8; i++) {
	
			var x = vic2.rasterBeam % 504;
			var y = (vic2.rasterBeam - x) / 504;
			
			if ((x > 119 && y > 19 && y < 292) && (y % 1 == frameInterlaceToggle)) {
				var fromBorderX = x - 120;			// x = 0 where border starts
				var fromBorderY = y - 20;
				
				if ((x > 151 + screenMargin && x < 472 - screenMargin && y > 56 && y < 257) && this.screenControlRegister.screenOn && (y + this.screenControlRegister.yScroll - 3 > 56)) {
					var fromScreenX = x - 152;			// x = 0 where screen starts
					var fromScreenY = y - 57;
				
					var rendered = null;
					if (this.screenControlRegister.renderMode) {
						if (this.screenControlRegister.multiColor) {
							rendered = this.renderMultiColorBitmapMode(fromScreenX, fromScreenY, fromBorderX, fromBorderY);
						} else {
							rendered = this.renderStandardBitmapMode(fromScreenX, fromScreenY, fromBorderX, fromBorderY);
						}
					} else {
						if (this.screenControlRegister.multiColor) {
							rendered = this.renderMultiColorCharacterMode(fromScreenX, fromScreenY, fromBorderX, fromBorderY);
						} else {
							rendered = this.renderStandardCharacterMode(fromScreenX, fromScreenY, fromBorderX, fromBorderY);
						}
					}
					
					badLine = rendered.badLine;
					
					// render background
					if ((rendered.rendered === false)) { 
						this.putPixel(fromBorderX + this.screenControlRegister.xScroll, fromBorderY + this.screenControlRegister.yScroll - 3, this.backgroundColor);
						rendered.renderedBackgroundColor = true;
					}
					if (fromScreenX < this.screenControlRegister.xScroll) {
						this.putPixel(fromBorderX, fromBorderY, this.backgroundColor);
						rendered.renderedBackgroundColor = true;
					}

					// render sprites
					this.renderSprites(x - (120), y - (20), rendered.renderedBackgroundColor);
					
				} else {
					this.putPixel(fromBorderX, fromBorderY, this.borderColor);
				}
			}

		++this.rasterBeam;
		var interruptRasterLineReached = (this.rasterBeam / 504) == this.screenControlRegister.interruptRasterLine
	}

	this.screenControlRegister.currentRasterLine = Math.floor(this.rasterBeam / 504); 
	
	if (vic2.interruptRegister.mask.rasterLineEnabled) {
		if (interruptRasterLineReached) {
			this.interruptRegister.events.rasterLineOccured = true;
			mos6510.irq = true; 
		}
	}

	/* This should happend when the sprites really collide, but the timing is failing right now. Or?! */
	if (this.rasterBeam % 504 == 0) {
		for (var z = 0; z < 8; z++) {
			this.sprites.sprites[z].collisionBackground = this.frameSpriteCollisions[z];
		}
	}

	if (this.rasterBeam == (504 * 312)) {
		this.rasterBeam = 0;
	
		for (var z = 0; z < 8; z++) {
			//this.sprites.sprites[z].collisionBackground = this.frameSpriteCollisions[z];
			this.frameSpriteCollisions[z] = false;
		}
		this.screenCanvasContext.putImageData(this.doubleBufferImageData, 0, 0);
	}

	// TODO: Check if interrupt has occured here, send interrupt to CPU
	// check highest bit of 0xd019 - it tells if event has occured
	// set events from the draw routine

	// returns badline

	return badLine;
};
