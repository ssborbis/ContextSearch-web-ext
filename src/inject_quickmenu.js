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

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

function openQuickMenu(ev, searchTerms) {

	ev = ev || new Event('click');

	// keep open if locked
	if ( quickMenuObject.locked ) {
		browser.runtime.sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
		return;
	}
	
	if ( document.getElementById('CS_quickMenuIframe') ) closeQuickMenu();
		
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
		searchTerms: searchTerms || getSelectedText(ev.target).trim() || linkOrImage(ev.target, ev),
		quickMenuObject: quickMenuObject,
		openingMethod: ev.openingMethod || null
	});
}

function closeQuickMenu(eventType) {

	eventType = eventType || null;
		
	if (
		(eventType === 'wheel' || eventType === 'scroll' || eventType === 'mousewheel') && 
		(!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)
	) return false;
	
	if (
		eventType === 'click_window' && 
		quickMenuObject.locked
	) {
		return false;
	}
	
	var qmc = document.getElementById('CS_quickMenuIframe');
	if (qmc) {
		qmc.style.opacity=0;
		document.dispatchEvent(new CustomEvent('closequickmenu'));
		setTimeout(()=> {
			if (qmc && qmc.parentNode) qmc.parentNode.removeChild(qmc);
		},100);
	}
}

function getOffsets() {
	let xOffset=window.pageXOffset;
	let yOffset=window.pageYOffset;
	
	return {x: xOffset, y: yOffset};
}

function scaleAndPositionQuickMenu(size, resizeOnly) {
	let qmc = document.getElementById('CS_quickMenuIframe');
	if (!qmc) return;
	
	resizeOnly = resizeOnly || false;
	
	size = size || {
		width: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("width"), 
		height: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("height")
	};

	qmc.style.width = parseFloat(size.width) + "px";
	qmc.style.height = parseFloat(size.height) + "px";
	
	qmc.style.setProperty('--cs-scale', userOptions.quickMenuScale);

	if ( size.height / window.devicePixelRatio > window.innerHeight ) {
		qmc.style.transition = 'none';
		qmc.style.height = window.innerHeight * window.devicePixelRatio - ( window.innerHeight - document.documentElement.clientHeight ) + "px";
		qmc.style.transition = null;
		
		qmc.addEventListener('reposition',() => {
			runAtTransitionEnd( qmc, ["left", "top", "bottom", "right", "height", "width"], () => { 
				qmc.contentWindow.postMessage({action: "resizeMenu", options:{} }, browser.runtime.getURL('/quickmenu.html'));
			});			
		}, {once: true});
	} 
		
	if ( !userOptions.enableAnimations ) qmc.style.setProperty('--user-transition', 'none');
	
	runAtTransitionEnd( qmc, ["height", "width", "top", "left", "bottom", "right"], () => { 
		repositionOffscreenElement( qmc );
		qmc.dispatchEvent(new CustomEvent('reposition'));
	}, 50);
		
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

	return qmc;
}

// build the floating container for the quickmenu
function makeQuickMenuContainer(coords) {

	let qmc = document.getElementById('CS_quickMenuIframe');
		
	if (qmc) qmc.parentNode.removeChild(qmc);
	
	qmc = document.createElement('iframe');

	qmc.id = "CS_quickMenuIframe";

	qmc.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	qmc.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	qmc.style.opacity = 0;
	
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
	return ( element.type === 'text' || element.type === 'textarea' || element.isContentEditable );
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


function scrollEventListener(ev) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: ev.type});
	setTimeout(() => {
		window.scrollThrottler = false;
	},250);
}

window.addEventListener(window.hasOwnProperty('onmousewheel') ? 'mousewheel' : 'wheel', scrollEventListener);
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
		( getSelectedText(ev.target) === "" && !linkOrImage(ev.target, ev) ) ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs )
	) return false;
	
	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	// timer for mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		
		// prevent drag events when using search on mouseup
		window.addEventListener('dragstart', (e) => {
			e.preventDefault();
		}, {once: true});

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
				if ( !userOptions.quickMenuAllowContextMenu )
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
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		ev.which !== userOptions.quickMenuMouseButton
	) return false;
		
	clearTimeout(quickMenuObject.mouseDownTimer);
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

	if (Date.now() - quickMenuObject.lastSelectTime > ( userOptions.quickMenuAutoTimeout || Number.MAX_VALUE ) && !isTextBox(ev.target) ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	clearTimeout(quickMenuObject.mouseDownTimer);
	
	// // skip erroneous short selections
	let searchTerms = getSelectedText(ev.target);
	setTimeout( () => {
		if ( searchTerms === getSelectedText(ev.target) ) {
			 openQuickMenu(ev);
			 
			if ( userOptions.quickMenuCloseOnEdit && isTextBox(ev.target) ) {
				ev.target.addEventListener('input', (e) => {
					browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "input"});
				}, {once: true});
			}
		}
	}, 50);

});

function linkOrImage(el, e) {
	
	let link = getLink(el, e);
	let img = getImage(el, e);

	if ( img && userOptions.quickMenuOnImages ) return img;
	
	if ( link && userOptions.quickMenuOnLinks ) return link;
	
	return false;	
}

// Listen for quickMenuOnClick
document.addEventListener('mousedown', (ev) => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'click' ||
		ev.which !== userOptions.quickMenuMouseButton ||
		( getSelectedText(ev.target) === "" && !linkOrImage(ev.target, ev) ) ||
		( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs)
	) return false;

	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
	
	function preventContextMenuHandler(evv) {
		if ( !userOptions.quickMenuAllowContextMenu )
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
		( getSelectedText(ev.target) === "" && !linkOrImage(ev.target, ev) )
	) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	
	ev.stopPropagation();

	openQuickMenu(ev);
	
});

// listen for simple click
document.addEventListener('mousedown', (e) => {

	if ( 
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnSimpleClick.enabled ||
		userOptions.quickMenuOnSimpleClick.button !== e.which ||
		!e.altKey && userOptions.quickMenuOnSimpleClick.alt ||
		!e.ctrlKey && userOptions.quickMenuOnSimpleClick.ctrl ||
		!e.shiftKey && userOptions.quickMenuOnSimpleClick.shift ||
		getSelectedText(e.target)
	) return;

	let range, textNode, offset;

	if (document.caretPositionFromPoint) {
		range = document.caretPositionFromPoint(e.clientX, e.clientY);
		textNode = range.offsetNode;
		offset = range.offset;    
	} else if (document.caretRangeFromPoint) {
		range = document.caretRangeFromPoint(e.clientX, e.clientY);
		textNode = range.startContainer;
		offset = range.startOffset;
	}

	// Only split TEXT_NODEs
	if (textNode && textNode.nodeType == 3) {
		let word = getWord(textNode.textContent, offset);
		
		if ( !word ) return;
		
		e.preventDefault();
		
		if ( e.shiftKey ) document.addEventListener('selectstart', _e => _e.preventDefault(), {once: true});

		if ( e.which === 3 && !userOptions.quickMenuAllowContextMenu ) document.addEventListener('contextmenu', _e => _e.preventDefault(), {once: true});
		
		// prevent links
		document.addEventListener('click', _e => _e.preventDefault(), {once: true});

		document.addEventListener('mouseup', (_e) => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();
		
			// avoid close on document click with a short delay
			setTimeout(() => openQuickMenu(e, word), 50);
		}, {once: true});
	}
	
	function getWord(str, offset) {
		let _start = _end = offset;
		
		let tokens = '!"#$%&\\\'()\*+,-./:;<=>?@[]^_`{|}~ '.split("");

		do {
			_start--;
		} while ( _start > -1 && !tokens.includes(str.charAt(_start)) )

		do {
			_end++;
		} while ( _end < str.length && !tokens.includes(str.charAt(_end)) )

		return str.substring(_start+1, _end);
	}
});

function lockQuickMenu() {
	var qmc = document.getElementById('CS_quickMenuIframe');
				
	if ( quickMenuObject.locked ) return;
		
	if ( !qmc.resizeWidget ) {
		document.addEventListener('quickMenuComplete', lock);
		return;
	}
	
	lock();
		
	function lock() {
		
		qmc.style.left = parseFloat(qmc.style.left) - getOffsets().x + "px";
		qmc.style.top = parseFloat(qmc.style.top) - getOffsets().y + "px";
		qmc.style.position='fixed';
		quickMenuObject.locked = true;
		
		if ( qmc.resizeWidget ) qmc.resizeWidget.style.position = 'fixed';
		
		qmc.contentWindow.postMessage({action: "showMenuBar" }, browser.runtime.getURL('/quickmenu.html'));

		makeDockable(qmc, {
			windowType: "undocked",
			dockedPosition: "left",
			handleElement: qmc,
			lastOffsets: window.quickMenuLastOffsets || {
				top: (parseFloat(qmc.style.top) + getOffsets().y) * window.devicePixelRatio, 
				left: (parseFloat(qmc.style.left) + getOffsets().x) * window.devicePixelRatio, 
				right: (parseFloat(qmc.style.left) + getOffsets().x + qmc.getBoundingClientRect().width) * window.devicePixelRatio, 
				bottom: (parseFloat(qmc.style.top) + getOffsets().y + qmc.getBoundingClientRect().height) * window.devicePixelRatio
			},
			onUndock: (o) => {
				qmc.docking.translatePosition('top', 'left');
				qmc.style.transformOrigin = null;
				qmc.getBoundingClientRect();
				if ( qmc.resizeWidget ) qmc.resizeWidget.setPosition();
				
				// store last qm position
				window.quickMenuLastOffsets = o.lastOffsets;
			},
			onDock: (o) => {}
		});
		
		qmc.docking.init();

		setTimeout(() => { repositionOffscreenElement( qmc ); }, 500);
	}
}

function unlockQuickMenu() {
	var qmc = document.getElementById('CS_quickMenuIframe');
				
	if ( !qmc ) return;
	
	qmc.style.left = parseFloat(qmc.style.left) + getOffsets().x + "px";
	qmc.style.top = parseFloat(qmc.style.top) + getOffsets().y + "px";
	qmc.style.position = null;
	quickMenuObject.locked = false;
	
	qmc.contentWindow.postMessage({action: "hideMenuBar" }, browser.runtime.getURL('/quickmenu.html'));
	
	qmc.resizeWidget.style.position = null;
	qmc.resizeWidget.setPosition();
	qmc.docking = null;
	
	// clear qm position
	delete window.quickMenuLastOffsets;
}

// unlock if quickmenu is closed
document.addEventListener('closequickmenu', () => {
	quickMenuObject.locked = false;
	delete window.quickMenuLastOffsets;
});

// close quickmenu when clicking anywhere on page
document.addEventListener("click", (ev) => {

	if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return false;
	
	if ( userOptions.quickMenuAllowContextMenu && ev.which !== 1 ) return;

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
		!document.getElementById('CS_quickMenuIframe') 
	) return;
	
	e.preventDefault();
	
	// links and text boxes need to be blurred before focus can be applied to search bar (why?)
	e.target.blur();
	
	browser.runtime.sendMessage({action: "focusSearchBar"});
	
});

document.addEventListener('zoom', (e) => {
	if ( document.getElementById('CS_quickMenuIframe') ) scaleAndPositionQuickMenu(null, true);
});

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
				if (quickMenuObject.locked || document.title === "QuickMenu" || document.getElementById('CS_quickMenuIframe')) {
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
				if (quickMenuObject.disabled) userOptions.quickMenu = false;
				
				break;
				
			case "lockQuickMenu":				
				lockQuickMenu();
				break;
				
			case "unlockQuickMenu":
				unlockQuickMenu();
				break;			
				
			case "quickMenuIframeLoaded":

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});

				var qmc = scaleAndPositionQuickMenu(message.size, message.resizeOnly || false);
				
				// if (quickMenuObject.lastOpeningMethod && quickMenuObject.lastOpeningMethod === 'auto') {
					qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
				// } else {
					// qmc.style.opacity = 1;
				// }

				_message = message;
				
				let columns = userOptions.quickMenuUseOldStyle ? 1 : Math.min(message.tileCount, userOptions.quickMenuColumns);

				let resizeWidget = addResizeWidget(qmc, {
					tileSize: message.tileSize,
					columns: columns,
					rows: Math.ceil(message.tileCount / columns ),
					onDrag: (o) => {

						// set prefs
						userOptions.quickMenuColumns = o.columns;
						userOptions.quickMenuRows = o.rows;

						// rebuild menu with new dimensions
						qmc.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, makeQuickMenuOptions: {mode: "resize", resizeOnly: true} }, browser.runtime.getURL('/quickmenu.html'));
					},
					onDrop: (o) => {
						// rebuild the menu again to shrink empty rows
						qmc.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, makeQuickMenuOptions: {resizeOnly:true} }, browser.runtime.getURL('/quickmenu.html'));

						// save prefs
						browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
					}
				});

				qmc.style.opacity = null;

				document.addEventListener('closequickmenu', () => {
					if ( resizeWidget ) 
						resizeWidget.parentNode.removeChild(resizeWidget);
				}, {once: true});
				
				if ( !message.resizeOnly )
					browser.runtime.sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
				
				break;

		}
	}
});

window.addEventListener('message', (e) => {
	switch ( e.data.action ) {
		case "quickMenuResize":
			scaleAndPositionQuickMenu(e.data.size, true);
			break;
	}
});


// docking event listeners for iframe
window.addEventListener('message', (e) => {

	if ( e.data.target !== "quickMenu" ) return;
	
	let iframe = document.getElementById('CS_quickMenuIframe');
	
	let x = e.data.e.clientX / window.devicePixelRatio;
	let y = e.data.e.clientY / window.devicePixelRatio;

	switch ( e.data.action ) {
		case "handle_dragstart":
			iframe.docking.moveStart({clientX:x, clientY:y});
			break;
		
		case "handle_dragend":
			iframe.docking.moveEnd({clientX:x, clientY:y});
			break;
		
		case "handle_dragmove":
			iframe.docking.moveListener({clientX:x, clientY:y});
			break;
			
		case "handle_dock":
			iframe.docking.toggleDock();
			break;
	}
});
