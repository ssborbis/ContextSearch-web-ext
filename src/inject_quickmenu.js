

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

function preventContextMenuHandler(evv) {
	evv.preventDefault();
}

function scrollEventListener(ev) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: ev.type});
	setTimeout(() => {
		window.scrollThrottler = false;
	},250);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

function openQuickMenu(ev) {
	
	ev = ev || new Event('click');
		
	// links need to be blurred before focus can be applied to search bar (why?)
	if (userOptions.quickMenuSearchBarFocus /* && ev.target.nodeName === 'A' */) {
		
		// restore selection to text boxes
		if (ev.target.selectionStart) { // is a text box
			document.addEventListener('closequickmenu', (e) => {
				ev.target.focus();
			}, {once: true});
		}
		
		ev.target.blur();
	}
	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: {
			x: quickMenuObject.screenCoords.x, 
			y: quickMenuObject.screenCoords.y}, 
		searchTerms: getSelectedText(ev.target).trim() || getImage(ev.target) || getLink(ev.target),
		quickMenuObject: quickMenuObject,
		openingMethod: ev.openingMethod || null
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
	) {
		return false;
	}
	
	var quickMenuElement = document.getElementById('quickMenuIframe');
	if (quickMenuElement) {
		quickMenuElement.style.opacity=0;
		setTimeout(()=> {
			if (quickMenuElement && quickMenuElement.parentNode) {
				quickMenuElement.parentNode.removeChild(quickMenuElement);
				document.dispatchEvent(new CustomEvent('closequickmenu'));
			}
		},100);
	}
}

function getOffsets() {
	let xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);	
	let yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);
	
	return {x: xOffset, y: yOffset};
}

function scaleAndPositionQuickMenu(size, resizeOnly) {
	let qmc = document.getElementById('quickMenuIframe');
	if (!qmc) return;
	
	resizeOnly = resizeOnly || false;
	
	size = size || {
		width: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("width"), 
		height: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("height")
	};

	// scale quickmenu
	userOptions.quickMenuScaleOnZoom = userOptions.quickMenuScaleOnZoom || true;

	let new_scale = (userOptions.quickMenuScaleOnZoom) ? (userOptions.quickMenuScale / window.devicePixelRatio) : userOptions.quickMenuScale;
	
	qmc.style.transformOrigin = "top left";
	qmc.style.transform = "scale(" + new_scale + ")";
	
/*	qmc.addEventListener("transitionend", (e) => {
		if (e.propertyName !== "height") return;
		repositionOffscreenElement( qmc );
	}, {once: true});
*/
	
	qmc.style.width = parseFloat(size.width) + "px";
	qmc.style.height = parseFloat(size.height) + "px";
	
	if ( !userOptions.enableAnimations ) qmc.style.setProperty('--user-transition', 'none');
	
	runAtTransitionEnd( qmc, "height", () => { repositionOffscreenElement( qmc ) });
		
	if (! resizeOnly) { // skip positioning if this is a resize only
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
	}
	repositionOffscreenElement( qmc );
	
	return qmc;
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

// build the floating container for the quickmenu
function makeQuickMenuContainer(coords) {

	let qmc = document.getElementById('quickMenuIframe');
		
	if (qmc) qmc.parentNode.removeChild(qmc);
	
	qmc = document.createElement('iframe');

	qmc.id = "quickMenuIframe";

	qmc.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	qmc.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	
	document.body.appendChild(qmc);
	
	qmc.src = browser.runtime.getURL('quickmenu.html');

	// Check if quickmenu fails to display
	setTimeout(() => {
		if (!qmc || qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("display") === 'none') {
			console.log('iframe quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'});
		}
	},1000);

}

function isTextBox(element) {
	
	if ( element.type === 'text' || element.type === 'textarea' || element.isContentEditable )
		return true;
	else
		return false;
}

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.which !== 27 ||
		ev.repeat ||
		!userOptions.quickMenu		
	) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});
		
});

window.addEventListener('wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

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
		ev.which !== userOptions.quickMenuKey ||
		ev.repeat ||
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnKey
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
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		ev.which !== userOptions.quickMenuMouseButton ||
		( getSelectedText(ev.target) === "" && !getLink(ev.target) && !getImage(ev.target) ) ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs )
	) return false;
	
	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	// timer for mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		
		// prevent drag events when using search on mouseup
	//	if (userOptions.quickMenuSearchOnMouseUp) {
			window.addEventListener('dragstart', (e) => {
				console.log('preventing dragstart once');
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

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
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
		getSelectedText(ev.target).trim() === "" ||
		( userOptions.quickMenuAutoMaxChars && getSelectedText(ev.target).length > userOptions.quickMenuAutoMaxChars ) ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs ) ||
		( quickMenuObject.mouseDownTargetIsTextBox && !userOptions.quickMenuAutoOnInputs )
		
	) return false;
	
	ev.openingMethod = "auto";

	if (Date.now() - quickMenuObject.lastSelectTime > 1000 && !isTextBox(ev.target) ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	clearTimeout(quickMenuObject.mouseDownTimer);
	
	// // skip erroneous short selections
	let searchTerms = getSelectedText(ev.target);
	setTimeout( () => {
		if ( searchTerms === getSelectedText(ev.target) )	
			 openQuickMenu(ev);
	}, 50);

});

// Listen for quickMenuOnClick
document.addEventListener('mousedown', (ev) => {	

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'click' ||
		ev.which !== userOptions.quickMenuMouseButton ||
		( getSelectedText(ev.target) === "" && !getLink(ev.target) && !getImage(ev.target) ) ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs)
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
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'click' ||
		ev.which !== userOptions.quickMenuMouseButton ||
		!quickMenuObject.mouseDownTimer ||
		( getSelectedText(ev.target) === "" && !getLink(ev.target) && !getImage(ev.target) )
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

window.addEventListener('keydown', (e) => {
	if (
		e.keyCode !== 9 ||
		!document.getElementById('quickMenuIframe') 
	) return;
	
	e.preventDefault();
	
	// links and text boxes need to be blurred before focus can be applied to search bar (why?)
	e.target.blur();
	
	browser.runtime.sendMessage({action: "focusSearchBar"});
	
});

// // listen for quickMenuHotkey
// window.addEventListener('keydown', (e) => {
	// if (
		// !userOptions.quickMenuOnHotkey
		// || e.repeat
	// ) return;
	
	// for (let i=0;i<userOptions.quickMenuHotkey.length;i++) {
		// let key = userOptions.quickMenuHotkey[i];
		// if (key === 16 && !e.shiftKey) return;
		// if (key === 17 && !e.ctrlKey) return;
		// if (key === 18 && !e.altKey) return;
		// if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return;
	// }

	// e.preventDefault();
	// openQuickMenu(e);
	
// });

function getLink(el) {
	let a = el.closest('a');
	
	if ( !a ) return "";
		
	return userOptions.contextMenuSearchLinksAs === 'url' ? a.href : a.innerText;
}

function getImage(el) {
	
	if ( el.innerText ) return false;
	
	if ( el.tagName === 'IMG' ) return el.src;
	
	let style = window.getComputedStyle(el, false);
	return style.backgroundImage.slice(4, -1).replace(/"/g, "");
}

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
				makeQuickMenuContainer({'x': x,'y': y});
				
				quickMenuObject.lastOpeningMethod = message.openingMethod || null;
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
				
				let qm = document.getElementById('quickMenuIframe')
				
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
				
				let qmc = scaleAndPositionQuickMenu(message.size, message.resizeOnly || false);
				
				if (quickMenuObject.lastOpeningMethod && quickMenuObject.lastOpeningMethod === 'auto') {
					qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
					qmc.dataset.openingopacity = true;
				} else {
					qmc.style.opacity = 1;
				}
				
				/* edit widget start */
				// (() => {
					// let iframe = document.getElementById('quickMenuIframe');
					// let editWidget = document.getElementById('editWidget');
					
					// if ( !editWidget ) {

						// editWidget = document.createElement('img');
						// editWidget.id = 'editWidget';
						// editWidget.src = browser.runtime.getURL('icons/settings.png');

						// editWidget.addEventListener('click', (e) => {
							// quickMenuObject.locked = true;
							
							// let menu = document.createElement('div');

						// });
						
						// // remove when menu is closed
						// document.addEventListener('closequickmenu', () => {
							// editWidget.parentNode.removeChild(editWidget);
						// }, {once: true});

						// document.body.appendChild(editWidget);
					// }
					// // queue reposition for transitions
					// editWidget.addEventListener('transitionend', positionEditWidget, {once: true});
						
					// positionEditWidget();
					
					// function positionEditWidget() {
						// let iframeRect = iframe.getBoundingClientRect();
						// editWidget.style.left = parseInt(iframe.style.left) + iframeRect.width - 10 + "px";
						// editWidget.style.top = parseInt(iframe.style.top) - 10 + "px";
						// editWidget.style.transform = iframe.style.transform; 
					// }

				// })();
				
				
				/* edit widget end */
				
				/* dnd resize start */	
				
				_message = message;
				
				let iframe = document.getElementById('quickMenuIframe');
				let resizeWidget = document.getElementById('CS_resizeWidget');
				
				// overlay a div to capture mouse events over iframes
				let overDiv = document.createElement('div');
				overDiv.style = 'display:inline-block;position:absolute;left:0;top:0;width:100%;height:100%;z-index:2147483647;cursor:nwse-resize;';
				
				// build resize widget once per quick menu open
				if ( !resizeWidget ) {
					
					let startCoords, endCoords, endSize;
					
					resizeWidget = document.createElement('div');
					resizeWidget.id = 'CS_resizeWidget';
					
					document.addEventListener('closequickmenu', () => {
						resizeWidget.parentNode.removeChild(resizeWidget);
					}, {once: true});
					
					document.body.appendChild(resizeWidget);

					resizeWidget.innerHTML = '&#8690;';
					resizeWidget.addEventListener('mousedown', function elementResize(e) {
						
						let columns = userOptions.quickMenuUseOldStyle ? 1 : Math.min(_message.tileCount, userOptions.quickMenuColumns);
						let rows = Math.ceil(_message.tileCount / columns );
												
						let startSize = {columns: columns, rows: rows};

						document.body.appendChild(overDiv);

						iframe.style.transition = 'none';
						iframe.style.borderWidth = '2px';
						iframe.style.borderStyle = 'dashed';
						
						// lower the quick menu in case zIndex = MAX
						iframe.style.zIndex = window.getComputedStyle(iframe).zIndex - 1;

						// match grid to tile size after scaling
						let step = iframe.getBoundingClientRect().width / iframe.offsetWidth * message.tileSize.height;
						
						// initialize the coords with some offset for a deadzone
						startCoords = {x: e.clientX - 10, y: e.clientY - 10};

						document.addEventListener('mousemove', elementDrag);

						// track mod size to ignore repeat drag events
						let mostRecentModSize = {columns:0,rows:0};
						
						function elementDrag(_e) {
							endCoords = {x: _e.clientX, y: _e.clientY};

							let colsMod = Math.floor (( endCoords.x - startCoords.x ) / step);
							let rowsMod = Math.floor (( endCoords.y - startCoords.y ) / step);
							
							// size less than 1 do nothing
							if ( startSize.columns + colsMod <= 0 || startSize.rows + rowsMod <= 0 ) return;

							// ignore repeat drag events
							if ( mostRecentModSize.columns === colsMod && mostRecentModSize.rows === rowsMod )
								return;
							
							mostRecentModSize = {columns: colsMod, rows: rowsMod}

							// set prefs
							userOptions.quickMenuColumns = startSize.columns + colsMod;
							userOptions.quickMenuRows = startSize.rows + rowsMod;

							// rebuild menu with new dimensions
							iframe.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, makeQuickMenuOptions: {mode: "resize", resizeOnly: true} }, browser.runtime.getURL('/quickmenu.html'));

						}
						
						document.addEventListener('mouseup', (_e) => {
							
							_e.stopImmediatePropagation();

							// clear overlay
							overDiv.parentNode.removeChild(overDiv);
							
							// clear resize styling
							iframe.style.transition = null;
							iframe.style.borderWidth = null;
							iframe.style.borderStyle = null;
							iframe.style.zIndex = null;
							
							// rebuild the menu again to shrink empty rows
							iframe.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, makeQuickMenuOptions: {resizeOnly:true} }, browser.runtime.getURL('/quickmenu.html'));

							// save prefs
							browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
							document.removeEventListener('mousemove', elementDrag);
						}, {once: true});
						
					});
				}
				
				// queue reposition for transitions
				iframe.addEventListener('transitionend', positionResizeWidget, {once: true});
				
				positionResizeWidget();
				
				function positionResizeWidget() {
					let iframeRect = iframe.getBoundingClientRect();
					resizeWidget.style.left = iframeRect.right - 10 + "px";
					resizeWidget.style.top = iframeRect.bottom - 10 + "px";
					resizeWidget.style.transform = iframe.style.transform; 
				}

				/* dnd resize end */	
				
				break;

		}
	}
});
