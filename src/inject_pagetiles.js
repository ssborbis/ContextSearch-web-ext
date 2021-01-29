document.addEventListener('dragstart', e => {

	if ( !userOptions.pageTiles.enabled ) return;
		
	let selectedText = getSelectedText(e.target);

	if (!selectedText) return false;
	
	e.dataTransfer.setData("text/plain", selectedText);
	browser.runtime.sendMessage({action: "setLastSearch", lastSearch: selectedText});

	let iframe = document.createElement('iframe');
	iframe.id = "CS_pageTilesIframe";
	iframe.setAttribute("allowtransparency", "true");
	document.body.appendChild(iframe);
	iframe.src = browser.runtime.getURL('/pagetiles.html');
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	
	if (message.action && message.action === "closePageTiles")
		closePageTiles();
});

document.addEventListener('keydown', e => {
	if ( e.key == "Escape" ) closePageTiles();
});

let getPageTilesIframe = () => document.getElementById('CS_pageTilesIframe');

let closePageTiles = () => {
	let iframe = getPageTilesIframe();
	if ( iframe ) iframe.parentNode.removeChild(iframe);
}

// let mouseTracker = [];
// let mouseLastCoords = null;
// document.addEventListener('mousemove', e => {
// 	mouseLastCoords = {x: e.clientX, y: e.clientY};
// });

// setInterval({
// 	mouseTracker.push(mouseLastCoords);
// 	if ( mouseTracker.length > 10 ) mouseTracker.shift();




// }, 50 )
