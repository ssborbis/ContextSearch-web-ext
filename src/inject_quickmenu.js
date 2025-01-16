var screenCoords = {x:0, y:0};
var cancelRequest = 0;

// set the initial value on page load
quickMenuObject.disabled = userOptions.quickMenuDisabledInNewTabs;

const getQM = () => getShadowRoot().getElementById('CS_quickMenuIframe');

function clearMouseDownTimer() {
	clearTimeout(quickMenuObject.mouseDownTimer);
	clearTimeout(quickMenuObject.mouseDownHoldTimer);
	quickMenuObject.mouseDownTimer = null;
	quickMenuObject.mouseDownHoldTimer = null;
}

function deselectAllText(e) {
	window.getSelection().removeAllRanges();

	[document.activeElement, window.lastActiveElement].forEach( el => {
		if ( el && el.selectionStart )
			el.setSelectionRange(0,0);
	});
}

function checkToolStatus(name) {
	let tool = userOptions.quickMenuTools.find( _tool => _tool.name === name );
	if ( !tool ) return false;
	return tool.on ? true : false;
}

const getStyleProperty = (el, p) => parseFloat((window.getComputedStyle(el, null).getPropertyValue(p)));
const getBorderWidth = (el) => parseFloat(getStyleProperty(el, 'border-left-width')) + parseFloat(getStyleProperty(el, 'border-right-width'));
const getBorderHeight = (el) => parseFloat(getStyleProperty(el, 'border-top-width')) + parseFloat(getStyleProperty(el, 'border-bottom-width'));

function openQuickMenu(e, searchTerms) {
	
	e = e || new MouseEvent('click');

	let target = e.target;

	// open on icon causes inputs to blur, workaround
	if ( target == document )
		target = document.body;

	// let selection = searchTerms || getSelectedText(target).trim();

	// let searchTermsObject = {
	// 	selection: selection,
	// 	image: getImage(target),
	// 	link: getLink(target),
	// 	linkText: getLinkText(target),
	// 	page: window.location.href,
	// 	frame: target.ownerDocument.defaultView != top ? target.ownerDocument.defaultView.location.href : null
	// }

	let searchTermsObject = getContextsObject(e.target, e);

	// set searchTerms by priority
	searchTerms = searchTerms || searchTermsObject.selection || linkOrImage(target, e) || searchTermsObject.frame || searchTermsObject.page || null;

	let _contexts = getContexts(target, e);
	
	// for context toggle
	quickMenuObject.searchTerms = searchTerms;
	quickMenuObject.searchTermsObject = searchTermsObject;

	window.lastActiveElement = document.activeElement;
		
	// links need to be blurred before focus can be applied to search bar (why?)
	if ( userOptions.quickMenuSearchBarFocus /* && ev.target.nodeName === 'A' */) {
		
		// restore selection to text boxes
		if (target && target.selectionStart)  // is a text box
			document.addEventListener('closequickmenu', e => target.focus(), {once: true});
		
		// don't blur on drag
		if ( target && !e.dataTransfer )
			target.blur();
	}
	
	if ( e.openingMethod && e.openingMethod === 'simple' && _contexts.length === 1 && _contexts[0] === 'page') {
		_contexts.push('selection');
	}

	quickMenuObject.contexts = _contexts;

	sendMessage({
		action: "openQuickMenu", 
		screenCoords: quickMenuObject.screenCoords,
		mouseCoords: quickMenuObject.mouseCoords,
		searchTerms: searchTerms,
		quickMenuObject: quickMenuObject,
		openingMethod: e.openingMethod || e.type || null,
		contexts: _contexts,
		searchTermsObject: searchTermsObject
	});
}

var getUnderDiv = () => getShadowRoot().querySelector('#CS_underDiv');

function addUnderDiv() {
	if ( !userOptions.quickMenuPreventPageClicks ) return;
	
	let ud = getUnderDiv() || document.createElement('div');
	ud.id = 'CS_underDiv';
	getShadowRoot().appendChild(ud);
}

function removeUnderDiv() {
	
	if ( getUnderDiv() ) getUnderDiv().parentNode.removeChild(getUnderDiv() );
}

function closeAllFolders() {
	getShadowRoot().querySelectorAll('.CS_quickMenuIframe').forEach( el => {	
		if ( el !== getQM() ) el.parentNode.removeChild(el);
	});
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

	// remove qm child windows
	closeAllFolders();
	
	var qmc = getQM();

	if (qmc) {
		qmc.style.opacity = 0;
		document.dispatchEvent(new CustomEvent('closequickmenu'));
		
		setTimeout(() => {

			// hide vs display
			if ( userOptions.quickMenuReuseVsClose && qmc ) {
				qmc.style.display = 'none';
				qmc.style.left = '-9999px';
			}

			// remove
			else if (qmc && qmc.parentNode) qmc.parentNode.removeChild(qmc);
		}, 100);
	}
	
	removeUnderDiv();
	
	if ( ( userOptions.quickMenuDeselectTextOnSearch ) && eventType === 'click_quickmenutile' ) {
		sendMessage({action: "deselectAllText"});
	}
}

function getOffsets() {
	let xOffset=window.pageXOffset;
	let yOffset=window.pageYOffset;
	
	return {x: xOffset, y: yOffset};
}

function makeMenuWindow(o) {
	let qmc = document.createElement('iframe');

	qmc.id = o.id;
	qmc.className = "CS_quickMenuIframe";
	
	qmc.style.opacity = 0;
	qmc.style.width = 0;
	qmc.style.height = 0;

	qmc.allowTransparency = true;
	
	qmc.openingCoords = o.coords;
	
	getShadowRoot().appendChild(qmc);

	qmc.onload = o.onload;
	qmc.src = o.src;

	return qmc;
}

// build the floating container for the quickmenu
function makeQuickMenuContainer(o) {

	if ( checkToolStatus("repeatsearch") ) {

		let _id = userOptions.lastUsedId;

		sendMessage({
			action: "search", 
			info: {
				menuItemId:_id,
				selectionText: quickMenuObject.searchTerms,
				openMethod: userOptions.lastOpeningMethod || userOptions.quickMenuLeftClick
			}
		});

		return;
	}

	let qmc = getQM();

	if (qmc) qmc.parentNode.removeChild(qmc);

	qmc = makeMenuWindow({
		coords: o.coords,
		id: "CS_quickMenuIframe",
		onload: function() {
			this.contentWindow.postMessage(Object.assign({action: "openMenu", frameBorder: {width: this.offsetWidth, height: this.offsetHeight}, windowSize: {width: window.innerWidth, height:window.innerHeight}, menuScale: this.getBoundingClientRect().width / this.offsetWidth, maxHeight: getMaxIframeHeight()}, o), this.src);
		},
		src: browser.runtime.getURL('quickmenu.html')
	})

	// Check if quickmenu fails to display
	setTimeout(() => {
		if (!qmc || qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("display") === 'none') {
			console.error('iframe quick menu hidden by external script (adblocker?).  Enabling context menu');
			sendMessage({action: 'enableContextMenu'});
			removeUnderDiv();
		}
	}, 1000);

	addUnderDiv();
}

function makeQuickMenuElementContainer(o) {

	let qmc = makeMenuWindow({
		coords: o.coords,
		id: o.folder.id,
		onload: function() {
			this.contentWindow.postMessage({action: "openFolderNew", folder:o.folder, contexts: quickMenuObject.contexts, windowSize: {width: window.innerWidth, height:window.innerHeight}}, this.src);
		},
		src: browser.runtime.getURL('quickmenu.html#' + o.folder.id)
	})

	qmc.setAttribute('parentFrameId', o.parentFrameId );
	qmc.style.transition = 'none';
}

const closeFolder = id => {
	let f = getShadowRoot().getElementById(id);

	if ( !f ) return;

	let child = getShadowRoot().querySelector('iframe[parentFrameId="' + id + '"]');
	// don't close if window has a child window
	if ( child ) return;
	f.parentNode.removeChild(f);
}

const closeChildFolders = id => {
	let fs = getShadowRoot().querySelectorAll('iframe[parentFrameId="' + id + '"]');
	fs.forEach(f => f.parentNode.removeChild(f));
}

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', e => {

	if (
		e.key !== "Escape" ||
		e.repeat ||
		quickMenuObject.disabled
	) return false;
	
	sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});	
});

function scrollEventListener(e) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	sendMessage({action: "closeQuickMenuRequest", eventType: e.type});
	setTimeout(() => window.scrollThrottler = false, 250);
}

window.addEventListener(window.hasOwnProperty('onmousewheel') ? 'mousewheel' : 'wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

window.addEventListener(window.hasOwnProperty('onmousewheel') ? 'mousewheel' : 'wheel', e => {
	if ( userOptions.quickMenuCancelOnMousewheel) {
		clearMouseDownTimer();
	}
});

// Listen for quickMenuKey
document.addEventListener('keydown', e => {
	
	if (
		e.which !== userOptions.quickMenuKey ||
		e.repeat ||
		!userOptions.quickMenuOnKey ||
		getSelectedText(e.target) === "" ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs) ||
		quickMenuObject.disabled
	) return false;

	quickMenuObject.keyDownTimer = Date.now();	
});

// Listen for quickMenuKey
document.addEventListener('keyup', e => {
	
	if (
		e.which !== userOptions.quickMenuKey ||
		e.repeat ||
		!userOptions.quickMenuOnKey ||
		// check for typing in text box
		( isTextBox(e.target) && !getSelectedText(e.target)) ||
		quickMenuObject.disabled
	) return false;

	if ( e.ctrlKey || e.shiftKey || e.altKey || e.metaKey ) return false;

	if (Date.now() - quickMenuObject.keyDownTimer < 250)
		openQuickMenu(e);
	
	quickMenuObject.keyDownTimer = 0;
});

// Listen for quickMenuAuto 
document.addEventListener('mousedown', e => {
	
	if (
		!userOptions.quickMenuAuto || 
		e.which !== 1 ||
		e.target.id === 'quickMenuElement' ||
		e.target.parentNode.id === 'quickMenuElement' ||
		quickMenuObject.disabled
	) return false;
	
	quickMenuObject.mouseDownTargetIsTextBox = isTextBox(e.target);
}, {capture: true});

document.addEventListener('mouseup', e => {

	let searchTerms = getSelectedText(e.target);

	if (
		!userOptions.quickMenuAuto || 
		e.which !== 1 ||
		e.target.id === 'quickMenuElement' ||
		e.target.parentNode.id === 'quickMenuElement' ||
		searchTerms.trim() === "" ||
		( userOptions.quickMenuAutoMaxChars && searchTerms.length > userOptions.quickMenuAutoMaxChars ) ||
		searchTerms.length < userOptions.quickMenuAutoMinChars ||
		( !userOptions.quickMenuAutoOnDoubleClick && e.detail > 1 ) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs ) ||
		( quickMenuObject.mouseDownTargetIsTextBox && !userOptions.quickMenuAutoOnInputs ) ||
		quickMenuObject.disabled
		
	) return false;

	// check for modifier keys
	if ( 
		e.shiftKey !== userOptions.quickMenuAutoShift ||
		e.altKey !== userOptions.quickMenuAutoAlt ||
		e.ctrlKey !== userOptions.quickMenuAutoCtrl
	) return false;

	e.openingMethod = "auto";

	//if ( Date.now() - quickMenuObject.lastSelectTime > ( userOptions.quickMenuAutoTimeout || Number.MAX_VALUE ) && !isTextBox(e.target) ) return false;
	if ( Date.now() - quickMenuObject.lastSelectTime > ( userOptions.quickMenuAutoTimeout || Number.MAX_VALUE ) && !quickMenuObject.mouseDownTargetIsTextBox ) return false;
	
	quickMenuObject.mouseLastClickTime = Date.now();
	clearMouseDownTimer();

	// skip erroneous short selections

	setTimeout(() => {

		if ( searchTerms === getSelectedText(e.target) ) {
			openQuickMenu(e);

			if ( userOptions.quickMenuCloseOnEdit && quickMenuObject.mouseDownTargetIsTextBox ) {

				let handler = () => sendMessage({action: "closeQuickMenuRequest", eventType: "input"});
				
				const handlerType = userOptions.quickMenuCloseOnEditKeydown ? "keydown" : "input";
				e.target.addEventListener(handlerType, handler, {once: true});

				// remove listener if menu is closed
				document.addEventListener('closequickmenu', () => e.target.removeEventListener(handlerType, handler), {once:true});	
			}
		}
	}, 50);
}, {capture: true});

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mousedown', e => {

	if (
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		e.which !== userOptions.quickMenuMouseButton ||
		( !hasSearchTerms(e) && !userOptions.quickMenuOnMouseOpenWithoutSelection ) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs ) ||
		quickMenuObject.disabled ||
		!e.isTrusted
	) return false;

	// check for modifier keys
	if ( 
		(userOptions.quickMenuOnMouseShift !== e.shiftKey)  ||
		(userOptions.quickMenuOnMouseAlt !== e.altKey)  ||
		(userOptions.quickMenuOnMouseCtrl && userOptions.quickMenuOnMouseCtrl !== e.ctrlKey)  // leave for link / linkText
	) return false;

	// check for pointer over selection
	if ( getSelectedText(e.target) && userOptions.quickMenuOnlyOpenIfOverSelection && !isEventOnSelectedText(e) ) return false;

	checkContextMenuEventOrder(e);

	// if a non-default method is set, suppress the dcm
	if ( e.which === 3 && userOptions.quickMenuMoveContextMenuMethod ) {

		if ( 
			e.altKey && userOptions.quickMenuMoveContextMenuMethod === 'alt' ||
			e.ctrlKey && userOptions.quickMenuMoveContextMenuMethod === 'ctrl' ||
			e.shiftKey && userOptions.quickMenuMoveContextMenuMethod === 'shift'
		) return;

		if ( userOptions.quickMenuMoveContextMenuMethod === 'dblclick' ) {
			if ( Date.now() - quickMenuObject.mouseLastContextMenuTime > userOptions.quickMenuRightClickTimeout ) {
				disableContextMenu(e.target);
				quickMenuObject.mouseLastContextMenuTime = Date.now();
			} else {
				document.addEventListener('contextmenu', _e => {
					clearMouseDownTimer();
				}, {once: true});

				return;
			}
		} else {
			disableContextMenu(e.target);
		} 
	}

	if ( e.which === 2 ) {
		disableLinks(e.target);
		disableScroll(e.target);
	}

	let coords = Object.assign({}, screenCoords);
		
	// timer for mouse down
	quickMenuObject.mouseDownHoldTimer = setTimeout(() => {	

		// prevent drag events when using search on mouseup
		function preventDrag(_e) { _e.preventDefault() }
		window.addEventListener('dragstart', preventDrag, {once: true});

		if (Math.abs(screenCoords.x - coords.x) > userOptions.quickMenuCancelDeadzone || Math.abs(screenCoords.y - coords.y) > userOptions.quickMenuCancelDeadzone ) return false;

		// prevent losing text selection
		document.addEventListener('mouseup', _e => {
			if (_e.which !== e.which) return;
			_e.preventDefault();
			quickMenuObject.mouseLastClickTime = Date.now();
			clearMouseDownTimer();

		}, {once: true});
		
		if (e.which === 1) {
			// Disable click to prevent links from opening
			e.target.addEventListener('click', _e => {
				if (_e.which !== 1) return;
				_e.preventDefault();
			}, {once: true});		
		} else if (e.which === 3) {
			// Disable the default context menu once
			disableContextMenu(e.target);

			// remove the listener after timeout or 1s
		//	document.addEventListener('mouseup', () => setTimeout(enableContextMenu, userOptions.quickMenuHoldTimeout || 1000 ), {once: true});
		}

		quickMenuObject.mouseLastClickTime = Date.now();

		openQuickMenu(e);

		// remove listener to prevent next drag event not working
		window.removeEventListener('dragstart', preventDrag);

		clearMouseDownTimer();
		
	}, userOptions.quickMenuHoldTimeout);

}, {capture: true});

// Listen for HOLD quickMenuMouseButton
document.addEventListener('mouseup', e => {

	if (
		!userOptions.quickMenuOnMouse ||
		userOptions.quickMenuOnMouseMethod !== 'hold' ||
		e.which !== userOptions.quickMenuMouseButton ||
		quickMenuObject.disabled
	) return false;

	clearMouseDownTimer();
	
	// slight delay to prevent context menu
	setTimeout(() => {
		enableContextMenu();
		enableLinks();
		enableScroll();
	}, 50);
	
		
}, {capture: true});

function hasSearchTerms(e) {
	return getSelectedText(e.target) || linkOrImage(e.target, e);
}

// track event listeners for suppressing scroll, links, context menus
function disableDefaultHandler(e) {
	e.preventDefault();
	e.stopPropagation();
}
function disableLinks(el) {

	if ( !userOptions.quickMenuPreventLinksOnMiddleButton ) return;

	el.addEventListener('auxclick', disableDefaultHandler, {once: true});
	el.dataset.csDisableLinks = true;
}
function enableLinks() {
	document.querySelectorAll('[data-cs-disable-links]').forEach(el => {
		el.removeEventListener('auxclick', disableDefaultHandler);
		delete el.dataset.csDisableLinks;
	});
}
function disableScroll(el) {

	if ( !userOptions.quickMenuPreventScrollOnMiddleButton ) return;

	document.addEventListener('mousedown', disableDefaultHandler, {once:true});
	//el.dataset.csDisableScroll = true;
}
function enableScroll() {
	//document.querySelectorAll('[data-cs-disable-scroll]').forEach(el => {
		document.removeEventListener('mousedown', disableDefaultHandler);
	//	delete el.dataset.csDisableScroll;
	//});
}
function disableContextMenu(el) {

	if ( userOptions.quickMenuAllowContextMenuNew ) return;

	document.addEventListener('contextmenu', disableDefaultHandler, {once:true});
}
function enableContextMenu() {
	document.removeEventListener('contextmenu', disableDefaultHandler);
}
// Listen for quickMenuOnClick
document.addEventListener('mousedown', e => {

	if (
		!userOptions.quickMenuOnMouse ||
		!['click', 'dblclick'].includes(userOptions.quickMenuOnMouseMethod) ||
		e.which !== userOptions.quickMenuMouseButton ||
		(
			(!hasSearchTerms(e) && !userOptions.quickMenuOnMouseOpenWithoutSelection ) && 
			e.target.id !== 'CS_underDiv'
		) ||
		( isTextBox(e.target) && !userOptions.quickMenuAutoOnInputs) ||
		quickMenuObject.disabled
	) return false;

	// check for modifier keys
	if ( 
		(userOptions.quickMenuOnMouseShift !== e.shiftKey)  ||
		(userOptions.quickMenuOnMouseAlt !== e.altKey) /* ||
		(userOptions.quickMenuOnMouseCtrl !== e.ctrlKey)*/ // leave ctrlKey for link / linkText
	) return false;

		// check for pointer over selection
	if ( getSelectedText(e.target) && userOptions.quickMenuOnlyOpenIfOverSelection && !isEventOnSelectedText(e) ) return false;

	checkContextMenuEventOrder(e);

	if ( e.which === 3 ) {

		if ( 
			e.altKey && userOptions.quickMenuMoveContextMenuMethod === 'alt' ||
			e.ctrlKey && userOptions.quickMenuMoveContextMenuMethod === 'ctrl' ||
			e.shiftKey && userOptions.quickMenuMoveContextMenuMethod === 'shift'
		) return;

		// if a non-default method is set, suppress the dcm
		if ( userOptions.quickMenuMoveContextMenuMethod )
			disableContextMenu();
	}

	if ( e.which === 2 ) {
		disableLinks(e.target);
		disableScroll(e.target);

	//	if ( !getSelectedText(e.target) && !userOptions.quickMenuOnMouseOpenWithoutSelection ) return false;
	}

	// context menu on mousedown fixes
	if ( e.which === 3 && userOptions.quickMenuMoveContextMenuMethod === 'dblclick' ) {

		if ( Date.now() - quickMenuObject.mouseLastContextMenuTime < userOptions.quickMenuRightClickTimeout ) {
			sendMessage({action: "cancelQuickMenuRequest"});
			sendMessage({action: "closeQuickMenuRequest"});
			enableContextMenu();
			return;
		}
	}

	if ( e.which === 3 ) {
		quickMenuObject.mouseLastContextMenuTime = Date.now();
		
		// update parent with mouseLastContextMenuTime for double-click check + cancel
		if ( window !== top )
			sendMessage({action:"updateQuickMenuObject", quickMenuObject: quickMenuObject});
	}
	
	// timer for clearing event listeners set on mouse down
	quickMenuObject.mouseDownTimer = setTimeout(() => {
		enableLinks();
		enableScroll();
		enableContextMenu();
		clearMouseDownTimer();
	}, userOptions.quickMenuHoldTimeout);
}, {capture: true});
		
// Listen for quickMenuOnClick	
document.addEventListener('mouseup', e => {	

	if ( 
		!userOptions.quickMenuOnMouse ||
		!['click', 'dblclick'].includes(userOptions.quickMenuOnMouseMethod) ||
		e.which !== userOptions.quickMenuMouseButton ||
		!quickMenuObject.mouseDownTimer ||
		( !hasSearchTerms(e) && !userOptions.quickMenuOnMouseOpenWithoutSelection ) ||
		quickMenuObject.disabled
	) return false;

	if ( userOptions.quickMenuOnMouseMethod === 'dblclick' ) {

		// too much time between click, do nothing
		if ( Date.now() - quickMenuObject.mouseLastClickTime > 500 ) {
			quickMenuObject.mouseLastClickTime = Date.now();
			return;
		}
	}

	quickMenuObject.mouseLastClickTime = Date.now();
	
	e.preventDefault();
	e.stopPropagation();
	openQuickMenu(e);

}, {capture: true});

// listen for simple click
document.addEventListener('mousedown', e => {

	if ( 
		!userOptions.quickMenuOnSimpleClick.enabled ||
		userOptions.quickMenuOnSimpleClick.button !== e.which ||
		!e.altKey && userOptions.quickMenuOnSimpleClick.alt ||
		!e.ctrlKey && userOptions.quickMenuOnSimpleClick.ctrl ||
		!e.shiftKey && userOptions.quickMenuOnSimpleClick.shift ||
		getSelectedText(e.target) ||
		quickMenuObject.disabled
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

		//if ( e.which === 3 && !userOptions.quickMenuAllowContextMenuNew ) document.addEventListener('contextmenu', _e => _e.preventDefault(), {once: true});
		if ( e.which === 3 ) disableContextMenu();
		return;
	}

	// Only split TEXT_NODEs
	if ( word ) {		
		e.preventDefault();

		// back foward buttons
		if ( [3,4].includes(e.button) )
			e.stopPropagation();
		
		if ( e.shiftKey ) document.addEventListener('selectstart', _e => _e.preventDefault(), {once: true});

		//if ( e.which === 3 && !userOptions.quickMenuAllowContextMenuNew ) document.addEventListener('contextmenu', _e => _e.preventDefault(), {once: true});
		
		if ( e.which === 3 ) disableContextMenu();

		// prevent links
		document.addEventListener('click', _e => _e.preventDefault(), {once: true});

		document.addEventListener('mouseup', _e => {
			
			if ( _e.which !== e.which ) return;
			
			_e.preventDefault();

			e.openingMethod = 'simple';
		
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
		!userOptions.quickMenuOnDrag ||
		quickMenuObject.disabled
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

	// do nothing if editing
	if ( getShadowRoot().querySelector(".CS_overDiv.editQuickMenu") )
		return;

	if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return;
	
	if ( userOptions.quickMenuAllowContextMenuNew && e.which !== 1 ) return;

	if ( getQM() && e.target.id === "CS_icon") return;
	
	// prevent links from opening
	if ( getQM() && !quickMenuObject.locked)
		e.preventDefault();

	sendMessage({action: "closeQuickMenuRequest", eventType: "click_window"});
}, {capture: true});

// prevent quickmenu during drag events
document.addEventListener("drag", e => {
	clearMouseDownTimer();
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
	
	sendMessage({action: "focusSearchBar"});
});

// document.addEventListener('keydown', e => {
// 	if ( userOptions.quickMenuCloseOnKeydown )
// 		sendMessage({action: "closeQuickMenuRequest", eventType: "keydown"});
// });

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

			case "closeFolder":
				closeFolder(message.id);
				break;

			case "closeAllFolders":
				closeAllFolders();
				break;

			case "resizeAll":
				getShadowRoot().querySelectorAll('.CS_quickMenuIframe').forEach( el => {	
					el.contentWindow.postMessage({action: "resizeMenu", options: message.options || {}}, browser.runtime.getURL('/quickmenu.html'));		
				});
				break;

			case "openQuickMenu": {

				// opened by shortcut
				if ( !message.screenCoords) message.screenCoords = quickMenuObject.screenCoords;

				let x = quickMenuObject.mouseCoords.x;
				let y = quickMenuObject.mouseCoords.y;

				// recalculate for iframes
				if ( document.activeElement.nodeName === "IFRAME" ) {
					let rect = document.activeElement.getBoundingClientRect();
					x = message.mouseCoords.x + rect.left;
					y = message.mouseCoords.y + rect.top;
				}

				quickMenuObject.searchTerms = message.searchTerms || "";
				quickMenuObject.lastOpeningMethod = message.openingMethod || null;
				quickMenuObject.contexts = message.contexts || [];
				quickMenuObject.searchTermsObject = message.searchTermsObject || {};

				// keep old menu if locked
				if ( quickMenuObject.locked && getQM() ) {
					quickMenuObject.searchTerms = message.searchTerms;
					sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					}).then(() => {
						sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
					});
					break;
				}

				if ( message.folder ) {

					const removeChildren = (id) => {
						let child = getShadowRoot().querySelector('iframe[parentFrameId="' + id + '"]');

						if ( child ) {
							child.parentNode.removeChild(child);
							removeChildren(child.id);
						}
					}
				
					let parentFrame = getShadowRoot().getElementById(message.parentId) || getQM();

					if ( parentFrame ) {
						y = parentFrame.getBoundingClientRect().top + message.top / window.devicePixelRatio * userOptions.quickMenuScale;
						x = parentFrame.getBoundingClientRect().right;		
					}

					// close other open child frames of parentId
					removeChildren(message.parentId);

					makeQuickMenuElementContainer({
						coords: {x:x, y:y}, 
						folder: message.folder, 
						parentFrameId: message.parentId
					});
					break;
				}

				// skip opening menu if using instant search
				if ( checkToolStatus("repeatsearch") && userOptions.quickMenuRepeatSearchHideMenu ) {

					let _id = userOptions.lastUsedId;

					sendMessage({
						action: "search", 
						info: {
							menuItemId:_id,
							selectionText: quickMenuObject.searchTerms,
							openMethod: userOptions.lastOpeningMethod || userOptions.quickMenuLeftClick
						}
					});

					break;
				}

				// if the menu is open, reuse it
				if ( userOptions.quickMenuReuseVsClose && getQM() ) {
					let qmc = getQM();

					let borderWidth = getBorderWidth(qmc);
					let borderHeight = getBorderHeight(qmc);

					let initialOffsets = getQuickMenuOpeningPosition({
						width: parseFloat(qmc.style.width),
						height: parseFloat(qmc.style.height),
						x: x,
						y: y,
						borderWidth: borderWidth
					});

					qmc.style.left = initialOffsets.x + "px";
					qmc.style.top = initialOffsets.y + "px";
					qmc.style.display = null;
					qmc.style.opacity = 1;
					break;
				}

				makeQuickMenuContainer({
					coords: {x:x, y:y}
				});
				
				break;
			}
				
			case "lockQuickMenu":				
				lockQuickMenu();
				break;
				
			case "unlockQuickMenu":
				unlockQuickMenu();
				break;	

			case "quickMenuIframeFolderLoaded": {
				
				var qmc = getShadowRoot().getElementById(message.folder.id);

				qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
				qmc.style.setProperty('--cs-custom-scale', userOptions.quickMenuScale);

				qmc.style.left = qmc.openingCoords.x - 4 + "px";
				qmc.style.top = qmc.openingCoords.y + "px";
				qmc.style.opacity = 1;

				let borderWidth = getBorderWidth(qmc);
				let borderHeight = getBorderHeight(qmc);

				qmc.style.width = message.size.width + borderWidth + "px";
				qmc.style.height = Math.min(message.size.height + borderHeight, window.innerHeight * window.devicePixelRatio / userOptions.quickMenuScale) + "px";

				// check for room to open the menu
				let parentFrame = getShadowRoot().getElementById(qmc.getAttribute("parentFrameId")) || getQM();
				let pfr = parentFrame.getBoundingClientRect();
				let qmr = qmc.getBoundingClientRect();

				if ( parentFrame && pfr.left > window.innerWidth - pfr.right && window.innerWidth - pfr.right < qmr.width ) {
					qmc.style.left = pfr.left - qmr.width + 4 + "px";
				}

				setTimeout(() => repositionOffscreenElement(qmc), 2);
				break;
			}
				
			case "quickMenuIframeLoaded": {

				if ( Date.now() - cancelRequest < 1000) {
					return closeQuickMenu();
				}

				sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
				
				let qmc = getQM();
				
				qmc.style.cssText += ";--opening-opacity: " + userOptions.quickMenuOpeningOpacity;
				qmc.style.setProperty('--cs-custom-scale', userOptions.quickMenuScale);

				if ( !userOptions.enableAnimations ) qmc.style.setProperty('--user-transition', 'none');

				let borderWidth = getBorderWidth(qmc);
				let borderHeight = getBorderHeight(qmc);

				let initialOffsets = getQuickMenuOpeningPosition({
					width: message.size.width,
					height: message.size.height,
					x: qmc.openingCoords.x,
					y: qmc.openingCoords.y,
					borderWidth: borderWidth
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
						
						// don't resize initially
						if ( !o ) {
							qmc.contentWindow.postMessage({action: "resizeMenu", options: {move: true, openFolder:true, maxHeight: getMaxIframeHeight()}}, browser.runtime.getURL('/quickmenu.html'));
							
						}
						
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
				qmc.style.transition = null;

				qmc.style.width = message.size.width + "px";
				qmc.style.height = message.size.height + "px";
				
				if ( !message.resizeOnly )
					sendMessage({action: "dispatchEvent", e: "quickMenuComplete"});
				
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
						sendMessage({action: "focusSearchBar"});
				}, 50);

				break;
			}

			case "editQuickMenu": {

				let qmc = getQM();

				( message.on ) ? editOn(qmc) : editOff(qmc);

				break;
			}

			case "deselectAllText":
				deselectAllText();
				break;

			case "cancelQuickMenuRequest":
				clearMouseDownTimer();
				cancelRequest = Date.now();
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

	let resizeWidget = ResizeWidget(iframe, {
		tileSize: tileSize,
		columns: columns,
		rows: Math.ceil(tileCount / columns ),
		onDragStart: o => {
			iframe.docking.translatePosition('top', 'left');
			originalRect = iframe.getBoundingClientRect();

			document.addEventListener('click', e => {
				e.preventDefault();
				e.stopPropagation();
			}, {once: true})

		},
		onDrag: o => {

			iframe.classList.add('CS_resizing');

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

			// rebuild menu with new dimensions
			iframe.contentWindow.postMessage({action: "rebuildQuickMenu", userOptions: userOptions, columns:o.columns, rows:o.rows, rect: iframe.getBoundingClientRect(), devicePixelRatio: window.devicePixelRatio}, browser.runtime.getURL('/quickmenu.html'));
		},
		onDrop: o => {

			iframe.classList.remove('CS_resizing');

			resizeWidget.style.visibility = null;
			
			// resize changes the offsets
			iframe.docking.options.lastOffsets = iframe.docking.getOffsets();

			// resize the menu again to shrink empty rows					
			iframe.contentWindow.postMessage({action: "resizeMenu", options: {openFolder:true, maxHeight: getMaxIframeHeight(), rebuildTools: true}}, browser.runtime.getURL('/quickmenu.html'));
			
			// reset the fixed quadrant
			runAtTransitionEnd(iframe, ["height", "width"], () => {
				iframe.style.transition = 'none';
				let position = iframe.docking.getPositions(iframe.docking.options.lastOffsets);
				iframe.docking.translatePosition(position.v, position.h);
				iframe.style.transition = null;
			});
				
			// save prefs
			sendMessage({action: "saveUserOptions", userOptions: userOptions, source: "inject_quickmenu ondrop"});
		}
	});

//	resizeWidget.style.opacity = 1;
	
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
//		qmc.classList.remove('CS_resizing');
		delete qmc.resizeWidget;
	}
}

function getMaxIframeHeight() {
	return (window.innerHeight - getScrollBarHeight()) * window.devicePixelRatio / userOptions.quickMenuScale - window.devicePixelRatio;
}

function quickMenuResize(e) {

	let iframe = [...getShadowRoot().querySelectorAll('.CS_quickMenuIframe, #CS_quickMenuIframe')].find(el => el.contentWindow === e.source);

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
		case "resizeIframe":{

			url = new URL(browser.runtime.getURL(''));

			if ( e.origin !== url.origin ) return;

			if ( !getQM()) return;

			if ( e.source != getQM().contentWindow ) return;
			
			if ( !e.data.size ) return;

			quickMenuResize(e);
			break;
		}
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
	
	const borderOffset = (o.borderWidth || 0) / window.devicePixelRatio;

	let initialOffsetX = Math.max(0, Math.min(o.x - borderOffset + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + leftOffset, window.innerWidth - o.width * userOptions.quickMenuScale / window.devicePixelRatio - getScrollBarWidth()));
	
	let initialOffsetY = Math.max(0, Math.min(o.y - borderOffset + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + topOffset, window.innerHeight - o.height * userOptions.quickMenuScale / window.devicePixelRatio - getScrollBarHeight()));

	return {x: initialOffsetX, y: initialOffsetY}

}

function showIcon(searchTerms, e) {

	removeIcon = () => {
		let img = getShadowRoot().getElementById('CS_icon');

		// delay required for click / mouseup order weirdness
		if ( img ) setTimeout(() => img.parentNode.removeChild(img), 25);
	}

	if ( !userOptions.quickMenuIcon.enabled ) return;

	if ( !searchTerms ) return removeIcon();

	let img = getShadowRoot().getElementById('CS_icon');

	if ( e.target === img ) return;

	if ( img ) return removeIcon();

	// convert relative urls to extension urls
	let url = userOptions.quickMenuIcon.url.includes(":") ? userOptions.quickMenuIcon.url : browser.runtime.getURL(userOptions.quickMenuIcon.url);

	img = new Image();
	img.src = url || browser.runtime.getURL('icons/logo_notext.svg');
	img.style.top = e.pageY + 4 + userOptions.quickMenuIcon.y + "px";
	img.style.left = e.pageX + 4 + userOptions.quickMenuIcon.x + "px";
	img.id = 'CS_icon';
	img.title = 'ContextSearch web-ext';

	img.addEventListener('click', () => openQuickMenu(e, searchTerms));

	getShadowRoot().appendChild(img);

	// if qm opened by other means, remove
	document.addEventListener('quickMenuComplete', removeIcon, {once: true});
	
}

document.addEventListener('mouseup', e => {
	let searchTerms = getSelectedText(e.target);
	showIcon(searchTerms, e);
});

function checkContextMenuEventOrder(e) {
	if ( e.which !== 3 ) return;
	if ( userOptions.quickMenuMoveContextMenuMethod || !userOptions.checkContextMenuEventOrder ) return;

	let time = Date.now();

	document.addEventListener('contextmenu', _e => {
		if ( Date.now() - time < 10 ) {
			document.addEventListener('quickMenuComplete', e => {
				if ( window == top ) checkContextMenuEventOrderNotification();
				else window.top.checkContextMenuEventOrderNotification();
			}, {once: true});
		}
	}, {once: true});
}

function isEventOnSelectedText(e) {

	const isInside = (point, rect) => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

	var selection = window.getSelection();
	var range = selection.getRangeAt(0); 

	for ( let rect of range.getClientRects() ) {
		if ( isInside(e,rect) ) return true;
	}

	return false;
}

const isEditing = el => {
	return el.classList.contains("CS_editing");
}

const editRemoveOverDiv = () => {
	let overDiv = getShadowRoot().querySelector(".CS_overDiv.editQuickMenu");
	if (overDiv) overDiv.parentNode.removeChild(overDiv);
}

const editAddOverDiv = () => {
	let overDiv = document.createElement('div');
	overDiv.className = "CS_overDiv editQuickMenu";
	getShadowRoot().appendChild(overDiv);
	overDiv.addEventListener('click', e => sendMessage({action: "editQuickMenu", on:false}));
}

const editOff = el => {
	removeResizeWidget();
	editRemoveOverDiv();
	el.classList.remove('CS_editing');
	el.contentWindow.postMessage({action: "editEnd"}, browser.runtime.getURL('/quickmenu.html'));
}

const editOn = el => {
	installResizeWidget();
	editAddOverDiv();
	el.classList.add('CS_editing');
	document.addEventListener('closequickmenu', editRemoveOverDiv, {once: true});
}

function StatusBar() {

	this.createStatusButton = createStatusButton;

	function createStatusBar() {
		if ( window != top ) return;
		let div = document.createElement('div');
		div.id = 'CS_statusBar';
		getShadowRoot().appendChild(div);
		let b = createStatusButton(browser.runtime.getURL("/icons/logo_notext.svg"));
		b.title = browser.runtime.getManifest().name;
	}

	function createStatusButton(icon, callback) {
		let div = document.createElement('div');
		div.className = 'CS_statusButton';

		let img = new Image();
		img.src = icon;
		div.appendChild(img);
		img.onclick = callback;

		let sb = getShadowRoot().querySelector('#CS_statusBar');
		sb.appendChild(div);

		return div;
	}

	this.init = () => {

		if ( window == top && userOptions.showStatusBar ) {
			createStatusBar();
		//	&& checkToolStatus("repeatsearch")
			// createStatusButton(browser.runtime.getURL("/icons/repeatsearch.svg"), () => {
			// 	alert('yep');
			// });
			const setStatus = (el, on) => {
				el.title = `${i18n("quickmenu")} ${(on ? "on" : "off")}`;
				el.classList.toggle("on", on);
			}
			let div = createStatusButton(browser.runtime.getURL("/icons/qm.svg"), () => {
				QMtools.find(t => t.name === "disable").action();
				setStatus(div, !quickMenuObject.disabled);
			});

			setStatus(div, !quickMenuObject.disabled);
		}
	}
}

// prevents huge icons
setTimeout(() => new StatusBar().init(), 1000);

if ( window == top && typeof addParentDockingListeners === 'function')
	addParentDockingListeners('CS_quickMenuIframe', 'quickMenu');

// (() => {
// 	document.addEventListener('keydown', e => {
// 		if ( e.key === 'x' ) {

// 			let folder = {
// 				type:"folder",
// 				children: findNodes(userOptions.nodeTree, n => n.contexts && hasContext("link", n.contexts)),
// 				id:gen()
// 			}

// 			makeQuickMenuContainer({
// 				coords: {x:0,y:0}, 
// 				node:folder,
// 				layout: "!menuBar,!searchBarContainer,!titleBar,quickMenuElement,!toolBar,!contextsBar",
// 				columns:1
// 			});
// 		}
// 	});
// });
