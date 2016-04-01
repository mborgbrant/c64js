var fileLoad = fileLoad || {};

fileLoad.saveToMemory = function(dataBuffer) {
	var fileArray = new Uint8Array(dataBuffer);
	var baseAddress = fileArray[0] | (fileArray[1] << 8)
	var dataArray = fileArray.subarray(2);
	
	for (var index = 0; index < dataArray.byteLength; index++) {
		memoryManager.ram.onWriteByte(baseAddress + index, dataArray[index]);
	}
	
	return baseAddress.toString(16);
}

fileLoad.writeRUN = function() {
	cpuMemoryManager.writeByte(198,4);
	cpuMemoryManager.writeByte(631, 82);
	cpuMemoryManager.writeByte(632, 85);
	cpuMemoryManager.writeByte(633, 78);
	cpuMemoryManager.writeByte(634, 13);
} 

fileLoad.selectFile = function() {
	document.getElementById('fileElement').onchange = function(e) {
		if (e.target.files.length == 0) {
			return false;
		} else {
			e.preventDefault();
			fileLoad.load(e.target.files[0]);
		}
	};
	document.getElementById('fileElement').click();
}

fileLoad.load = function(file) {
	//if(file.name.toLowerCase().endsWith('.prg')) {
		var reader = new FileReader();
		reader.onload = function(e) {
			var memAddr = fileLoad.saveToMemory(reader.result);
			console.log('file "' + file.name + '" is loaded into memory address $' + memAddr);
			fileLoad.writeRUN();
		};
		reader.readAsArrayBuffer(file);
	/*
	} else if(file.name.toLowerCase().endsWith('.d64')) {
		fileLoad.parseD64.loadImage(file);
	}  
	else {
		alert('The uploaded files format was not supported. Supported files are .prg');
	}
	*/
}

fileLoad.parseD64 = {};
fileLoad.parseD64.discImageArray = [];
fileLoad.parseD64.trackOffsets = [0, 0x00000, 0x01500, 0x02A00, 0x03F00, 0x05400, 0x06900, 0x07E00, 0x09300,
									0x0A800, 0x0BD00, 0x0D200, 0x0E700, 0x0FC00, 0x11100, 0x12600, 0x13B00, 
									0x15000, 0x16500, 0x17800, 0x18B00, 0x19E00, 0x1B100, 0x1C400, 0x1D700,
									0x1EA00, 0x1FC00, 0x20E00, 0x22000, 0x23200, 0x24400, 0x25600, 0x26700,
									0x27800, 0x28900, 0x29A00, 0x2AB00, 0x2BC00, 0x2CD00, 0x2DE00, 0x2EF00];
fileLoad.parseD64.fileTypes = ['DEL', 'SEQ', 'PRG', 'USR', 'REL'];

fileLoad.parseD64.discPointer = fileLoad.parseD64.trackOffsets[18];

fileLoad.parseD64.content = {};

fileLoad.parseD64.loadItemFromImage = function(item) {
	var nextTrack = item.object.firstTrackOfFile;
	var nextSector = item.object.firstSectorOfFile;
	var data = new Uint8Array();
	while(nextTrack != 0) {
		var sectorContent = fileLoad.parseD64.getSector(nextTrack, nextSector);
		nextTrack = sectorContent.nextTrack;
		nextSector = sectorContent.nextSector;
		var c = new Uint8Array(data.length + sectorContent.data.length);
		c.set(data);
		c.set(sectorContent.data, data.length);
		data = c;
	}
	var memAddr = fileLoad.saveToMemory(data);
	console.log('file "' + item.object.name + '" is loaded into memory address $' + memAddr);
}

fileLoad.parseD64.getSector = function(track, sector) {
	var startAddr = fileLoad.parseD64.trackOffsets[track] + (sector * 256);
	var data = fileLoad.parseD64.discImageArray.slice(startAddr + 2, startAddr + 254); 
	return {
		nextTrack: fileLoad.parseD64.discImageArray[startAddr],
		nextSector: fileLoad.parseD64.discImageArray[startAddr + 1],
		data: data
	}
}


fileLoad.parseD64.loadImage = function(file) {
	console.log('Loading d64 image "' + file.name + '"');
	var reader = new FileReader();
	reader.onload = function(e) {
		fileLoad.parseD64.content = {
			discName: '',
			entries: [],
			numberOfEntries: 0
		};
		fileLoad.parseD64.discImageArray = new Uint8Array(reader.result);
		fileLoad.parseD64.getBam();
		fileLoad.parseD64.getDiscEntries(8);
		fileLoad.parseD64.discPointer = fileLoad.parseD64.trackOffsets[18];
		
		menu.items.disc = [];
		for (var o in fileLoad.parseD64.content.entries) {
			
			menu.items.disc.push({ 
				title: fileLoad.parseD64.content.entries[o].name,
				action: function() { fileLoad.parseD64.loadItemFromImage(this); },
				selected: false,
				group: 'discItem',
				object: fileLoad.parseD64.content.entries[o]
			});
		}
		menu.items.disc.push({ separator: true });
		menu.items.disc.push({ title: 'Unmount drive', action: function() {
			menu.items.disc = [];
			fileLoad.parseD64.discImageArray = [];
			var menuItem = document.getElementById('discMenuItem'); 
			menuItem.className = menuItem.className.replace(' disc-loaded', '');
			menu.closeMenu();
		}});
		menu.showDiscMenu();
	}
	reader.readAsArrayBuffer(file);
};

fileLoad.parseD64.getBam = function() {
	fileLoad.parseD64.discPointer += 0x90;
	var discName = fileLoad.parseD64.discImageArray.slice(fileLoad.parseD64.discPointer, fileLoad.parseD64.discPointer + 16);
	fileLoad.parseD64.discPointer += 0x70;
	var name = [];
	for(var i = 0; i < 16; i++) {
		name[i] = (discName[i] > 31) && (discName[i] < 94) ? utils.petsciiTable[discName[i]] : '-';          
	}
	fileLoad.parseD64.content.discName = name.join('');
};

fileLoad.parseD64.getDiscEntries = function(itteration) {
	var nextEntryTrack;
	var nextEntrySector;
	if (itteration == 8) {
		nextEntryTrack = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer];
		nextEntrySector = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x01];
	}
	var fileState = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x02];
	var filetype =  fileLoad.parseD64.fileTypes[fileState & 0x07];
	// Support more than prg-files?
	if ((fileState & 0x80) != 0 && filetype == 'PRG') {
		
		var firstTrackOfFile = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x03];
		var firstSectorOfFile = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x04];
		var fileSizeLowByte = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x1e];
		var fileSizeHighByte = fileLoad.parseD64.discImageArray[fileLoad.parseD64.discPointer + 0x1f];
		var fileSizeInSectors = fileSizeLowByte | (fileSizeHighByte << 8);
		
		fileLoad.parseD64.discPointer += 0x05
		var entryName = fileLoad.parseD64.discImageArray.slice(fileLoad.parseD64.discPointer, fileLoad.parseD64.discPointer + 16);
		var name = [];
		for(var i = 0; i < 16; i++) {
			if (entryName[i] != 160) {
				name[i] = utils.petsciiTable[entryName[i]] ? utils.petsciiTable[entryName[i]] : '?';
			} else {
				name[i] = '';
			}          
		}
		fileLoad.parseD64.content.entries[fileLoad.parseD64.content.numberOfEntries++] = { 
			name: name.join(''),
			filetype: filetype,
			firstTrackOfFile: firstTrackOfFile,
			firstSectorOfFile: firstSectorOfFile,
			fileSizeInSectors: fileSizeInSectors,
		};
		fileLoad.parseD64.discPointer += 0x1B;
	} else {
		fileLoad.parseD64.discPointer += 0x20;
	}
	itteration = itteration - 1;
	if (itteration > 0)
	fileLoad.parseD64.getDiscEntries(itteration); 
	
	if (itteration == 7) {
		if (nextEntryTrack > 0) {
			fileLoad.parseD64.discPointer = fileLoad.parseD64.trackOffsets[nextEntryTrack] + (nextEntrySector * 256);
			fileLoad.parseD64.getDiscEntries(8);
		}
	}
}

fileLoad.setDropArea = function(dropElement) {
	
	dropElement.addEventListener('dragover', function(e) { 
		e.preventDefault();
	}, true);
	
	dropElement.addEventListener('drop', function(e) { 
		e.preventDefault(); 
		fileLoad.load(e.dataTransfer.files[0]);
	}, true);
}