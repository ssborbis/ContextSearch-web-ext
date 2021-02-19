function openPageTiles(e) {

	let selectedText = getSelectedText(e.target);

	if (!selectedText) return false;

	if ( e.dataTransfer )
		e.dataTransfer.setData("text/plain", selectedText);

	browser.runtime.sendMessage({action: "setLastSearch", lastSearch: selectedText});

	// chrome requires delay or the drag event is cancelled
	setTimeout(() => {

		let iframe = document.createElement('iframe');
		iframe.id = "CS_pageTilesIframe";
		iframe.setAttribute("allowtransparency", "true");
		document.body.appendChild(iframe);

		// add listener after iframe is loaded to avoid closing on chrome
		// chrome fires dragend when over iframe
		iframe.onload = () => {
		//	document.addEventListener('dragend', closePageTiles, {once: true});
		}

		iframe.src = browser.runtime.getURL('/pagetiles.html');

		if ( window.chrome ) {
			let od = dragOverIframeDiv(iframe);
			od.id = "CS_pageTilesOverDiv";

			if ( userOptions.pageTiles.closeOnShake ) {
				let ds = new DragShake();
				ds.onshake = () => closePageTiles();
				ds.start();

				document.addEventListener('closePageTiles', e => ds.stop(), {once: true});
			}

		}
	}, 50);
}

document.addEventListener('dragstart', e => {

	if ( !userOptions.pageTiles.enabled ) return;

	openPageTiles(e);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.action && message.action === "closePageTiles")
		closePageTiles();

	if ( message.action && message.action === "openPageTiles" ) {
		if ( getPageTilesIframe() ) closePageTiles();
		else openPageTiles({});
	}
});

document.addEventListener('keydown', e => {
	if ( e.key == "Escape" ) closePageTiles();
});

let getPageTilesIframe = () => document.getElementById('CS_pageTilesIframe');
let getOverDiv = () => document.getElementById('CS_pageTilesOverDiv');

let closePageTiles = (e) => {

	let iframe = getPageTilesIframe();
	if ( iframe ) iframe.parentNode.removeChild(iframe);

	let overDiv = getOverDiv();
	if ( overDiv ) overDiv.parentNode.removeChild(overDiv);

	document.dispatchEvent(new CustomEvent('closePageTiles'));
}

