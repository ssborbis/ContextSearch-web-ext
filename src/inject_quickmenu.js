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

var getQM = () => document.getElementById('CS_quickMenuIframe');

function openQuickMenu(ev, searchTerms) {

	ev = ev || new Event('click');

	// if ( getQM() ) closeQuickMenu();
		
	// links need to be blurred before focus can be applied to search bar (why?)
	if ( userOptions.quickMenuSearchBarFocus /* && ev.target.nodeName === 'A' */) {
		
		// restore selection to text boxes
		if (ev.target.selectionStart)  // is a text box
			document.addEventListener('closequickmenu', e => ev.target.focus(), {once: true});
		
		// don't blur on drag
		if ( !ev.dataTransfer )
			ev.target.blur();
	}

	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: quickMenuObject.screenCoords,
		mouseCoords: quickMenuObject.mouseCoords,
		searchTerms: searchTerms || getSelectedText(ev.target).trim() || linkOrImage(ev.target, ev),
		quickMenuObject: quickMenuObject,
		openingMethod: ev.openingMethod || null
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
	let ud = getUnderDiv();
	
	if ( ud ) ud.parentNode.removeChild(ud);
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
document.addEventListener('keydown', ev => {

	if (
		ev.key !== "Escape" ||
		ev.repeat ||
		!userOptions.quickMenu		
	) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});	
});

function scrollEventListener(ev) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: ev.type});
	setTimeout(() => window.scrollThrottler = false, 250);
}

window.addEventListener(window.hasOwnProperty('onmousewheel') ? 'mousewheel' : 'wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

// Listen for quickMenuKey
document.addEventListener('keydown', ev => {
	
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
document.addEventListener('keyup', ev => {
	
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
document.addEventListener('mousedown', ev => {

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
		function preventDrag(e) { e.preventDefault() }
		window.addEventListener('dragstart', preventDrag, {once: true});

		// ignore select / drag events
		if (Math.abs(quickMenuObject.mouseCoords.x - quickMenuObject.mouseCoordsInit.x) > quickMenuObject.mouseDragDeadzone || Math.abs(quickMenuObject.mouseCoords.y - quickMenuObject.mouseCoordsInit.y) > quickMenuObject.mouseDragDeadzone ) return false;

		// prevent losing text selection
		ev.target.addEventListener('mouseup', evv => {
			if (evv.which !== ev.which) return;
			evv.preventDefault();
			quickMenuObject.mouseLastClickTime = Date.now();
		}, {once: true});
		
		if (ev.which === 1) {
			// Disable click to prevent links from opening
			ev.target.addEventListener('click', evv => {
				if (evv.which !== 1) return;
				evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true});
			
		} else if (ev.which === 2) {
			// Disable click to prevent links from opening
			ev.target.addEventListener('mousedown', evv => {
				if (evv.which !== 2) return;
				evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true});
			
		} else if (ev.which === 3) {
			// Disable the default context menu once
			document.addEventListener('contextmenu', evv => {
				if ( !userOptions.quickMenuAllowContextMenu )
					evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true});

		}

		openQuickMenu(ev);

		// remove listener to prevent next drag event not working
		window.removeEventListener('dragstart', preventDrag);
		
	}, userOptions.quickMenuHoldTimeout);
});

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', ev => {

	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		ev.which !== userOptions.quickMenuMouseButton
	) return false;
		
	clearTimeout(quickMenuObject.mouseDownTimer);
});

// Listen for quickMenuAuto 
document.addEventListener('mousedown', ev => {
	
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuAuto || 
		ev.which !== 1 ||
		ev.target.id === 'quickMenuElement' ||
		ev.target.parentNode.id === 'quickMenuElement'
	) return false;
	
	quickMenuObject.mouseDownTargetIsTextBox = isTextBox(ev.target);
});

document.addEventListener('mouseup', ev => {

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

	if ( Date.now() - quickMenuObject.lastSelectTime > ( userOptions.quickMenuAutoTimeout || Number.MAX_VALUE ) && !isTextBox(ev.target) ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	clearTimeout(quickMenuObject.mouseDownTimer);
	
	// // skip erroneous short selections
	let searchTerms = getSelectedText(ev.target);
	setTimeout(() => {
		if ( searchTerms === getSelectedText(ev.target) ) {
			 openQuickMenu(ev);
			 
			if ( userOptions.quickMenuCloseOnEdit && isTextBox(ev.target) ) {
				ev.target.addEventListener('input', e => browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "input"}), {once: true});
			}
		}
	}, 50);
});

// Listen for quickMenuOnClick
document.addEventListener('mousedown', ev => {

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

	// middle-click often used to open links and requires some caveots
	if ( ev.which === 2 && !getSelectedText(ev.target) ) return false;
	if ( ev.which === 2 ) ev.preventDefault();

	document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});
	
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		document.removeEventListener('contextmenu', preventContextMenuHandler);
		quickMenuObject.mouseDownTimer = null;
	}, userOptions.quickMenuHoldTimeout);
});
		
// Listen for quickMenuOnClick	
document.addEventListener('mouseup', ev => {	

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
	if ( ev.which === 2 ) ev.preventDefault();

	openQuickMenu(ev);	
});

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

	if ( userOptions.quickMenuOnSimpleClick.useInnerText && e.target.nodeType !== 3 ) {
		e.target.classList.add('CS_invert');
		setTimeout(() => e.target.classList.remove('CS_invert'), 250);

		document.addEventListener('mouseup', _e => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();
		
			// avoid close on document click with a short delay
			setTimeout(() => openQuickMenu(e, e.target.innerText), 50);
		}, {once: true});
		return;
	}

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

		document.addEventListener('mouseup', _e => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();
		
			// avoid close on document click with a short delay
			setTimeout(() => openQuickMenu(e, word), 50);
		}, {once: true});
	}
	
	function getWord(str, offset) {
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
});

document.addEventListener('dragstart', e => {
	if (
		!userOptions.quickMenu ||
		!userOptions.quickMenuOnDrag
	) return;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e);

	if ( !searchTerms ) return;

	document.addEventListener('keydown', e => {
		if ( e.key === "Escape" && getQM())
			closeQuickMenu();
	}, {once: true});

	// let ds = new DragShake();
	// ds.onshake = () => closeQuickMenu();
	// ds.start();

	openQuickMenu(e);
});

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
});

// close quickmenu when clicking anywhere on page
document.addEventListener("click", ev => {

	if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return false;
	
	if ( userOptions.quickMenuAllowContextMenu && ev.which !== 1 ) return;
	
	// prevent links from opening
	if ( getQM() && !quickMenuObject.locked)
		ev.preventDefault();

	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_window"});
});

// track mouse position
document.addEventListener("mousemove", ev => {
	quickMenuObject.mouseCoords = {x: ev.clientX, y: ev.clientY};
	quickMenuObject.screenCoords = {x: ev.screenX, y: ev.screenY};
});

// prevent quickmenu during drag events
document.addEventListener("drag", ev => clearTimeout(quickMenuObject.mouseDownTimer));

window.addEventListener('keydown', e => {
	if (
		e.key !== "Tab" ||
		!getQM() 
	) return;
	
	e.preventDefault();
	
	// links and text boxes need to be blurred before focus can be applied to search bar (why?)
	e.target.blur();
	
	browser.runtime.sendMessage({action: "focusSearchBar"});
});

// document.addEventListener('zoom', e => {
// 	if ( getQM() ) scaleAndPositionQuickMenu(null, true);
// });

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			
			case "closeQuickMenuRequest":
				if ( !getQM() ) break;
				closeQuickMenu(message.eventType || null);
				break;
				
			case "openQuickMenu":

				// opened by shortcut
				if ( !message.screenCoords) {
					makeQuickMenuContainer(quickMenuObject.mouseCoords);
					return;
				}

				let x = (message.screenCoords.x - (quickMenuObject.screenCoords.x - quickMenuObject.mouseCoords.x * window.devicePixelRatio)) / window.devicePixelRatio;
				
				let y = (message.screenCoords.y - (quickMenuObject.screenCoords.y - quickMenuObject.mouseCoords.y * window.devicePixelRatio)) / window.devicePixelRatio;

				quickMenuObject.searchTerms = message.searchTerms;
				quickMenuObject.lastOpeningMethod = message.openingMethod || null;

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

				makeQuickMenuContainer({'x': x,'y': y});
				
				break;
			
			case "updateSearchTerms":

				// only update if quickmenu is opened and locked OR using IFRAME popup to avoid unwanted behavior
				if (quickMenuObject.locked || document.title === "QuickMenu" || getQM()) {
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
				
				var qmc = getQM();
				
				qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
				qmc.style.setProperty('--cs-scale', userOptions.quickMenuScale);
				if ( !userOptions.enableAnimations ) qmc.style.setProperty('--user-transition', 'none');

				let coords = qmc.openingCoords;
				
				let leftOffset = topOffset = 0;

				for (let position of userOptions.quickMenuPosition.split(" ")) {
					switch (position) {
						case "left":
							leftOffset = - message.size.width * userOptions.quickMenuScale / window.devicePixelRatio;
							break;
						case "right":
							break;
						case "center":
							leftOffset = - message.size.width / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio;
							break;
						case "top":
							topOffset = - message.size.height * userOptions.quickMenuScale / window.devicePixelRatio;
							break;
						case "middle":
							topOffset = - message.size.height / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio;
							break;
						case "bottom":
							break;
					}
				}
				
				const borderOffset = 0;
				const resizeWidgetOffset = 8.0;

				let initialOffsetX = Math.max(0, Math.min(coords.x - borderOffset + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + leftOffset, window.innerWidth - message.size.width * userOptions.quickMenuScale / window.devicePixelRatio - resizeWidgetOffset - getScrollBarWidth()));
				
				let initialOffsetY = Math.max(0, Math.min(coords.y - borderOffset + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + topOffset, window.innerHeight - message.size.height * userOptions.quickMenuScale / window.devicePixelRatio - resizeWidgetOffset - getScrollBarHeight()));

				makeDockable(qmc, {
					windowType: "undocked",
					dockedPosition: "left",
					handleElement: qmc,
					lastOffsets: window.quickMenuLastOffsets || {
						left: Math.floor(initialOffsetX * window.devicePixelRatio),
						right: Number.MAX_SAFE_INTEGER,
						top: Math.floor(initialOffsetY * window.devicePixelRatio),
						bottom: Number.MAX_SAFE_INTEGER 
					},
					onUndock: o => {
						if ( qmc.resizeWidget ) qmc.resizeWidget.setPosition();
						
						qmc.contentWindow.postMessage({action: "resizeMenu", options: {maxHeight: getMaxIframeHeight()}}, browser.runtime.getURL('/quickmenu.html'));
						
						window.quickMenuLastOffsets = o.lastOffsets;
						
						if ( !quickMenuObject.locked ) delete window.quickMenuLastOffsets;
					},
					onDock: o => {}
				});
				
				qmc.docking.init();

				setTimeout(() => { 
					repositionOffscreenElement( qmc, {left:0, right:resizeWidgetOffset, top:0, bottom:resizeWidgetOffset} ); 
				}, 250);

				_message = message;

				qmc.getBoundingClientRect();
				qmc.style.opacity = null;
				
				if ( !message.resizeOnly )
					browser.runtime.sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
				

				qmc.columns = _message.columns;
				qmc.tileCount = _message.tileCount;
				qmc.tileSize = _message.tileSize;

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

	let qmc = getQM();
	let columns = qmc.columns;
	let tileCount = qmc.tileCount;
	let tileSize = qmc.tileSize;

	let resizeWidget = addResizeWidget(qmc, {
		tileSize: tileSize,
		columns: columns,
		rows: Math.ceil(tileCount / columns ),
		onDragStart: o => {
			qmc.docking.translatePosition('top', 'left');
		},
		onDrag: o => {

			resizeWidget.style.visibility = 'hidden';

			// set prefs
			if ( resizeWidget.options.allowHorizontal ) userOptions.quickMenuColumns = o.columns;
			if ( resizeWidget.options.allowVertical ) {
				
				// check for singleColumn
				if ( resizeWidget.options.allowHorizontal )
					userOptions.quickMenuRows = o.rows;
				else
					userOptions.quickMenuRowsSingleColumn = o.rows;
			}

			// rebuild menu with new dimensions
			qmc.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, columns:o.columns, rows:o.rows}, browser.runtime.getURL('/quickmenu.html'));
		},
		onDrop: o => {

			resizeWidget.style.visibility = null;
			
			// resize changes the offsets
			qmc.docking.options.lastOffsets = qmc.docking.getOffsets();
			
			// reset the fixed quadrant
			qmc.style.transition = 'none';
			let position = qmc.docking.getPositions(qmc.docking.options.lastOffsets);
			qmc.docking.translatePosition(position.v, position.h);
			qmc.style.transition = null;
				
			// resize the menu again to shrink empty rows					
			qmc.contentWindow.postMessage({action: "resizeMenu", options: {maxHeight: getMaxIframeHeight(), rebuildTools: true}}, browser.runtime.getURL('/quickmenu.html'));

			// save prefs
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
		}
	});

//	resizeWidget.style.opacity = 1;
	qmc.classList.add('CS_resizing');
	resizeWidget.classList.add("editQuickMenu");
	
	// hide the widget until the menu is done transitioning
	resizeWidget.style.visibility = 'visible';
	resizeWidget.style.zIndex = -1;
	setTimeout(() => {
		resizeWidget.style.visibility = null;
		resizeWidget.style.zIndex = null;
	}, 500);

	qmc.resizeWidget = resizeWidget;
	
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
		
		iframe.resizeWidget.options.rows = Math.ceil(e.data.tileCount / e.data.columns );
		iframe.resizeWidget.options.columns = e.data.columns;
		iframe.resizeWidget.options.allowHorizontal = !e.data.singleColumn;
	}

	if ( e.data.size.height) {

		if ( e.data.size.height <= getMaxIframeHeight() )
			iframe.style.height = e.data.size.height + "px"; 
		else 
			console.warn('height exceeds window - bad resizeMenu');
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

// docking event listeners for iframe
window.addEventListener('message', e => {

	if ( e.data.target !== "quickMenu" ) return;
	
	let qmc = getQM();
	
	let x = e.data.e.clientX / window.devicePixelRatio;
	let y = e.data.e.clientY / window.devicePixelRatio;

	switch ( e.data.action ) {
		case "handle_dragstart":
			qmc.docking.moveStart({clientX:x, clientY:y});
			break;
		
		case "handle_dragend":
			qmc.docking.moveEnd({clientX:x, clientY:y});
			break;
		
		case "handle_dragmove":
			qmc.docking.moveListener({clientX:x, clientY:y});
			break;
			
		case "handle_dock":
			qmc.docking.toggleDock();
			break;
	}
});
