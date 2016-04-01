var menu = menu || {};

menu.currentMenu = {};

menu.items = {
	joystick: [
		{ title: 'Use keypad as joystick port A', action: function() { }, selected: false, group: '0' },
		{ title: 'Use keypad as joystick port B', action: function() { }, selected: true, group: '0' },
		{ separator: true },
		{ title: 'Map keys to joystick port A', action: null, selected: false, group: '0', icon: true },
		{ title: 'Map keys to joystick port B', action: null, selected: false, group: '0', icon: true }
	],
	keyboard: [
		{ title: 'Customize the keymap', action: null },
		{ title: 'Use default keymap for Mac OS X', action: null },
		{ title: 'Use default keymap for Windows and Linux', action: null },
		{ title: 'Map keys from what they are on keyboard', action: null }
	],
	general: [
		{ title: 'Change color palette', action: null, icon: true },
		{ separator: true },
		{ title: 'Help', action: null },
		{ separator: true },
		{ title: 'Credits', action: null },
		{ title: 'References', action: null }
	],
	disc: []
};

menu.closeMenu = function() {
	this.isMenuClosed = true;
	for (var o in this.currentMenu) {
		this.currentMenu[o].source.className = this.currentMenu[o].source.className.substr(0, this.currentMenu[o].source.className.indexOf(' active'));
		document.body.removeChild(this.currentMenu[o].menuDiv);
		delete this.currentMenu[o];
	}
}

menu.showDiscMenu = function() {
	var element = document.getElementById('discMenuItem');
	if (element.className.indexOf('disc-loaded') < 0) {
		element.className += ' disc-loaded';
	}
}

menu.showMenu = function(source, menuName) {    
	if (!this.currentMenu[menuName]) {
		
		this.closeMenu();
		
		source.className += ' active';
		
		var sourcePosition = source.getBoundingClientRect();
		var menuDiv = document.createElement('div');
		
		menuDiv.className = 'menuContainer';
		
		this.buildMenu(menuDiv, menuName);
		document.body.appendChild(menuDiv);
		
		var x = sourcePosition.left + (sourcePosition.width / 2); 
		var y = sourcePosition.top;
		menuDiv.style.left = ~~(x - menuDiv.clientWidth / 2) + ((window.pageXOffset || document.documentElement.scrollLeft) - (document.documentElement.clientLeft || 0)) + 'px';
		menuDiv.style.top = ~~(y - menuDiv.clientHeight) - 20 + ((window.pageYOffset || document.documentElement.scrollTop)  - (document.documentElement.clientTop || 0)) + 'px';

		this.currentMenu[menuName] = {source: source, menuDiv: menuDiv};
	} else {
		this.closeMenu();
	}
}

menu.buildMenu = function(menuElement, menuName) {
	this.isMenuClosed = false;
	
	var menuItems = this.items[menuName];
	var table = document.createElement('table');
	table['data-menu'] = menuItems;
	
	for (var item in menuItems) {
		var separator = menuItems[item].separator;
		var tr = document.createElement('tr');
		tr['data-menu-item'] = menuItems[item];
		tr.onclick = separator ? null : function() { menu.itemClicked(table, this, menu, menuElement, menuName); };
		
		table.appendChild(tr);

		var td1 = document.createElement('td');
		
		if (!separator) {
			if ((menuItems[item].selected) && (menuItems[item].selected == true)) {
				var checkIcon = document.createElement('i');
				checkIcon.setAttribute('class', 'fa fa-fw fa-check-square-o');
				td1.appendChild(checkIcon);
			} else if (menuItems[item].selected === false) {
				var checkIcon = document.createElement('i');
				checkIcon.setAttribute('class', 'fa fa-fw fa-square-o');
				td1.appendChild(checkIcon);
			}
		} else {
			td1.setAttribute('class', 'separator');
			td1.setAttribute('colspan', '3');
			var separatorDiv = document.createElement('div');
			td1.appendChild(separatorDiv);
		}
		
		if (!separator) {
			var td2 = document.createElement('td');
			var title = document.createTextNode(menuItems[item].title);
			td2.appendChild(title);
		} 

		if (!separator) {
			var td3 = document.createElement('td');
			if ((menuItems[item].icon) && (menuItems[item].icon === true)) {
				var icon = document.createElement('i');
				icon.setAttribute('class', 'fa fa-fw fa-caret-right more');
				td3.appendChild(icon);
			}
		}
		
		tr.appendChild(td1);
		if (!separator) {
			tr.appendChild(td2);
			tr.appendChild(td3);
		}
	}
	
	menuElement.appendChild(table);
};

menu.itemClicked = function(table, item, menuClass, menuElement, menuName) {
	var menu = table['data-menu'];
	var menuItem = item['data-menu-item'];
	var group = menuItem.group;
	
	if ((!menuItem.action) || (menuItem.selected)) {
		return;
	} 
	
	menuItem.action();
	
	for (var o in menu) {
		if (menu[o].group === group) {
			if (typeof menu[o].selected !== 'undefined')
				menu[o].selected = false;
		}
	}
	
	menuItem.selected = true;
	
	while (menuElement.firstChild) {
		menuElement.removeChild(menuElement.firstChild);
	}   
	menuClass.buildMenu(menuElement, menuName);
}

menu.isMenuClosed = true;

window.onresize = function(e) {
	if (menu.isMenuClosed == false)
		menu.closeMenu(); 
};