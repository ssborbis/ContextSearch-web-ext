// unique object to reference globally
var quickMenuObject = { 
	delay: 250, // how long to hold right-click before quick menu events in ms
	keyDownTimer: 0,
	mouseDownTimer: 0,
	mouseCoords: {x:0, y:0},
	screenCoords: {x:0, y:0},
	mouseCoordsInit: {x:0, y:0},
	mouseLastClickTime: 0,
	mouseDragDeadzone: 4,
	lastSelectTime: 0,
	locked: false,
	searchTerms: "",
	disabled: false,
	mouseDownTargetIsTextBox: false
};

var userOptions = {};

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.which !== 27 ||
		ev.repeat ||
		!userOptions.quickMenu		
	) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});
		
});

// Listen for quickMenuKey
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.which !== userOptions.quickMenuKey ||
		ev.repeat ||
		!userOptions.quickMenuOnKey ||
		!userOptions.quickMenu ||
		getSelectedText(ev.target) === "" ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs)
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
		getSelectedText(ev.target) === "" ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs )
	) return false;
	
	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	// timer for mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		
		// prevent drag events when using search on mouseup
	//	if (userOptions.quickMenuSearchOnMouseUp) {
			window.addEventListener('dragstart', (e) => {
				e.preventDefault();
			}, {once: true});
	//	}

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

//	document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});

});

function preventContextMenuHandler(evv) {
	evv.preventDefault();
}

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		ev.which !== userOptions.quickMenuMouseButton
	) return false;
		
	clearTimeout(quickMenuObject.mouseDownTimer);
//	document.removeEventListener('contextmenu', preventContextMenuHandler);
});

// Listen for quickMenuAuto 
document.addEventListener('mousedown', (ev) => {
	
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		ev.which !== 1 ||
		ev.target.id === 'quickMenuElement' ||
		ev.target.parentNode.id === 'quickMenuElement'
	) return false;
	
	quickMenuObject.mouseDownTargetIsTextBox = isTextBox(ev.target);
	
});

document.addEventListener('mouseup', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		ev.which !== 1 ||
		ev.target.id === 'quickMenuElement' ||
		ev.target.parentNode.id === 'quickMenuElement' ||
		getSelectedText(ev.target) === "" ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs ) ||
		( quickMenuObject.mouseDownTargetIsTextBox && !userOptions.quickMenuAutoOnInputs )
	) return false;

	if (Date.now() - quickMenuObject.lastSelectTime > 1000 && !isTextBox(ev.target) ) return false;
	
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
		getSelectedText(ev.target) === "" ||
		((ev.target.type === 'text' || ev.target.type === 'textarea' || ev.target.isContentEditable ) && !userOptions.quickMenuAutoOnInputs)
	) return false;

	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	function preventContextMenuHandler(evv) {
		evv.preventDefault();
	}
	
	document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});
	
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		document.removeEventListener('contextmenu', preventContextMenuHandler);
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
	
	// document.addEventListener('contextmenu', (evv) => {
		// evv.preventDefault();
	// }, {once: true}); // parameter to run once, then delete
	
	openQuickMenu(ev);
	
});

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

	if (document.title === "QuickMenu") {
		return;
	}
	
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
				makeQuickMenuContainer({'x': x,'y': y});
				break;
			
			case "updateSearchTerms":
				// only update if quickmenu is opened and locked OR using IFRAME popup to avoid unwanted behavior
				if (quickMenuObject.locked || document.title === "QuickMenu") {
					quickMenuObject.searchTerms = message.searchTerms;
					
					// send event to OpenAsLink tile to enable/disable
					document.dispatchEvent(new CustomEvent('updatesearchterms'));

					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					});
				}
				break;
			
			case "updateQuickMenuObject":
				quickMenuObject = message.quickMenuObject;
				
				// iframe needs to disable here
				if (quickMenuObject.disabled)
					userOptions.quickMenu = false;
				
				let qm = document.getElementById('quickMenuContainerElement')
				
				if( qm && message.toggleLock ) {
				
					if (quickMenuObject.locked) {
						qm.style.left = parseFloat(qm.style.left) - getOffsets().x + "px";
						qm.style.top = parseFloat(qm.style.top) - getOffsets().y + "px";
						qm.style.position='fixed';
					} else {
						qm.style.left = parseFloat(qm.style.left) + getOffsets().x + "px";
						qm.style.top = parseFloat(qm.style.top) + getOffsets().y + "px";
						qm.style.position=null;
					}
				}
		
				break;
				
			case "quickMenuIframeLoaded":
			
				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
				
				scaleAndPositionQuickMenu(message.size);
				
				break;
		}
	}
});

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

function openQuickMenu(ev) {
	
	ev = ev || new Event('click');

	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: {
			x: quickMenuObject.screenCoords.x, 
			y: quickMenuObject.screenCoords.y}, 
		searchTerms: getSelectedText(ev.target).trim(),
		quickMenuObject: quickMenuObject
	});
}

function closeQuickMenu(eventType) {
	eventType = eventType || null;
		
	if (
		(eventType === 'wheel' || eventType === 'scroll') && 
		(!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)
	) return false;
	
	if (
		eventType === 'click_window' && 
		quickMenuObject.locked
	) return false;
	
	var quickMenuElement = document.getElementById('quickMenuContainerElement');
	if (quickMenuElement !== null) {
		quickMenuElement.style.opacity=0;
		setTimeout(()=> {
			if (quickMenuElement !== null && quickMenuElement.parentNode !== null) {
				quickMenuElement.parentNode.removeChild(quickMenuElement);
				document.dispatchEvent(new CustomEvent('closequickmenu'));
			}
		},100);
	}
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function getOffsets() {
	let xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);	
	let yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);
	
	return {x: xOffset, y: yOffset};
}

function scaleAndPositionQuickMenu(size) {
	let qmc = document.getElementById('quickMenuContainerElement');
	if (!qmc) return;
	
	size = size || {
		width: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("width"), 
		height: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("height")
	};
	
	// scale quickmenu
	userOptions.quickMenuScaleOnZoom = userOptions.quickMenuScaleOnZoom || true;

	let new_scale = (userOptions.quickMenuScaleOnZoom) ? (userOptions.quickMenuScale / window.devicePixelRatio) : userOptions.quickMenuScale;
	
	qmc.style.transformOrigin = "top left";
	qmc.style.transform = "scale(" + new_scale + ")";
	
	qmc.style.width = parseFloat(size.width) + "px";
	qmc.style.height = parseFloat(size.height) + "px";
	
	for (let position of userOptions.quickMenuPosition.split(" ")) {
		switch (position) {
			case "left":
				qmc.style.left = parseFloat(qmc.style.left) - parseFloat(qmc.style.width) * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "right":
				break;
			case "center":
				qmc.style.left = parseFloat(qmc.style.left) - parseFloat(qmc.style.width) / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "top":
				qmc.style.top = parseFloat(qmc.style.top) - parseFloat(qmc.style.height) * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "bottom":
				break;
		}
	}
	
	repositionOffscreenElement( qmc );
	qmc.style.opacity = 1;
}

function repositionOffscreenElement( element ) {
	
	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	let rect = element.getBoundingClientRect();

	if (rect.y < 0) 
		element.style.top = (parseFloat(element.style.top) - rect.y) + "px";
	
	if (rect.y + rect.height > window.innerHeight) 
		element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	if (rect.x < 0) 
		element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	if (rect.x + rect.width > window.innerWidth) 
		element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

}

function calculateQuickMenuSize() {
	let tileCount = 0;
	for (let tool of userOptions.tools) {
		if (!tool.disabled) tileCount++;
	}
	for (let se of userOptions.searchEngines) {
		if (!se.hidden) tileCount++;
	}
	
	let rows = Math.ceil(tileCount / userOptions.quickMenuColumns);
	let height = rows * (16 + 16 + 2);
	let width = Math.min(userOptions.quickMenuColumns,userOptions.quickMenuItems,userOptions.searchEngines.length) * (16 + 16 + 2);
	
	return {height: height, width: width};
}

// build the floating container for the quickmenu
// tag type depends on userOptions.trackingProtection
function makeQuickMenuContainer(coords) {
	
	let qmc = document.getElementById('quickMenuContainerElement');
		
	if (qmc) qmc.parentNode.removeChild(qmc);
	
//	if (userOptions.quickMenuTrackingProtection)
		qmc = document.createElement('iframe');
//	else 
//		qmc = document.createElement('quickmenucontainer');
	
	qmc.id = "quickMenuContainerElement";

	qmc.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	qmc.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	
	document.body.appendChild(qmc);
	
//	if (userOptions.quickMenuTrackingProtection) {
		qmc.src = browser.runtime.getURL('quickmenu.html');
//	} else {
//		qmc.appendChild(makeQuickMenu(coords));
//		scaleAndPositionQuickMenu();
//	}
			
	// Check if quickmenu fails to display
	setTimeout(() => {
		if (!qmc || qmc.ownerDocument.defaultView.getComputedStyle(els[i], null).getPropertyValue("display") === 'none') {
			console.log('iframe quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'});
		}
	},1000);

/*	var els = qmc.getElementsByTagName('*');
	for (var i in els) {
		if (els[i].nodeType === undefined || els[i].nodeType !== 1) continue;
		if (qmc.ownerDocument.defaultView.getComputedStyle(els[i], null).getPropertyValue("display") === 'none' || qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("display") === 'none') {
			console.log('quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'});
			break;
		}
	}
*/
}

function makeQuickMenu() {
	
	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	var quickMenuElement = document.createElement('div');

	quickMenuElement.id = 'quickMenuElement';
	
	let sb = document.getElementById('quickmenusearchbar');
	sb.onclick = function(e) {
		e.stopPropagation();
	}
	sb.onmouseup = function(e) {
		e.stopPropagation();
	}
	sb.onkeydown = function(e) {
		if (e.keyCode === 13) {
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: 0,
					selectionText: sb.value,//quickMenuObject.searchTerms,
					openMethod: getOpenMethod(e)
				}
			});

		}
	}
	sb.focus();
	
	sb.addEventListener('keydown', (e) => {
		if (e.keyCode === 9) {
			e.preventDefault();
			sb.select();
		}
	});
	
	document.addEventListener('updatesearchterms', (e) => {
		sb.value = quickMenuObject.searchTerms;
	});
	
	if (!userOptions.quickMenuSearchBar) {
		sb.style.display = 'none';
		sb.style.height = '0';
	}
	
	// prevent click events from propagating
	for (let eventType of ['mousedown', 'mouseup', 'click', 'contextmenu']) {
		quickMenuElement.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	}
	
	// generic search engine tile
	function buildSearchIcon(icon_url, title) {
		var div = document.createElement('DIV');
		div.style.backgroundImage = 'url(' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + ')';
		div.style.backgroundSize = 16 * userOptions.quickMenuIconScale + "px";
		div.title = title;
		return div;
	}
	
	// get open method based on user preferences
	function getOpenMethod(e) {
		let openMethod = "";
		if (e.which === 3)
			openMethod = userOptions.quickMenuRightClick;
		else if (e.which === 2)
			openMethod = userOptions.quickMenuMiddleClick;
		else if (e.which === 1) {
			openMethod = userOptions.quickMenuLeftClick;
			
			// ignore methods that aren't opening methods
			if (e.shiftKey && userOptions.quickMenuShift !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuShift;
			if (e.ctrlKey && userOptions.quickMenuCtrl !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuCtrl;
			if (e.altKey && userOptions.quickMenuAlt !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuAlt;
		
		}

//		console.log("openMethod => " + openMethod);
		return openMethod
	}
	
	// method for assigning tile click handler
	function addTileEventHandlers(_tile, handler) {
		
		// all click events are attached to mouseup
		_tile.addEventListener('mouseup', (e) => {

			// check if this tile was target of the latest mousedown event
			if ( !userOptions.quickMenuSearchOnMouseUp && !_tile.isSameNode(_tile.parentNode.lastMouseDownTile)) return;
			
			// prevents unwanted propagation from triggering a parentWindow.click event call to closequickmenu
			quickMenuObject.mouseLastClickTime = Date.now();
			
			if (document.title === "QuickMenu") {
				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
			}
				
			// custom tile methods
			handler(e);
			
			// check for locked / Keep Menu Open 
			if (
				!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
				!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
				!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen") &&
				userOptions.quickMenuCloseOnClick &&
				!quickMenuObject.locked
			) {
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_quickmenutile"});
			}

		});
		
		// prevent triggering click event accidentally releasing mouse button when menu is opened by HOLD method
		_tile.addEventListener('mousedown', (e) => {
			_tile.parentNode.lastMouseDownTile = _tile;
		});
		
		// stop all other mouse events for this tile from propagating
		for (let eventType of ['mousedown','mouseup','click','contextmenu']) {
			_tile.addEventListener(eventType, (e) => {
				e.preventDefault();
				e.stopPropagation();
				return false;
			});
		}
		
	}

	// array for all tiles
	let tileArray = [];

	// iterate over tools
	for (let tool of userOptions.quickMenuTools) {

		// skip disabled tools
		if (tool.disabled) continue;
		
		switch (tool.name) {
			
			case "copy": // clipboard
				let tile_copy = buildSearchIcon(browser.runtime.getURL("/icons/clipboard.png"), browser.i18n.getMessage("tools_Copy"));
				
				addTileEventHandlers(tile_copy, (e) => {
					let input = document.createElement('input');
					input.type = "text";
					input.value = sb.value;//quickMenuObject.searchTerms;
					input.style = 'width:0;height:0;border:0;padding:0;margin:0;position:absolute;left:-1px;';
					document.body.appendChild(input);
					input.select();
					document.execCommand("copy");
					document.body.removeChild(input);
				});
				
				tileArray.push(tile_copy);
				break;
			
			case "link": // open as link
				let tile_link = buildSearchIcon(browser.runtime.getURL("/icons/link.png"), browser.i18n.getMessage("tools_OpenAsLink"));

				// enable/disable link button on very basic 'is it a link' rules
				function setDisabled() {
					if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
						tile_link.style.filter="grayscale(100%)";
						tile_link.style.backgroundColor="#ddd";
						tile_link.disabled = true;
					} else {
						tile_link.style.filter=null;
						tile_link.style.backgroundColor=null;
						tile_link.disabled = false;
					}
				}
				
				// set initial disabled state
				setDisabled();
				
				// when new search terms are set while locked, enable/disable link
				document.addEventListener('updatesearchterms', (e) => {
					setDisabled();
				});
					
				addTileEventHandlers(tile_link, (e) => {
					if (tile_link.disabled) return;
					
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: 0,
							selectionText: quickMenuObject.searchTerms,
							openMethod: getOpenMethod(e),
							openUrl: true
						}
					});
				});
				
				tileArray.push(tile_link);
				break;
				
			case "close": // simply close the quick menu
				let tile_close = buildSearchIcon(browser.runtime.getURL("/icons/close.png"), browser.i18n.getMessage("tools_Close"));

				tile_close.onclick = function(e) {
					browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
				}
				
				tileArray.push(tile_close);
				break;
			
			case "disable": // close the quick menu and disable for this page / session
				let tile_disable = buildSearchIcon(browser.runtime.getURL("/icons/power.png"), browser.i18n.getMessage("tools_Disable"));
				tile_disable.onclick = function(e) {
					
					userOptions.quickMenu = false;
					quickMenuObject.disabled = true;
					
					if (document.title === "QuickMenu") {
						browser.runtime.sendMessage({
							action: "updateQuickMenuObject", 
							quickMenuObject: quickMenuObject
						});
					}
					
					browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});
				}

				tileArray.push(tile_disable);
				break;
				
			case "lock": // keep quick menu open after clicking search / scrolling / window click
				let tile_lock = buildSearchIcon(browser.runtime.getURL("/icons/lock.png"), browser.i18n.getMessage("tools_Lock"));
				
				tile_lock.locked = false;
				tile_lock.onclick = function(e) {
					
					let qm = document.getElementById('quickMenuContainerElement');

					switch (this.locked) {
						case false:
							this.style.backgroundColor = '#dee7f0';
							this.style.boxShadow = 'inset 2px 2px 2px #193047';

							this.locked = quickMenuObject.locked = true;
							break;
							
						case true:
							this.style.backgroundColor = null;
							this.style.boxShadow = null;

							this.locked = quickMenuObject.locked = false;
							break;
					}
					
					// update qmo for both iframe and quickmenucontainer methods
					// lock styles methods moved to onMessage listener
					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject,
						toggleLock: true
					});
				}

				tileArray.push(tile_lock);
				break;
		}
	}

	let visibleCount = 0; // separate index for ignoring hidden engines v1.3.2+
	for (var i=0;i<userOptions.searchEngines.length && i < userOptions.quickMenuItems;i++) {
		
		let se = userOptions.searchEngines[i];
		
		if ( se.hidden !== undefined && se.hidden) continue;

		let tile = buildSearchIcon(se.icon_base64String, se.title);

		tile.index = i;
		
		addTileEventHandlers(tile, (e) => {
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: tile.index,
					selectionText: sb.value,//quickMenuObject.searchTerms,
					openMethod: getOpenMethod(e)
				}
			});
		});

		tileArray.push(tile);
	}

	// make rows / columns
	for (let i=0;i<tileArray.length;i++) {
		let tile = tileArray[i];

		quickMenuElement.appendChild(tile);
		
		if ( (i + 1) % userOptions.quickMenuColumns === 0) {
			let br = document.createElement('br');
			tile.parentNode.insertBefore(br, tile.nextSibling);
		}
	}
	
	// check if any search engines exist and link to Options if none
	if (userOptions.searchEngines.length === 0 || typeof userOptions.searchEngines[0].icon_base64String === 'undefined' ) {
		var div = document.createElement('div');
		div.style='width:auto;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
		div.innerText = browser.i18n.getMessage("WhereAreMyEngines");
		div.onclick = function() {
			browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=searchengines"});
		}	
		quickMenuElement.appendChild(div);
	}

	return quickMenuElement;
}

function isTextBox(element) {
	
	if ( element.type === 'text' || element.type === 'textarea' || element.isContentEditable )
		return true;
	else
		return false;
}

// Special setup for IFRAME popup
if (document.title === "QuickMenu") {
	document.addEventListener("DOMContentLoaded", () => {
	
		browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
			userOptions = message.userOptions || {};
			
			if ( userOptions === {} ) return;
			
			let quickMenuElement = makeQuickMenu();
			document.body.appendChild(quickMenuElement);
			
			
			
			// if (true) {
				// document.body.appendChild(document.getElementById('quickmenusearchbar'));
			// }

			browser.runtime.sendMessage({
				action: "quickMenuIframeLoaded", 
				size: {
					width: quickMenuElement.ownerDocument.defaultView.getComputedStyle(quickMenuElement, null).getPropertyValue("width"), 
					height:parseInt(quickMenuElement.ownerDocument.defaultView.getComputedStyle(quickMenuElement, null).getPropertyValue("height")) + parseInt(document.getElementById('quickmenusearchbar').ownerDocument.defaultView.getComputedStyle(document.getElementById('quickmenusearchbar'), null).height) + 'px'
				}
			});
		});
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.action !== 'undefined') {
			switch (message.action) {
				case "updateQuickMenuObject":
					quickMenuObject = message.quickMenuObject;
					
					// send event to OpenAsLink tile to enable/disable
					document.dispatchEvent(new CustomEvent('updatesearchterms'));
					break;
			}
		}
	});
}

