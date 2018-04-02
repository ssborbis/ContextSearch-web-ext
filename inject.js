
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
	searchTerms: "",
	lastMouseDownTile: null
};

var userOptions = {};
var safeUserOptions = {};


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
		getSelectedText(ev.target) === "" ||
		((ev.target.type === 'text' || ev.target.type === 'textarea') && !userOptions.quickMenuAutoOnInputs)
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
	
	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: {
			x: quickMenuObject.screenCoords.x, 
			y: quickMenuObject.screenCoords.y}, 
		searchTerms: getSelectedText(ev.target).trim()
	});
}

function main(coords) {
	
	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	var hover_div = document.createElement('quickmenu');
	hover_div.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	hover_div.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	hover_div.style.minWidth = Math.min(userOptions.quickMenuColumns,userOptions.quickMenuItems,userOptions.searchEngines.length) * (16 + 16 + 2) + "px"; //icon width + padding + border

	hover_div.id = 'hover_div';
	
	// prevent click events from propagating
	for (let eventType of ['mousedown', 'mouseup', 'click', 'contextmenu']) {
		hover_div.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	}
	
	// remove old popup
	var old_hover_div = document.getElementById(hover_div.id);
	if (old_hover_div !== null && old_hover_div.parentNode) old_hover_div.parentNode.removeChild(old_hover_div);
	
	// generic search engine tile
	function buildSearchIcon(icon_url, title) {
		var div = document.createElement('DIV');
		div.style.backgroundImage = 'url(' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + ')';
		div.style.clear = "none";	
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

		console.log("openMethod => " + openMethod);
		return openMethod
	}
	
	// method for assigning tile click handler
	function addTileEventHandlers(_tile, handler) {
		
		// all click events are attached to mouseup
		_tile.addEventListener('mouseup', (e) => {

			// check if this tile was target of the latest mousedown event
			if (!_tile.isSameNode(quickMenuObject.lastMouseDownTile)) return;
			
			// prevents unwanted propagation from triggering a window.click event call to closequickmenu
			quickMenuObject.mouseLastClickTime = Date.now();
			
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
				closeQuickMenu('click_quickmenutile');	
			}

		});
		
		// prevent triggering click event accidentally releasing mouse button when menu is opened by HOLD method
		_tile.addEventListener('mousedown', (e) => {
			quickMenuObject.lastMouseDownTile = _tile;
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
				var tile = buildSearchIcon(browser.runtime.getURL("/icons/clipboard.png"), "Copy to clipboard");
				
				addTileEventHandlers(tile, (e) => {
					let input = document.createElement('input');
					input.type = "text";
					input.value = quickMenuObject.searchTerms;
					input.style = 'width:0;height:0;border:0;padding:0;margin:0;position:absolute;left:-1px;';
					document.body.appendChild(input);
					input.select();
					document.execCommand("copy");
					document.body.removeChild(input);
				});
				
				tileArray.push(tile);
				break;
			
			case "link": // open as link
				var tile = buildSearchIcon(browser.runtime.getURL("/icons/link.png"), "Open as link");

				// enable/disable link button on very basic 'is it a link' rules
				function setDisabled() {
					if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
						tile.style.filter="grayscale(100%)";
						tile.style.backgroundColor="#ddd";
						tile.disabled = true;
					} else {
						tile.style.filter="";
						tile.style.backgroundColor="";
						tile.disabled = false;
					}
				}
				
				// set initial disabled state
				setDisabled();
				
				// when new search terms are set while locked, enable/disable link
				document.addEventListener('updatesearchterms', (e) => {
					setDisabled();
				});
					
				addTileEventHandlers(tile, (e) => {
					if (tile.disabled) return;
					
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
				
				tileArray.push(tile);
				break;
				
			case "close": // simply close the quick menu
				var tile = buildSearchIcon(browser.runtime.getURL("/icons/close.png"), "Close menu");

				tile.onclick = function(e) {
					closeQuickMenu();
				}
				
				tileArray.push(tile);
				break;
			
			case "disable": // close the quick menu and disable for this page / session
				var tile = buildSearchIcon(browser.runtime.getURL("/icons/power.png"), "Disable menu");
				tile.onclick = function(e) {
					userOptions.quickMenu = false;
					closeQuickMenu();
				}

				tileArray.push(tile);
				break;
				
			case "lock": // keep quick menu open after clicking search / scrolling / window click
				var tile = buildSearchIcon(browser.runtime.getURL("/icons/lock.png"), "Lock menu open (multi-search)");
				
				tile.locked = false;
				tile.onclick = function(e) {

					switch (this.locked) {
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

				tileArray.push(tile);
				break;
		}
	}
	
	let visibleCount = 0; // separate index for ignoring hidden engines v1.3.2+
	for (var i=0;i<userOptions.searchEngines.length && i < userOptions.quickMenuItems;i++) {
		
		if ( userOptions.searchEngines[i].hidden !== undefined && userOptions.searchEngines[i].hidden) continue;
		
		let tile = buildSearchIcon(userOptions.searchEngines[i].icon_base64String, userOptions.searchEngines[i].title);
	//	tile.index = visibleCount++;
		tile.index = i;
		
		addTileEventHandlers(tile, (e) => {
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: tile.index,
					selectionText: quickMenuObject.searchTerms,
					openMethod: getOpenMethod(e)
				}
			});
		});

		tileArray.push(tile);
	}
	
	// make rows / columns
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
		//	alert('If you are seeing this message, reload your search settings file from Options');
			browser.runtime.sendMessage({action: "openOptions", hashurl: "#searchengines"});
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
			browser.runtime.sendMessage({action: 'enableContextMenu'});
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
				hover_div.style.left = parseFloat(hover_div.style.left) - quickMenuWidth * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "right":
				break;
			case "center":
				hover_div.style.left = parseFloat(hover_div.style.left) - quickMenuWidth / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio + "px";
				break;
			case "top":
				hover_div.style.top = parseFloat(hover_div.style.top) - quickMenuHeight * userOptions.quickMenuScale / window.devicePixelRatio + "px";
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
		
	if (
		(eventType === 'wheel' || eventType === 'scroll') && 
		(!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)
	) return false;
	
	if (
		eventType === 'click_window' && 
		quickMenuObject.locked
	) return false;
	
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
	el.addEventListener('mouseup', (e) => {
		let text = getSelectedText(e.target)
		if (text !== '')
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: text});
	});
}

// listen for right-mousedown and enable Add Custom Search menu item if no text is selected
function inputAddCustomSearchHandler(input) {
	input.addEventListener('mousedown', (ev) => {
		if (
			ev.which !== 3
			|| getSelectedText(input)
		) return;

		browser.runtime.sendMessage({action: "enableAddCustomSearch"});
	});
}

// Add Custom Search listener
for (let input of document.getElementsByTagName('input')) {
	inputAddCustomSearchHandler(input);
}

// Add listener for dynamically added inputs
var CS_observer = new MutationObserver((mutationsList) => {
	for(var mutation of mutationsList) {
        if (mutation.type == 'childList') {
			for (let node of mutation.addedNodes) {
				if (node.nodeName === "INPUT") {
					console.log("INPUT added dynamically to the DOM. Adding listener");
					inputAddCustomSearchHandler(node);
				}
			}
//			console.log(mutation);
//          console.log('A child node has been added or removed.');
        }
    }
});

CS_observer.observe(document.body, {childList: true, subtree: true});
/*
document.addEventListener('DOMNodeInserted', (ev) => {
	if (ev.target.tagName === "INPUT") {
		inputAddCustomSearchHandler(ev.target);
	}
});
*/

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', (e) => {

	if (
		e.which !== 3 ||
		!userOptions.contextMenu ||
		(getSelectedText(e.target) === '' && e.target.nodeName.toLowerCase() !== 'a') ||
		userOptions.searchEngines.length === 0
	) return false;

	let searchTerms = "";
	
	if (e.target.nodeName.toLowerCase() === 'a' && getSelectedText(e.target) === '')
		searchTerms = e.target.href;
	else
		searchTerms = getSelectedText(e.target);
	
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

// Good for checking new engines after window.external.AddSearchProvider()
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
//					console.log("Received new search terms -> " + quickMenuObject.searchTerms);
					document.dispatchEvent(new CustomEvent('updatesearchterms'));	
				}
				break;
				
			case "openSearchPopup":
				addSearchEnginePopup(message.data);
				break;
		}
	}
});
/*
browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});
*/
browser.runtime.sendMessage({action: "getSafeUserOptions"}).then((message) => {
	safeUserOptions = message.safeUserOptions || {};
	userOptions = safeUserOptions;
});
