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
	if (window.getSelection().toString() !== '')
		browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: window.getSelection().toString()});
});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea")) {
	el.addEventListener('mouseup', (e) => {
		let text = getSelectedText(e.target)
		if (text)
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: text});
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', (e) => {

	if (
		e.which !== 3 ||
//		( userOptions !== undefined && !userOptions.contextMenu ) ||
//		( userOptions !== undefined && userOptions.searchEngines !== undefined && userOptions.searchEngines.length === 0 ) ||
		(getSelectedText(e.target) === '' && e.target.nodeName.toLowerCase() !== 'a')
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
