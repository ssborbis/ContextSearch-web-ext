// unique object to reference globally
var quickMenuObject = { 
	delay: 250, // how long to hold right-click before translating in ms
	keyDownTimer: 0,
	mouseDownTimer: 0,
	mouseCoords: {x:0, y:0},
	screenCoords: {x:0, y:0},
	mouseCoordsInit: {x:0, y:0},
	mouseLastClickTime: 0,
	mouseDragDeadzone: 4,
	lastSelectTime: 0,
	locked: false,
	searchTerms: ""
};

var userOptions = {};

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.repeat ||
		!userOptions.quickMenu
	) return false;
	
	if (ev.which === 27)
		browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});
		
});

// Listen for quickMenuKey
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.repeat ||
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnKey ||
		ev.which !== userOptions.quickMenuKey ||
		getSelectedText(ev.target) === ""
	) return false;

	quickMenuObject.keyDownTimer = Date.now();
	
});

// Listen for quickMenuKey
document.addEventListener('keyup', (ev) => {
	
	if (
		ev.repeat ||
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnKey ||
		ev.which !== userOptions.quickMenuKey
	) return false;
	
	if (Date.now() - quickMenuObject.keyDownTimer < 250)
		openQuickMenu(ev);
	
	quickMenuObject.keyDownTimer = 0;
	
});
// Listen for HOLD quickMenuMouseButton
document.addEventListener('mousedown', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		ev.which !== userOptions.quickMenuMouseButton ||
		getSelectedText(ev.target) === ""
	) return false;

	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {

		// ignore select / drag events
		if (Math.abs(quickMenuObject.mouseCoords.x - quickMenuObject.mouseCoordsInit.x) > quickMenuObject.mouseDragDeadzone || Math.abs(quickMenuObject.mouseCoords.y - quickMenuObject.mouseCoordsInit.y) > quickMenuObject.mouseDragDeadzone ) return false;

		// prevent losing text selection
		ev.target.addEventListener('mouseup', (evv) => {
			if (evv.which !== ev.which) return;
			evv.preventDefault();
			quickMenuObject.mouseLastClickTime = Date.now();
		}, {once: true}); // parameter to run once, then delete
		
		if (ev.which === 1) {
			// Disable click to prevent links from opening
			ev.target.addEventListener('click', (evv) => {
				if (evv.which !== 1) return;
				evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true}); // parameter to run once, then delete
			
		} else if (ev.which === 3) {
			// Disable the default context menu once
			document.addEventListener('contextmenu', (evv) => {
				evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true}); // parameter to run once, then delete

		}	
		openQuickMenu(ev);
		
	}, quickMenuObject.delay);

});
// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		ev.which !== userOptions.quickMenuMouseButton
	) return false;
	
	clearTimeout(quickMenuObject.mouseDownTimer);

});

// Listen for quickMenuAuto
document.addEventListener('mouseup', (ev) => {
	
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		ev.which !== 1 ||
		ev.target.id === 'hover_div' ||
		ev.target.parentNode.id === 'hover_div' ||
		getSelectedText(ev.target) === ""
	) return false;
	
	if (Date.now() - quickMenuObject.lastSelectTime > 1000 && ev.target.type !== 'text' && ev.target.type !== 'textarea' ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	
	clearTimeout(quickMenuObject.mouseDownTimer);
	
	openQuickMenu(ev);

});

// Listen for quickMenuOnClick
document.addEventListener('mousedown', (ev) => {	

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnClick ||
		ev.which !== 3 ||
		getSelectedText(ev.target) === ""
	) return false;

	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		quickMenuObject.mouseDownTimer = null;
	},quickMenuObject.delay);

});
		
// Listen for quickMenuOnClick	
document.addEventListener('mouseup', (ev) => {	

	if (
		!userOptions.quickMenu || 
		!userOptions.quickMenuOnClick ||
		ev.which !== 3 ||
		!quickMenuObject.mouseDownTimer ||
		getSelectedText(ev.target) === ""
	) return false;
			
	quickMenuObject.mouseLastClickTime = Date.now();
	
	ev.stopPropagation();
	
	document.addEventListener('contextmenu', (evv) => {
		evv.preventDefault();
	}, {once: true}); // parameter to run once, then delete
	
	openQuickMenu(ev);
	
});

function openQuickMenu(ev) {
	browser.runtime.sendMessage({action: "openQuickMenu", screenCoords: {x: quickMenuObject.screenCoords.x, y: quickMenuObject.screenCoords.y}, searchTerms: getSelectedText(ev.target)});
}

function main(coords) {

	var hover_div = document.createElement('quickmenu');
	hover_div.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	hover_div.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	hover_div.style.minWidth = Math.min(userOptions.quickMenuColumns,userOptions.quickMenuItems,userOptions.searchEngines.length) * (16 + 16 + 2) + "px"; //icon width + padding + border

	hover_div.id = 'hover_div';
	hover_div.onclick = function(e) {
		e.stopPropagation();
		if (quickMenuObject.locked) return false;
		closeQuickMenu();
	};
	
	// remove old popup
	var old_hover_div = document.getElementById(hover_div.id);
	if (old_hover_div !== null && old_hover_div.parentNode) old_hover_div.parentNode.removeChild(old_hover_div);
	
	// generic search engine tile
	function buildSearchIcon(icon_url, title) {
		var div = document.createElement('DIV');
		div.style.backgroundImage = 'url(' + icon_url + ')';
		div.style.clear = "none";	
		div.title = title;
		return div;
	}
	
	// array for all tiles
	let tileArray = [];
	
	function disableTile(t) {
		t.style.filter="grayscale(100%)";
		t.style.backgroundColor="#ddd";
		t.onclick = function(e) {
			e.stopPropagation();
		};
	}
	
	for (let tool of userOptions.quickMenuTools) {
		
		if (tool.disabled) continue;
		switch (tool.name) {
			
			case "copy":
				// clipboard
				var tile = buildSearchIcon(browser.runtime.getURL("icons/clipboard.png"), "Copy to clipboard");
				tile.onclick = function(e) {
					
					// clipboard workaround for text boxes
					let input = document.createElement('input');
					input.type = "text";
					input.value = quickMenuObject.searchTerms;
					input.style = 'width:0;height:0;border:0;padding:0;margin:0;position:absolute;left:-1px;';
					document.body.appendChild(input);
					input.select();
					document.execCommand("copy");
					document.body.removeChild(input);
				};

				tileArray.push(tile);
				break;
			
			case "link":
				// open as link
				var tile = buildSearchIcon(browser.runtime.getURL("icons/link.png"), "Open as link");
				tile.onclick = function(e) {

					browser.runtime.sendMessage({
						action: "openTab", 
						info: {
							modifiers: [
								(e.shiftKey) ? "Shift" : null,
								(e.ctrlKey) ? "Ctrl": null
							],
							menuItemId: 0,
							selectionText: quickMenuObject.searchTerms,
							openUrl: true
						}
					});
				};
				
				tile.onmousedown = function(e) {
					e.stopPropagation();
					return false;
				}
				
				// disable if clearly not an url
				if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
					disableTile(tile);
				}
				tileArray.push(tile);
				break;
				
			case "close":
				var tile = buildSearchIcon(browser.runtime.getURL("icons/close.png"), "Close menu");
				tile.onmousedown = function(e) {
					e.stopPropagation();
					return false;
				}
				tile.onclick = function(e) {
					closeQuickMenu();
				}
				tileArray.push(tile);
				break;
			
			case "disable":
				var tile = buildSearchIcon(browser.runtime.getURL("icons/power.png"), "Disable menu");
				tile.onclick = function(e) {
					userOptions.quickMenu = false;
					closeQuickMenu();
				}
				tile.onmousedown = function(e) {
					e.stopPropagation();
					return false;
				}

				tileArray.push(tile);
				break;
				
			case "lock":
				var tile = buildSearchIcon(browser.runtime.getURL("icons/lock.png"), "Lock menu open (multi-search)");
				tile.onclick = function(e) {
					e.stopPropagation();
					
					switch (this.locked) {
						case undefined:
						case false:
							this.style.backgroundColor = '#dee7f0';
							this.style.boxShadow = 'inset 2px 2px 2px #193047';

							hover_div.style.left = parseFloat(hover_div.style.left) - getOffsets().x + "px";
							hover_div.style.top = parseFloat(hover_div.style.top) - getOffsets().y + "px";
							hover_div.style.position='fixed';

							this.locked = quickMenuObject.locked = true;
							break;
							
						case true:
							this.style.backgroundColor = '';
							this.style.boxShadow = '';

							hover_div.style.left = parseFloat(hover_div.style.left) + getOffsets().x + "px";
							hover_div.style.top = parseFloat(hover_div.style.top) + getOffsets().y + "px";
							hover_div.style.position='';

							this.locked = quickMenuObject.locked = false;
							break;
					}
				}
				tile.onmousedown = function(e) {
					e.stopPropagation();
					return false;
				}
				tileArray.push(tile);
				break;
		}
	}
	
	for (var i=0;i<userOptions.searchEngines.length && i < userOptions.quickMenuItems;i++) {
		let tile = buildSearchIcon(userOptions.searchEngines[i].icon_base64String, userOptions.searchEngines[i].title);
		tile.index = i;	
		tile.onclick = function(e) {
			e.preventDefault();			

			browser.runtime.sendMessage({
				action: "openTab", 
				info: {
					modifiers: [
						(e.shiftKey) ? "Shift" : null,
						(e.ctrlKey) ? "Ctrl": null
					],
					menuItemId: this.index,
					selectionText: quickMenuObject.searchTerms
				}
			});
			
			if (e.altKey || !userOptions.quickMenuCloseOnClick)
				e.stopPropagation();
		}	
		tileArray.push(tile);
	}
	
	for (let i=0;i<tileArray.length;i++) {
		let tile = tileArray[i];
		tile.style.clear = (i % userOptions.quickMenuColumns === 0) ? "left" : "none";
		hover_div.appendChild(tile);
	}
	
	// check if any search engines exist and link to Options if none
	if (userOptions.searchEngines.length === 0 || typeof userOptions.searchEngines[0].icon_base64String === 'undefined' ) {
		var div = document.createElement('div');
		div.style='display:inline-block;width:auto;clear:both;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
			div.style.minWidth = hover_div.style.minWidth;
		div.innerText = 'Where are my search engines?';
		div.onclick = function() {
			alert('If you are seeing this message, reload your search settings file');
			browser.runtime.sendMessage({action: "openOptions"});	
		}	
		hover_div.appendChild(div);
	}
	
	document.body.appendChild(hover_div);
	
	// Check if quickmenu fails to display
	var els = hover_div.getElementsByTagName('*');
	for (var i in els) {
		if (els[i].nodeType === undefined || els[i].nodeType !== 1) continue;
		if (hover_div.ownerDocument.defaultView.getComputedStyle(els[i], null).getPropertyValue("display") === 'none' || hover_div.ownerDocument.defaultView.getComputedStyle(hover_div, null).getPropertyValue("display") === 'none') {
			console.log('quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'}).then(() => {
				let mev = new MouseEvent('contextmenu', {
					view: window,
					bubbles: true,
					cancelable: true
				});
				document.elementFromPoint(x, y).dispatchEvent(mev);
			});
			break;
		}
	}

	// scale quickmenu
	userOptions.quickMenuScaleOnZoom = userOptions.quickMenuScaleOnZoom || true;

	let new_scale = (userOptions.quickMenuScaleOnZoom) ? (userOptions.quickMenuScale / window.devicePixelRatio) : userOptions.quickMenuScale;
	
	hover_div.style.transformOrigin = "top left";
	hover_div.style.transform = "scale(" + new_scale + ")";
		
	// position quickmenu
	let quickMenuWidth = Math.min(userOptions.quickMenuColumns,tileArray.length) * (16 + 16 + 2) + 2;
	let quickMenuHeight = (Math.ceil(tileArray.length / userOptions.quickMenuColumns) * (16 + 16 + 2) + 2);
	
	for (let position of userOptions.quickMenuPosition.split(" ")) {
		switch (position) {
			case "left":
				hover_div.style.left = ((parseFloat(hover_div.style.left) ) - quickMenuWidth * userOptions.quickMenuScale / window.devicePixelRatio) + "px";
				break;
			case "right":
				break;
			case "center":
				hover_div.style.left = (parseFloat(hover_div.style.left) ) - quickMenuWidth / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "top":
				hover_div.style.top = ((parseFloat(hover_div.style.top) ) - quickMenuHeight * userOptions.quickMenuScale / window.devicePixelRatio) + "px";
				break;
			case "bottom":
				break;
		}
	}

	// move if offscreen
	var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	var scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;

	var rect = hover_div.getBoundingClientRect();

	if (rect.y < 0) 
		hover_div.style.top =  (parseFloat(hover_div.style.top) - rect.y) + "px";
	
	if (rect.y + rect.height > window.innerHeight) 
		hover_div.style.top = parseFloat(hover_div.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	if (rect.x < 0) 
		hover_div.style.left = (parseFloat(hover_div.style.left) - rect.x) + "px";
	
	if (rect.x + rect.width > window.innerWidth) 
		hover_div.style.left = parseFloat(hover_div.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";
	
	hover_div.style.opacity=1;
	return false;
}

function getOffsets() {
	let xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);	
	let yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);
	
	return {x: xOffset, y: yOffset};
}

function getSelectedText(el) {
	
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString();

}

function closeQuickMenu(eventType) {
	eventType = eventType || null;
	
	if ((eventType === 'wheel' || eventType === 'scroll') && (!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)) return false;
	if (eventType === 'click_window' && quickMenuObject.locked) return false;
	
	var hover_div = document.getElementById('hover_div');
	if (hover_div !== null) {
		hover_div.style.opacity=0;
		setTimeout(()=> {
			if (hover_div !== null && hover_div.parentNode !== null) {
				hover_div.parentNode.removeChild(hover_div);
				document.dispatchEvent(new CustomEvent('closequickmenu'));
			}
		},100);
	}
}

// unlock if quickmenu is closed
document.addEventListener('closequickmenu', () => {
	quickMenuObject.locked = false;
});

// close quickmenu when clicking anywhere on page
document.addEventListener("click", (ev) => {

	if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_window"});

});

// track mouse position
document.addEventListener("mousemove", (ev) => {
	quickMenuObject.mouseCoords = {x: ev.clientX, y: ev.clientY};
	quickMenuObject.screenCoords = {x: ev.screenX, y: ev.screenY};
});

// prevent quickmenu during drag events
document.addEventListener("drag", (ev) => {
	clearTimeout(quickMenuObject.mouseDownTimer);
});

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", (ev) => {
	quickMenuObject.lastSelectTime = Date.now();
	if (window.getSelection().toString() !== '')
		browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: window.getSelection().toString()});
});

// selectionchagne handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea")) {
	el.addEventListener('blur', (e) => {
		let text = getSelectedText(e.target)
		if (text !== '')
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: text});
	});
}

/*
document.addEventListener('contextmenu', (e) => {
	if (
		!userOptions.contextMenu ||
		getSelectedText() === ''
	) return false;
	
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: (e.targetgetSelectedText()})
}
*/
window.addEventListener('focus', (ev) => {
	setTimeout(() => {
		browser.runtime.sendMessage({action: "nativeAppRequest"});
	}, 500);
});

function scrollEventListener(ev) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: ev.type});
	setTimeout(() => {
		window.scrollThrottler = false;
	},250);
}
window.addEventListener('wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	
	if (typeof message.userOptions !== 'undefined') {
		userOptions = message.userOptions || {};
	}
	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			
			case "closeQuickMenuRequest":
				closeQuickMenu(message.eventType || null);
				break;
				
			case "openQuickMenu":
				let x = (message.screenCoords.x - (quickMenuObject.screenCoords.x - quickMenuObject.mouseCoords.x * window.devicePixelRatio)) / window.devicePixelRatio;
				
				let y = (message.screenCoords.y - (quickMenuObject.screenCoords.y - quickMenuObject.mouseCoords.y * window.devicePixelRatio)) / window.devicePixelRatio;

				quickMenuObject.searchTerms = message.searchTerms;
				main({'x': x,'y': y});
				break;
			
			case "updateSearchTerms":
				// only update if quickmenu is opened and locked to avoid unwanted behavior
				if (quickMenuObject.locked) {
					quickMenuObject.searchTerms = message.searchTerms;
					console.log("Received new search terms -> " + quickMenuObject.searchTerms);
				}
				break;
		}
	}
});

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});
