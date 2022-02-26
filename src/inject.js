// unique object to reference globally
var quickMenuObject = { 
	keyDownTimer: 0,
	mouseDownTimer: null,
	mouseCoords: {x:0, y:0},
	screenCoords: {x:0, y:0},
	mouseCoordsInit: {x:0, y:0},
	mouseLastClickTime: 0,
	lastSelectTime: 0,
	lastSelectText:"",
	locked: false,
	searchTerms: "",
	searchTermsObject:{},
	disabled: false,
	mouseDownTargetIsTextBox: false,
	mouseLastContextMenuTime:0,
	contexts: []
};

var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then( uo => userOptions = uo);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if ( message.userOptions ) userOptions = message.userOptions;

	switch (message.action) {
		case "updateSearchTerms":

			quickMenuObject.searchTerms = message.searchTerms;

			// track the last selection with value
			quickMenuObject.lastSelectText = message.searchTerms || quickMenuObject.lastSelectText

			// send event to OpenAsLink tile to enable/disable
			document.dispatchEvent(new CustomEvent('updatesearchterms'));

			browser.runtime.sendMessage({
				action: "updateQuickMenuObject", 
				quickMenuObject: quickMenuObject
			});
			break;

		case "showNotification":
			showNotification(message);
			break;
	}
});

function getRawSelectedText(el) {
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString().trim();

}

function getSelectedText(el) {
	return getRawSelectedText(el).trim();
}

function isTextBox(element) {
	return ( element.nodeType == 1 && 
		(
			element.nodeName == "TEXTAREA" ||
			(element.nodeName == "INPUT" && /^(?:text|email|number|search|tel|url|password)$/i.test(element.type)) ||
			element.isContentEditable
		)
	);
}

function copyRaw() {
	let rawText = getRawSelectedText(window.activeElement);

	if ( !rawText ) rawText = quickMenuObject.searchTerms;

	navigator.clipboard.writeText(rawText);
}

function getContexts(el) {

	if ( !el ) return [];

	let contexts = ['page'];

	if ( el instanceof HTMLImageElement || getImage(el) ) contexts.push('image');
	if ( el instanceof HTMLAudioElement ) contexts.push('audio');
	if ( el instanceof HTMLVideoElement ) contexts.push('video');
	if ( el.closest && el.closest('a')) contexts.push('link');
	if ( getSelectedText(el)) contexts.push('selection');
	if ( window != top ) contexts.push('iframe');

	return contexts;
}

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", ev => {

	let searchTerms = window.getSelection().toString().trim();

	// if an opener method timer is running, skip
	if ( quickMenuObject.mouseDownTimer && !searchTerms ) return;

	quickMenuObject.lastSelectTime = Date.now();
	if ( searchTerms ) quickMenuObject.lastSelectText = searchTerms;
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});

	// display icon to open qm
	if ( showIcon ) showIcon(searchTerms);
});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input, textarea, [contenteditable='true']")) {
	el.addEventListener('mouseup', e => {
		if ( !isTextBox(e.target) ) return false;
		
		let searchTerms = getSelectedText(e.target);
		if (searchTerms) {
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
			browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
		}

		// display icon to open qm
		if ( showIcon ) showIcon(searchTerms);
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', e => {

	if ( e.which !== 3 ) return false;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e) || "";

	if ( !searchTerms && userOptions.contextMenuUseInnerText ) {
		searchTerms = e.target.innerText.trim();
	}
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

function linkOrImage(el, e) {
	
	let link = getLink(el, e);
	let img = getImage(el, e);

	if ( img && userOptions.quickMenuOnImages ) return img;
	
	if ( link && userOptions.quickMenuOnLinks ) return link;

	if ( el instanceof HTMLAudioElement || el instanceof HTMLVideoElement ) {
		return el.currentSrc || el.src;
	}
	
	return false;	
}

// https://stackoverflow.com/a/1045012
function offset(elem) {
    if(!elem) elem = this;

    var x = elem.offsetLeft;
    var y = elem.offsetTop;

    while (elem = elem.offsetParent) {
        x += elem.offsetLeft;
        y += elem.offsetTop;
    }

    return { left: x, top: y };
}

function repositionOffscreenElement( element, padding ) {

	padding = padding || { top:0, bottom:0, left:0, right:0 };

	let fixed = window.getComputedStyle( element, null ).getPropertyValue('position') === 'fixed' ? true : false;
	
	let originalTransition = element.style.transition || null;
	// let originalDisplay = element.style.display || null;
	// element.style.transition = 'none';

//	element.style.display = 'none';

	element.style.maxHeight = element.style.maxWidth = 0;

	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	element.style.maxHeight = element.style.maxWidth = null;
	
	// element.style.display = originalDisplay;


	element.style.transition = 'all .15s';
	
	let rect = element.getBoundingClientRect();
	
	if ( ! fixed ) {
		
		let maxWidth = Math.min(window.innerWidth, document.body.getBoundingClientRect().right);
		let maxHeight = Math.min(window.innerHeight, document.body.getBoundingClientRect().bottom);
		
		if (rect.y < 0) 
			element.style.top = Math.max(parseFloat(element.style.top) - rect.y, 0) + padding.top + "px";
		
		if (rect.bottom > window.innerHeight) 
			element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight - padding.bottom + "px";
		
		if (rect.x < 0) 
			element.style.left = Math.max(parseFloat(element.style.left) - rect.x, 0) + padding.left + "px";
		
		if (rect.right > maxWidth ) 
			element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - maxWidth) - padding.right + "px";

		return;
	}
	
	if ( rect.bottom > window.innerHeight - scrollbarHeight ) {
		if ( element.style.bottom )
			element.style.bottom = "0";
		else 
			element.style.top = (window.innerHeight - scrollbarHeight - rect.height) + "px";
		
		// console.log('bottom overflow');
	}

	if (rect.top < 0) {
		if ( element.style.bottom ) 
			element.style.bottom = (window.innerHeight - rect.height) + "px";
		else
			element.style.top = "0";
		
		// console.log('top overflow');
	}
	
	if ( rect.right > window.innerWidth - scrollbarWidth ) {
		if ( element.style.right )
			element.style.right = "0";
		else 
			element.style.left = (window.innerWidth - scrollbarWidth - rect.width) + "px";
		
		// console.log('right overflow');
	}
	
	if ( rect.left < 0 ) {
		if ( element.style.right ) 
			element.style.right = (window.innerWidth - rect.width) + "px";
		else
			element.style.left = "0";
		
		// console.log('left overflow');
	}

	runAtTransitionEnd(element, ["top", "bottom", "left", "right"], () => {
		element.style.transition = originalTransition;
	})
	
	// if (rect.y + rect.height > window.innerHeight) 
		// element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	// if (rect.left < 0) 
		// element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	// if (rect.x + rect.width > window.innerWidth) 
		// element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

}

function getLinkText(el) {
	let a = el.closest('a');
	
	if ( !a ) return "";

	return a.innerText;
}

function getLink(el, e) {

	let a = el.closest('a');
	
	if ( !a ) return "";
	
	let method = userOptions.contextMenuSearchLinksAs;
	
	if ( e && e.ctrlKey ) method = method === 'url' ? 'text' : 'url';

	return method === 'url' ? a.href || a.innerText : a.innerText || a.href;
}

function getImage(el, e) {
	
	if ( el.innerText ) return false;
	
	if ( el.tagName === 'IMG' ) return el.src;
	
	let style = window.getComputedStyle(el, false);
	
	let backgroundImage = style.backgroundImage;

	if ( ! /^url\(/.test(backgroundImage) ) return false;

	return backgroundImage.slice(4, -1).replace(/"/g, "")
}

function showNotification(message) {

	let msg = message.msg;

	let id = "CS_notification" + btoa(msg).substr(0,8);

	let n = document.getElementById(id) || document.createElement('notification');
	n.id = id;
	n.className = 'CS_notification';
	n.innerHTML = null;
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/logo_notext.svg');
	
	let cb = new Image();
	cb.src = browser.runtime.getURL('icons/crossmark.svg');
	cb.style = 'cursor:pointer;height:16px;position:absolute;right:10px;top: 50%;transform: translate(0, -50%);margin:0';
	cb.onclick = close;
	
	let content = document.createElement('div');
	content.className = 'content';
	content.innerText = msg;
	
	[img, content, cb].forEach(el => n.appendChild(el));

	n.style.opacity = 0;
	document.body.appendChild(n);
	n.getBoundingClientRect();
	n.style.opacity = 1;
	n.getBoundingClientRect();

	close = () => {
		runAtTransitionEnd(n, ['opacity'], () => {
			document.body.removeChild(n);
			delete n;
		});
		
		n.style.opacity = 0;
	}

	if ( !message.sticky ) setTimeout(close, 3000);
	
	n.onclick = function() {
		document.body.removeChild(n);
		delete n;
	}

	return n;
}

function checkContextMenuEventOrderNotification() {
	let n = showNotification({msg:"", sticky:true});

	let yes = document.createElement('a');
	yes.innerText = browser.i18n.getMessage('yes');
	yes.href = "#";

	let no = document.createElement('a');
	no.innerText = browser.i18n.getMessage('no');
	no.href="#";

	let content = n.querySelector('.content');
	content.innerText = browser.i18n.getMessage('checkContextMenuOrderNotification');
	n.appendChild(yes);
	n.appendChild(document.createTextNode(" / "));
	n.appendChild(no);

	no.onclick = function() {
		userOptions.checkContextMenuEventOrder = false;
		browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	}

	yes.onclick = function() {
		userOptions.checkContextMenuEventOrder = false;
		userOptions.quickMenuMoveContextMenuMethod = "dblclick";
		browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	}

}

// set zoom attribute to be used for scaling objects
function setZoomProperty() {
	document.documentElement.style.setProperty('--cs-zoom', window.devicePixelRatio);
}

document.addEventListener('zoom', setZoomProperty);
setZoomProperty();

// apply global user styles for /^[\.|#]CS_/ matches in userStyles
browser.runtime.sendMessage({action: "addUserStyles", global: true });

// menuless hotkey
function checkForNodeHotkeys(e) {

	if ( 
		!userOptions.allowHotkeysWithoutMenu ||
		isTextBox(e.target) ||
		e.shiftKey || e.ctrlKey || e.altKey || e.metaKey
	) return false;

	let el = document.elementFromPoint(quickMenuObject.mouseCoords.x, quickMenuObject.mouseCoords.y);
	let img =  userOptions.allowHotkeysOnImages ? getImage(el) : null;
	let link = userOptions.allowHotkeysOnLinks ? getLink(el) : null;

	if ( el instanceof HTMLAudioElement || el instanceof HTMLVideoElement ) 
		link = el.currentSrc || el.src;

	let searchTerms = getSelectedText(e.target) || img || link || "";

	if ( !searchTerms ) return false;

	let node = findNode( userOptions.nodeTree, n => n.hotkey === e.keyCode );

	if ( !node ) return false;

	browser.runtime.sendMessage({
		action: "quickMenuSearch", 
		info: {
			menuItemId: node.id,
			selectionText: searchTerms,
			openMethod: userOptions.quickMenuSearchHotkeys
		}
	});
}

window.hasRun = true;

browser.runtime.sendMessage({action: "injectComplete"});
