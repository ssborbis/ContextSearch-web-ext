

function getSelectedText(el) {
	
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString();

}

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", (ev) => {
	if ( quickMenuObject ) quickMenuObject.lastSelectTime = Date.now();
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: window.getSelection().toString()});
});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea, [contenteditable='true']")) {
	el.addEventListener('mouseup', (e) => {
		let text = getSelectedText(e.target)
		if (text)
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: text});
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', (e) => {

	if ( e.which !== 3 ) return false;

	let searchTerms = getSelectedText(e.target) || getImage(e.target) || getLink(e.target);

	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

// Good for checking new engines after window.external.AddSearchProvider()
window.addEventListener('focus', (ev) => {
	
	setTimeout(() => {
		if (userOptions.reloadMethod !== 'automatic') return false;
		
		browser.runtime.sendMessage({action: "nativeAppRequest"});
	}, 500);
});

function runAtTransitionEnd(el, prop, callback) {
	let oldProp = null;
	let checkPropInterval = setInterval(() => {
		let newProp = window.getComputedStyle(el).getPropertyValue(prop);
		if ( newProp !== oldProp ) {
			oldProp = newProp;
			return;
		}
		callback();
		clearInterval(checkPropInterval);
	},25);
}

function getLink(el) {

	let a = el.closest('a');
	
	if ( !a ) return "";
		
	return userOptions.contextMenuSearchLinksAs === 'url' ? a.href || a.innerText : a.innerText || a.href;
}

function getImage(el) {
	
	if ( el.innerText ) return false;
	
	if ( el.tagName === 'IMG' ) return el.src;
	
	let style = window.getComputedStyle(el, false);
	
	let backgroundImage = style.backgroundImage;
	
	browser.runtime.sendMessage({action:"log", msg: backgroundImage});

	if ( ! /^url\(/.test(backgroundImage) ) return false;

	return backgroundImage.slice(4, -1).replace(/"/g, "")
}
