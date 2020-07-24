var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then( message => {
	userOptions = message.userOptions || {};
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {	
	if ( message.userOptions ) userOptions = message.userOptions;
});

function getSelectedText(el) {
	
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString();

}

function isTextBox(element) {	
	return ( element.type === 'text' || element.type === 'textarea' || element.isContentEditable );
}

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", ev => {
	if ( quickMenuObject ) quickMenuObject.lastSelectTime = Date.now();
	
	let searchTerms = window.getSelection().toString();
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea, [contenteditable='true']")) {
	el.addEventListener('mouseup', e => {
		let searchTerms = getSelectedText(e.target)
		if (searchTerms) {
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
			browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
		}
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', e => {

	if ( e.which !== 3 ) return false;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e) || "";
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

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
	
	// let originalTransition = element.style.transition || null;
	// let originalDisplay = element.style.display || null;
	// element.style.transition = 'none';

//	element.style.display = 'none';

	element.style.maxHeight = element.style.maxWidth = 0;

	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	element.style.maxHeight = element.style.maxWidth = null;
	
	// element.style.display = originalDisplay;
	
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
	
	// if (rect.y + rect.height > window.innerHeight) 
		// element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	// if (rect.left < 0) 
		// element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	// if (rect.x + rect.width > window.innerWidth) 
		// element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

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

function showNotification(msg) {
	let CS_notification = document.createElement('div');
	CS_notification.className = 'CS_notification';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/alert.svg');
	
	
	let content = document.createElement('div');
	content.className = 'content';
	content.innerText = msg;
	
	[img, content].forEach(el => CS_notification.appendChild(el));

	CS_notification.style.opacity = 0;
	document.body.appendChild(CS_notification);
	CS_notification.getBoundingClientRect();
	CS_notification.style.opacity = 1;
	CS_notification.getBoundingClientRect();
	setTimeout(() => {
		runAtTransitionEnd(CS_notification, ['opacity'], () => {
			document.body.removeChild(CS_notification);
			delete CS_notification;
		});
		
		CS_notification.style.opacity = 0;
	}, 3000);
	
	CS_notification.onclick = function() {
		document.body.removeChild(CS_notification);
		delete CS_notification;
	}
}

// set zoom attribute to be used for scaling objects
document.documentElement.style.setProperty('--cs-zoom', window.devicePixelRatio);

document.addEventListener('zoom', e => {
	document.documentElement.style.setProperty('--cs-zoom', window.devicePixelRatio);
});

// apply global user styles for /^[\.|#]CS_/ matches in userStyles
browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	let userOptions = result.userOptions;

	if ( userOptions.userStylesEnabled && userOptions.userStylesGlobal ) {
		
		let styleEl = document.createElement('style');
		
		styleEl.innerText = userOptions.userStylesGlobal;

		document.head.appendChild(styleEl);
	}
});

// menuless hotkey
document.addEventListener('keydown', e => {

	if ( 
		!userOptions.allowHotkeysWithoutMenu ||
		isTextBox(e.target) ||
		e.shiftKey || e.ctrlKey || e.altKey || e.metaKey ||
		!getSelectedText(e.target)
	) return false;

	let node = findNode( userOptions.nodeTree, n => n.hotkey === e.keyCode );

	if ( !node ) return false;
	
	let se = userOptions.searchEngines.find( _se => _se.id === node.id );
	
	if ( !se ) return false;
	
	browser.runtime.sendMessage({
		action: "quickMenuSearch", 
		info: {
			menuItemId: se.id,
			selectionText: getSelectedText(e.target),
			openMethod: userOptions.quickMenuSearchHotkeys
		}
	});
	
});

browser.runtime.sendMessage({action: "injectComplete"});