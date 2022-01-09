// unique object to reference globally
var quickMenuObject = { 
	keyDownTimer: 0,
	mouseDownTimer: null,
	mouseCoords: {x:0, y:0},
	screenCoords: {x:0, y:0},
	mouseCoordsInit: {x:0, y:0},
	mouseLastClickTime: 0,
	lastSelectTime: 0,
	locked: false,
	searchTerms: "",
	disabled: false,
	mouseDownTargetIsTextBox: false,
	mouseLastContextMenuTime:0,
	contexts: []
};

var screenCoords = {x:0, y:0};

var getQM = () => document.getElementById('CS_quickMenuIframe');

function deselectAllText(e) {
	window.getSelection().removeAllRanges();

	[document.activeElement, window.lastActiveElement].forEach( el => {
		if ( el && el.selectionStart )
			el.setSelectionRange(0,0);
	});
}

function openQuickMenu(e, searchTerms) {

	e = e || new Event('click');

	// if ( getQM() ) closeQuickMenu();

	window.lastActiveElement = document.activeElement;
		
	// links need to be blurred before focus can be applied to search bar (why?)
	if ( userOptions.quickMenuSearchBarFocus /* && ev.target.nodeName === 'A' */) {
		
		// restore selection to text boxes
		if (e.target && e.target.selectionStart)  // is a text box
			document.addEventListener('closequickmenu', e => e.target.focus(), {once: true});
		
		// don't blur on drag
		if ( e.target && !e.dataTransfer )
			e.target.blur();
	}

	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: quickMenuObject.screenCoords,
		mouseCoords: quickMenuObject.mouseCoords,
		searchTerms: searchTerms || getSelectedText(e.target).trim() || linkOrImage(e.target, e),
		quickMenuObject: quickMenuObject,
		openingMethod: e.openingMethod || e.type || null,
		contexts: getContexts(e.target)
	});
}

var getUnderDiv = () => document.getElementById('CS_underDiv');

function addUnderDiv() {
	if ( !userOptions.quickMenuPreventPageClicks ) return;
	
	let ud = getUnderDiv() || document.createElement('div');
	ud.id = 'CS_underDiv';
	document.body.appendChild(ud);
}

function removeUnderDiv() {
	
	if ( getUnderDiv() ) getUnderDiv().parentNode.removeChild(getUnderDiv() );
}

function closeQuickMenu(eventType) {

	eventType = eventType || null;
		
	if (
		(eventType === 'wheel' || eventType === 'scroll' || eventType === 'mousewheel') && 
		(!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)
	) return false;
	
	if (
		(eventType === 'click_window' || eventType === 'click_quickmenutile' ) && 
		quickMenuObject.locked
	) return false;
	
	var qmc = getQM();

	if (qmc) {
		qmc.style.opacity = 0;
		document.dispatchEvent(new CustomEvent('closequickmenu'));
		
		setTimeout(() => {
			if (qmc && qmc.parentNode) qmc.parentNode.removeChild(qmc);
		}, 100);
	}
	
	removeUnderDiv();
	
	if ( ( userOptions.quickMenuDeselectTextOnSearch ) && eventType === 'click_quickmenutile' ) {
		browser.runtime.sendMessage({action: "deselectAllText"});

		console.log('text should deselect');
	}
}

function getOffsets() {
	let xOffset=window.pageXOffset;
	let yOffset=window.pageYOffset;
	
	return {x: xOffset, y: yOffset};
}

// build the floating container for the quickmenu
function makeQuickMenuContainer(coords) {

	let qmc = getQM();

	if (qmc) qmc.parentNode.removeChild(qmc);
	
	qmc = document.createElement('iframe');

	qmc.id = "CS_quickMenuIframe";
	
	qmc.style.opacity = 0;
	qmc.style.width = 0;
	qmc.style.height = 0;

	qmc.allowTransparency = true;
	
	qmc.openingCoords = coords;

	document.body.appendChild(qmc);

	qmc.src = browser.runtime.getURL('quickmenu.html');

	// Check if quickmenu fails to display
	setTimeout(() => {
		if (!qmc || qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("display") === 'none') {
			console.error('iframe quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'});
			removeUnderDiv();
		}
	}, 1000);

	addUnderDiv();
}

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', e => {

	if (
		e.key !== "Escape" ||
		e.repeat ||
		!userOptions.quickMenu		
	) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});	
});

function scrollEventListener(e) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: e.type});
	setTimeout(() => window.scrollThrottler = false, 250);
}

window.addEventListener(window.hasOwnProperty('onmousewheel') ? 'mousewheel' : 'wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

// Listen for quickMenuKey
document.addEventListener('keydown', e => {
	
	if (
		e.which !== userOptions.quickMenuKey ||
		e.repeat ||
		!userOptions.quickMenuOnKey ||
		!userOptions.quickMenu ||
		getSelectedText(e.target) === "" ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs)
	) return false;

	quickMenuObject.keyDownTimer = Date.now();	
});

// Listen for quickMenuKey
document.addEventListener('keyup', e => {
	
	if (
		e.which !== userOptions.quickMenuKey ||
		e.repeat ||
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnKey
	) return false;

	if ( e.ctrlKey || e.shiftKey || e.altKey || e.metaKey ) return false;

	if (Date.now() - quickMenuObject.keyDownTimer < 250)
		openQuickMenu(e);
	
	quickMenuObject.keyDownTimer = 0;	
});

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mousedown', e => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		e.which !== userOptions.quickMenuMouseButton ||
		!hasSearchTerms(e) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs ) ||
		!e.isTrusted
	) return false;

	if ( e.which === 3 && userOptions.rightClickMenuOnMouseDownFix ) {
		if ( Date.now() - quickMenuObject.mouseLastContextMenuTime > 500 ) {
			document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});
		} else {
			document.addEventListener('contextmenu', _e => {
				clearTimeout(quickMenuObject.mouseDownTimer);
				quickMenuObject.mouseDownTimer = null;
			}, {once: true});	
		}

		quickMenuObject.mouseLastContextMenuTime = Date.now();
	}

	let coords = Object.assign({}, screenCoords);
		
	// timer for mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {	

		// prevent drag events when using search on mouseup
		function preventDrag(_e) { _e.preventDefault() }
		window.addEventListener('dragstart', preventDrag, {once: true});

		if (Math.abs(screenCoords.x - coords.x) > userOptions.quickMenuCancelDeadzone || Math.abs(screenCoords.y - coords.y) > userOptions.quickMenuCancelDeadzone ) return false;

		// prevent losing text selection
		document.addEventListener('mouseup', _e => {
			if (_e.which !== e.which) return;
			_e.preventDefault();
			quickMenuObject.mouseLastClickTime = Date.now();
			clearTimeout(quickMenuObject.mouseDownTimer);
			quickMenuObject.mouseDownTimer = null;

		}, {once: true});
		
		if (e.which === 1) {
			// Disable click to prevent links from opening
			e.target.addEventListener('click', _e => {
				if (_e.which !== 1) return;
				_e.preventDefault();
			}, {once: true});
			
		} else if (e.which === 2) {
			// Disable click to prevent links from opening
			e.target.addEventListener('mousedown', _e => {
				if (_e.which !== 2) return;
				_e.preventDefault();
			}, {once: true});
			
		} else if (e.which === 3) {
			// Disable the default context menu once
			document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});

			// remove the listener after mouseup
			document.addEventListener('mouseup', () => {
				setTimeout(() => document.removeEventListener('contextmenu', preventContextMenuHandler), 50);
			}, {once: true});
		}

		quickMenuObject.mouseLastClickTime = Date.now();

		openQuickMenu(e);

		// remove listener to prevent next drag event not working
		window.removeEventListener('dragstart', preventDrag);

		clearTimeout(quickMenuObject.mouseDownTimer);
		quickMenuObject.mouseDownTimer = null;
		
	}, userOptions.quickMenuHoldTimeout);

}, {capture: true});

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', e => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		e.which !== userOptions.quickMenuMouseButton
	) return false;
		
	clearTimeout(quickMenuObject.mouseDownTimer);
	quickMenuObject.mouseDownTimer = null;
}, {capture: true});

// Listen for quickMenuAuto 
document.addEventListener('mousedown', e => {
	
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		e.which !== 1 ||
		e.target.id === 'quickMenuElement' ||
		e.target.parentNode.id === 'quickMenuElement'
	) return false;
	
	quickMenuObject.mouseDownTargetIsTextBox = isTextBox(e.target);
}, {capture: true});

document.addEventListener('mouseup', e => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		e.which !== 1 ||
		e.target.id === 'quickMenuElement' ||
		e.target.parentNode.id === 'quickMenuElement' ||
		getSelectedText(e.target).trim() === "" ||
		( userOptions.quickMenuAutoMaxChars && getSelectedText(e.target).length > userOptions.quickMenuAutoMaxChars ) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs ) ||
		( quickMenuObject.mouseDownTargetIsTextBox && !userOptions.quickMenuAutoOnInputs )
		
	) return false;

	// check for modifier keys
	if ( 
		e.shiftKey !== userOptions.quickMenuAutoShift ||
		e.altKey !== userOptions.quickMenuAutoAlt ||
		e.ctrlKey !== userOptions.quickMenuAutoCtrl
	) return false;

	e.openingMethod = "auto";

	if ( Date.now() - quickMenuObject.lastSelectTime > ( userOptions.quickMenuAutoTimeout || Number.MAX_VALUE ) && !isTextBox(ev.target) ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	clearTimeout(quickMenuObject.mouseDownTimer);
	quickMenuObject.mouseDownTimer = null;

	// // skip erroneous short selections
	let searchTerms = getSelectedText(e.target);
	setTimeout(() => {

		if ( searchTerms === getSelectedText(e.target) ) {
			 openQuickMenu(e);
			 
			if ( userOptions.quickMenuCloseOnEdit && isTextBox(e.target) ) {
				e.target.addEventListener('input', e => browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "input"}), {once: true});
			}
		}
	}, 50);
}, {capture: true});

function preventContextMenuHandler(e) {
	if ( !userOptions.quickMenuAllowContextMenuNew ) {
		e.preventDefault();
	}
}

function removePreventContextMenuHandler(e) {
	document.removeEventListener('contextmenu', preventContextMenuHandler);
}

function hasSearchTerms(e) {
	return getSelectedText(e.target) || linkOrImage(e.target, e);
}

// Listen for quickMenuOnClick
document.addEventListener('mousedown', e => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'click' ||
		e.which !== userOptions.quickMenuMouseButton ||
		!hasSearchTerms(e) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs)
	) return false;
	
	// middle-click often used to open links and requires some caveots
	if ( e.which === 2 && !getSelectedText(e.target) ) return false;
	if ( e.which === 2 ) e.preventDefault();

	// context menu on mousedown fixes
	if ( e.which === 3 && userOptions.rightClickMenuOnMouseDownFix ) {

		if ( Date.now() - quickMenuObject.mouseLastContextMenuTime < 500 ) {
			closeQuickMenu();
			removePreventContextMenuHandler('quickMenuOnClick mousedown');
			return;
		}
	}

	if ( e.which === 3 ) {
		quickMenuObject.mouseLastContextMenuTime = Date.now();
		document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});
	}
	
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		removePreventContextMenuHandler('quickMenuOnClick mousedown 2');
		clearTimeout(quickMenuObject.mouseDownTimer);
		quickMenuObject.mouseDownTimer = null;
	}, userOptions.quickMenuHoldTimeout);
}, {capture: true});
		
// Listen for quickMenuOnClick	
document.addEventListener('mouseup', e => {	

	if (
		!userOptions.quickMenu || 
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'click' ||
		e.which !== userOptions.quickMenuMouseButton ||
		!quickMenuObject.mouseDownTimer ||
		!hasSearchTerms(e)
	) return false;

	quickMenuObject.mouseLastClickTime = Date.now();
	
	e.stopPropagation();
	if ( e.which === 2 ) e.preventDefault();

	openQuickMenu(e);	
}, {capture: true});

// listen for simple click
document.addEventListener('mousedown', e => {

	if ( 
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnSimpleClick.enabled ||
		userOptions.quickMenuOnSimpleClick.button !== e.which ||
		!e.altKey && userOptions.quickMenuOnSimpleClick.alt ||
		!e.ctrlKey && userOptions.quickMenuOnSimpleClick.ctrl ||
		!e.shiftKey && userOptions.quickMenuOnSimpleClick.shift ||
		getSelectedText(e.target)
	) return;

	let range, textNode, offset, word;

	if (document.caretPositionFromPoint) {
		range = document.caretPositionFromPoint(e.clientX, e.clientY);
		textNode = range.offsetNode;
		offset = range.offset;    
	} else if (document.caretRangeFromPoint) {
		range = document.caretRangeFromPoint(e.clientX, e.clientY);
		textNode = range.startContainer;
		offset = range.startOffset;
	}

	if (textNode && textNode.nodeType == 3)
		word = getWord(textNode.textContent, offset);

	if ( userOptions.quickMenuOnSimpleClick.useInnerText && !word ) {
		
		let rect = e.target.getBoundingClientRect();

		let flash = document.createElement('div');
		flash.className = 'CS_highlightTextBlock';
		flash.style = `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;`
		document.body.appendChild(flash);
		setTimeout(() => flash.parentNode.removeChild(flash), 250);

		document.addEventListener('mouseup', _e => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();
		
			// avoid close on document click with a short delay
			setTimeout(() => openQuickMenu(e, e.target.innerText), 50);
		}, {once: true});

		if ( e.which === 3 && !userOptions.quickMenuAllowContextMenuNew ) document.addEventListener('contextmenu', _e => _e.preventDefault(), {once: true});
		return;
	}

	// Only split TEXT_NODEs
	if ( word ) {		
		e.preventDefault();

		// back foward buttons
		if ( [3,4].includes(e.button) )
			e.stopPropagation();
		
		if ( e.shiftKey ) document.addEventListener('selectstart', _e => _e.preventDefault(), {once: true});

		if ( e.which === 3 && !userOptions.quickMenuAllowContextMenuNew ) document.addEventListener('contextmenu', _e => _e.preventDefault(), {once: true});
		
		// prevent links
		document.addEventListener('click', _e => _e.preventDefault(), {once: true});

		document.addEventListener('mouseup', _e => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();
		
			// avoid close on document click with a short delay
			setTimeout(() => openQuickMenu(e, word), 50);
		}, {once: true});
	}
	
	function getWord(str, offset) {

		if ( offset === str.length ) return null;
		let _start = _end = offset;
		
		let tokens = '!"#$%&\\\'()\*+,-./:;<=>?@[]^_`{|}~ «»""“”‘’'.split("");

		do {
			_start--;
		} while ( _start > -1 && !tokens.includes(str.charAt(_start)) )

		do {
			_end++;
		} while ( _end < str.length && !tokens.includes(str.charAt(_end)) )

		return str.substring(_start+1, _end);
	}
}, {capture: true});

document.addEventListener('dragstart', e => {
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnDrag
	) return;

	// check for modifier keys
	if ( 
		e.shiftKey !== userOptions.quickMenuDragShift ||
		e.altKey !== userOptions.quickMenuDragAlt ||
		e.ctrlKey !== userOptions.quickMenuDragCtrl
	) return false;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e);

	if ( !searchTerms ) return;

	document.addEventListener('keydown', e => {
		if ( e.key === "Escape" && getQM())
			closeQuickMenu();
	}, {once: true});

	openQuickMenu(e);

}, {capture: true});

function lockQuickMenu() {
	var qmc = getQM();
	
	if ( !qmc ) return;
	
	lock();
		
	function lock() {
		qmc.contentWindow.postMessage({action: "lock" }, browser.runtime.getURL('/quickmenu.html'));
		quickMenuObject.locked = true;
		
		removeUnderDiv();
	}
}

function unlockQuickMenu() {
	var qmc = getQM();

	if ( !qmc ) return;

	quickMenuObject.locked = false;

	qmc.contentWindow.postMessage({action: "unlock" }, browser.runtime.getURL('/quickmenu.html'));
	
	// clear qm position
	delete window.quickMenuLastOffsets;
	
	addUnderDiv();
}

// unlock if quickmenu is closed
document.addEventListener('closequickmenu', () => {
		
	if ( !userOptions.quickMenuTools.find( tool => tool.name === "lock" && tool.persist ) )
		quickMenuObject.locked = false;
}, {capture: true});

// close quickmenu when clicking anywhere on page
document.addEventListener("click", e => {

	if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return false;
	
	if ( userOptions.quickMenuAllowContextMenuNew && e.which !== 1 ) return;
	
	// prevent links from opening
	if ( getQM() && !quickMenuObject.locked)
		e.preventDefault();

	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_window"});
}, {capture: true});

// track mouse position
document.addEventListener("mousemove", e => {
	quickMenuObject.mouseCoords = {x: e.clientX, y: e.clientY};
	quickMenuObject.screenCoords = {x: e.screenX, y: e.screenY};

	screenCoords = {x: e.screenX, y: e.screenY};
}, {capture: true});

// prevent quickmenu during drag events
document.addEventListener("drag", e => {
	clearTimeout(quickMenuObject.mouseDownTimer);
	quickMenuObject.mouseDownTimer = null;
}, {capture: true});

window.addEventListener('keydown', e => {
	if (
		e.key !== "Tab" ||
		!getQM() 
	) return;

	if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey ) return;
	
	e.preventDefault();
	
	// links and text boxes need to be blurred before focus can be applied to search bar (why?)
	e.target.blur();
	
	browser.runtime.sendMessage({action: "focusSearchBar"});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			
			case "closeQuickMenuRequest":

				if ( window.lastActiveElement) {
					window.lastActiveElement.focus();
					delete window.lastActiveElement;
				}
				
				if ( !getQM() ) break;
				closeQuickMenu(message.eventType || null);

				break;
				
			case "openQuickMenu":

				// opened by shortcut
				if ( !message.screenCoords) message.screenCoords = quickMenuObject.screenCoords;

				let x = (message.screenCoords.x - (quickMenuObject.screenCoords.x - quickMenuObject.mouseCoords.x * window.devicePixelRatio)) / window.devicePixelRatio;				
				let y = (message.screenCoords.y - (quickMenuObject.screenCoords.y - quickMenuObject.mouseCoords.y * window.devicePixelRatio)) / window.devicePixelRatio;

				quickMenuObject.searchTerms = message.searchTerms;
				quickMenuObject.lastOpeningMethod = message.openingMethod || null;
				quickMenuObject.contexts = message.contexts;

				// keep old menu if locked
				if ( quickMenuObject.locked && getQM() ) {
					quickMenuObject.searchTerms = message.searchTerms;
					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					}).then(() => {
						browser.runtime.sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
					});
					break;
				}

				// if ( true && getQM() ) {
				// 	let qmc = getQM();

				// 	qmc.style.display = null;

				// 	let rect = qmc.getBoundingClientRect();
				// 	qmc.style.opacity = 1;


				// 	let coords = getQuickMenuOpeningPosition({
				// 		width: rect.width,
				// 		height: rect.height,
				// 		x: quickMenuObject.mouseCoords.x,
				// 		y: quickMenuObject.mouseCoords.y
				// 	})

				// 	qmc.openingCoords = quickMenuObject.mouseCoords;

				// 	qmc.style.left = coords.x + "px";
				// 	qmc.style.top = coords.y + "px";

				// 	browser.runtime.sendMessage({action: "quickMenuIframeLoaded", size: {width:rect.width, height:rect.height}});

				// 	break;
				// }

				makeQuickMenuContainer({'x': x,'y': y});
				
				break;
			
			case "updateSearchTerms":

				// only update if quickmenu is opened and locked
				// if (quickMenuObject.locked || getQM()) {
				// 	quickMenuObject.searchTerms = message.searchTerms;

				// 	// send event to OpenAsLink tile to enable/disable
				// 	document.dispatchEvent(new CustomEvent('updatesearchterms'));

				// 	browser.runtime.sendMessage({
				// 		action: "updateQuickMenuObject", 
				// 		quickMenuObject: quickMenuObject
				// 	});
				// } 
				break;
			
			case "updateQuickMenuObject":

				quickMenuObject = { 
					keyDownTimer: quickMenuObject.keyDownTimer,
					mouseDownTimer: quickMenuObject.mouseDownTimer,
					mouseCoords: quickMenuObject.mouseCoords,
					screenCoords: quickMenuObject.screenCoords,
					mouseCoordsInit: message.quickMenuObject.mouseCoordsInit,
					mouseLastClickTime: Math.max(message.quickMenuObject.mouseLastClickTime, quickMenuObject.mouseLastClickTime),
					lastSelectTime: Math.max(message.quickMenuObject.lastSelectTime, quickMenuObject.lastSelectTime),
					locked: message.quickMenuObject.locked,
					searchTerms: message.quickMenuObject.searchTerms,
					disabled: message.quickMenuObject.disabled,
					mouseDownTargetIsTextBox: message.quickMenuObject.mouseDownTargetIsTextBox,
					mouseLastContextMenuTime:Math.max(message.quickMenuObject.mouseLastContextMenuTime, quickMenuObject.mouseLastContextMenuTime),
				};

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
				
				var qmc = getQM();
				
				qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
				qmc.style.setProperty('--cs-scale', userOptions.quickMenuScale);
				if ( !userOptions.enableAnimations ) qmc.style.setProperty('--user-transition', 'none');

				let initialOffsets = getQuickMenuOpeningPosition({
					width: message.size.width,
					height: message.size.height,
					x: qmc.openingCoords.x,
					y: qmc.openingCoords.y
				});

				makeDockable(qmc, {
					windowType: "undocked",
					dockedPosition: "left",
					handleElement:null,
					lastOffsets: window.quickMenuLastOffsets || {
						left: Math.floor(initialOffsets.x * window.devicePixelRatio),
						right: Number.MAX_SAFE_INTEGER,
						top: Math.floor(initialOffsets.y * window.devicePixelRatio),
						bottom: Number.MAX_SAFE_INTEGER 
					},
					onUndock: o => {
						if ( qmc.resizeWidget ) qmc.resizeWidget.setPosition();
						
						qmc.contentWindow.postMessage({action: "resizeMenu", options: {move: true, maxHeight: getMaxIframeHeight()}}, browser.runtime.getURL('/quickmenu.html'));
						
						window.quickMenuLastOffsets = o.lastOffsets;
						
						if ( !quickMenuObject.locked ) delete window.quickMenuLastOffsets;
						else lockQuickMenu();

					},
					onDock: o => {
						lockQuickMenu();
					},
					onMoveStart: o => {}
				});
				
				qmc.docking.init();

				setTimeout(() => { 
					repositionOffscreenElement( qmc, {left:0, right:0, top:0, bottom:0} );
				}, 250);

				_message = message;

				qmc.getBoundingClientRect();
				qmc.style.opacity = null;
				
				if ( !message.resizeOnly )
					browser.runtime.sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
				
				qmc.columns = _message.columns;
				qmc.tileCount = _message.tileCount;
				qmc.tileSize = _message.tileSize;

				if ( quickMenuObject.lastOpeningMethod === 'dragstart' ) {
					let ds = new DragShake();
					ds.onshake = () => closeQuickMenu();
					ds.start();
					document.addEventListener('closequickmenu', e => ds.stop(), {once: true});

					if ( window.chrome ) {
						let od;
						document.addEventListener('closequickmenu', e => {
							if (od) od.parentNode.removeChild(od);
						}, {once: true});
						
						runAtTransitionEnd(qmc, ["height", "width", "opacity"], () => {
							od = dragOverIframeDiv(qmc);
						}, 75);
					}
				}

				// capture next selection to prevent some elements clearing the searchTerms
				document.addEventListener('selectionchange', e => {
					e.stopPropagation();
					e.preventDefault();
				}, {once: true, capture: true});

				setTimeout(() => {
					if ( userOptions.quickMenuSearchBarFocus )
						browser.runtime.sendMessage({action: "focusSearchBar"});
				}, 50);

				break;

			case "editQuickMenu":

				function removeOverDiv() {
					let overDiv = document.querySelector(".CS_overDiv.editQuickMenu");
					if (overDiv) overDiv.parentNode.removeChild(overDiv);
				}

				var qmc = getQM();

				if (qmc.resizeWidget) {
					removeResizeWidget();
					removeOverDiv();
					break;
				}

				let overDiv = document.createElement('div');
				overDiv.className = "CS_overDiv editQuickMenu";
				document.body.appendChild(overDiv);

				document.addEventListener('closequickmenu', removeOverDiv, {once: true});
				installResizeWidget();

				break;

		}
	}
});

function installResizeWidget() {

	let iframe = getQM();
	let columns = iframe.columns;
	let tileCount = iframe.tileCount;

	let tileSize = iframe.tileSize;
	let originalRect;

	let resizeWidget = addResizeWidget(iframe, {
		tileSize: tileSize,
		columns: columns,
		rows: Math.ceil(tileCount / columns ),
		onDragStart: o => {
			iframe.docking.translatePosition('top', 'left');
			originalRect = iframe.getBoundingClientRect();
		},
		onDrag: o => {

			resizeWidget.style.visibility = 'hidden';

			iframe.style.width = (originalRect.width + o.xOffset) * window.devicePixelRatio / userOptions.quickMenuScale + "px";
			iframe.style.height = (originalRect.height + o.yOffset) * window.devicePixelRatio / userOptions.quickMenuScale + "px";

			if ( o.columns == userOptions.quickMenuColumns && o.rows == userOptions.quickMenuRows ) {
				return;
			}

			// set prefs
			if ( resizeWidget.options.allowHorizontal ) userOptions.quickMenuColumns = o.columns;
			if ( resizeWidget.options.allowVertical ) {
				
				// check for singleColumn
				if ( resizeWidget.options.allowHorizontal )
					userOptions.quickMenuRows = o.rows;
				else
					userOptions.quickMenuRowsSingleColumn = o.rows;
			}

			// // rebuild menu with new dimensions
			iframe.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, columns:o.columns, rows:o.rows, rect: iframe.getBoundingClientRect(), devicePixelRatio: window.devicePixelRatio}, browser.runtime.getURL('/quickmenu.html'));
		},
		onDrop: o => {

			resizeWidget.style.visibility = null;
			
			// resize changes the offsets
			iframe.docking.options.lastOffsets = iframe.docking.getOffsets();

			// resize the menu again to shrink empty rows					
			iframe.contentWindow.postMessage({action: "resizeMenu", options: {maxHeight: getMaxIframeHeight(), rebuildTools: true}}, browser.runtime.getURL('/quickmenu.html'));
			
			// reset the fixed quadrant
			runAtTransitionEnd(iframe, ["height", "width"], () => {
				iframe.style.transition = 'none';
				let position = iframe.docking.getPositions(iframe.docking.options.lastOffsets);
				iframe.docking.translatePosition(position.v, position.h);
				iframe.style.transition = null;
			});
				
			// save prefs
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
		}
	});

//	resizeWidget.style.opacity = 1;
	iframe.classList.add('CS_resizing');
	resizeWidget.classList.add("editQuickMenu");
	
	// hide the widget until the menu is done transitioning
	resizeWidget.style.visibility = 'visible';
	resizeWidget.style.zIndex = -1;
	setTimeout(() => {
		resizeWidget.style.visibility = null;
		resizeWidget.style.zIndex = null;
	}, 500);

	iframe.resizeWidget = resizeWidget;
	
	// qmc.classList.add("webkitBorderRadiusFix"); // prevented drop shadow
	document.addEventListener('closequickmenu', removeResizeWidget, {once: true});
}

function removeResizeWidget() {

	var qmc = getQM();

	if (qmc.resizeWidget) {
		qmc.resizeWidget.parentNode.removeChild(qmc.resizeWidget);
		qmc.classList.remove('CS_resizing');
		delete qmc.resizeWidget;
	}
}

function getMaxIframeHeight() {
	return (window.innerHeight - getScrollBarHeight()) * window.devicePixelRatio / userOptions.quickMenuScale - window.devicePixelRatio;
}

function quickMenuResize(e) {

	let iframe = getQM();
	if ( !iframe ) return;

	if ( iframe.resizeWidget && e.data.tileSize) {
		iframe.resizeWidget.options.tileSize = e.data.tileSize
		iframe.resizeWidget.options.rows = e.data.rows;
		iframe.resizeWidget.options.columns = e.data.columns;
		iframe.resizeWidget.options.allowHorizontal = !e.data.singleColumn;
	}

	if ( e.data.size.height) {

		if ( e.data.size.height <= getMaxIframeHeight() )
			iframe.style.height = e.data.size.height + "px"; 
		else {
			console.warn('height exceeds window - bad resizeMenu');
			iframe.style.height = getMaxIframeHeight() + "px";
		}
	}

	if ( e.data.size.width ) 					
		iframe.style.width = e.data.size.width + "px";

	runAtTransitionEnd(iframe, ["width", "height"], () => {
		
		iframe.contentWindow.postMessage({action: "resizeDone"}, browser.runtime.getURL('/quickmenu.html'));

		if ( iframe.docking.options.windowType === 'undocked' )
			repositionOffscreenElement(iframe);
		
		if ( iframe.docking.options.windowType === 'docked' )
			iframe.docking.offset();
		
		if ( iframe.resizeWidget )
			iframe.resizeWidget.setPosition();
	
	}, 100); // shorter interval caused menu to remain offscreen
}

window.addEventListener('message', e => {

	switch ( e.data.action ) {
		case "quickMenuResize":

			let url = new URL(browser.runtime.getURL(''));

			if ( e.origin !== url.origin ) return;
			
			if ( !e.data.size ) return;

			quickMenuResize(e);
			break;
	}
});

function getQuickMenuOpeningPosition(o) {

	let leftOffset = topOffset = 0;

	for (let position of userOptions.quickMenuPosition.split(" ")) {
		switch (position) {
			case "left":
				leftOffset = - o.width * userOptions.quickMenuScale / window.devicePixelRatio;
				break;
			case "right":
				break;
			case "center":
				leftOffset = - o.width / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio;
				break;
			case "top":
				topOffset = - o.height * userOptions.quickMenuScale / window.devicePixelRatio;
				break;
			case "middle":
				topOffset = - o.height / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio;
				break;
			case "bottom":
				break;
		}
	}
	
	const borderOffset = 0;

	let initialOffsetX = Math.max(0, Math.min(o.x - borderOffset + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + leftOffset, window.innerWidth - o.width * userOptions.quickMenuScale / window.devicePixelRatio - getScrollBarWidth()));
	
	let initialOffsetY = Math.max(0, Math.min(o.y - borderOffset + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + topOffset, window.innerHeight - o.height * userOptions.quickMenuScale / window.devicePixelRatio - getScrollBarHeight()));

	return {x: initialOffsetX, y: initialOffsetY}

}

function checkContextMenuEventOrder() {
	document.addEventListener('mousedown', e => {
		if ( e.which !== 3 ) return;

		let time = Date.now();

		document.addEventListener('contextmenu', _e => {
			if ( Date.now() - time < 10 ) {
				console.log('context on mousedown')
			} else {
				
			}
		}, {once: true})
	});
}

//checkContextMenuEventOrder();

if ( window == top && addParentDockingListeners && typeof addParentDockingListeners === 'function')
	addParentDockingListeners('CS_quickMenuIframe', 'quickMenu');
