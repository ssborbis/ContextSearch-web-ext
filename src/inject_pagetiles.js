let startCoords;
let searchTerms;

function openPageTiles(message) {

	// chrome requires delay or the drag event is cancelled
	setTimeout(() => {

		let iframe = document.createElement('iframe');
		iframe.id = "CS_pageTilesIframe";
		iframe.setAttribute("allowtransparency", "true");
		getShadowRoot().appendChild(iframe);

		// add listener after iframe is loaded to avoid closing on chrome
		// chrome fires dragend when over iframe
		iframe.onload = () => {
			iframe.contentWindow.postMessage({init:true, nodes: message.nodes, searchTerms: message.searchTerms}, browser.runtime.getURL('/pagetiles.html'));
		//	document.addEventListener('dragend', closePageTiles, {once: true});
			document.body.classList.add('CS_blur');
		}

		iframe.src = browser.runtime.getURL('/pagetiles.html');

		if ( window.chrome && !message.hotkey ) {
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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.action && message.action === "closePageTiles")
		closePageTiles();

	if ( message.action && message.action === "openPageTiles" ) {
		if ( getPageTilesIframe() ) closePageTiles();
		else openPageTiles(message);
	}
});

document.addEventListener('dragstart', e => {

	if ( !userOptions.pageTiles.enabled ) return;

	if ( !e.isTrusted ) return;

	let dropped = false;

	let dragOverHandler = e => {

		if ( !e.isTrusted ) return;

		if ( Math.abs(startCoords.x - e.clientX) < userOptions.pageTiles.deadzone && Math.abs(startCoords.y - e.clientY) < userOptions.pageTiles.deadzone ) return;

		browser.runtime.sendMessage({action: "openPageTiles", searchTerms: searchTerms});

		document.removeEventListener('dragover', dragOverHandler);
	}

	startCoords = {x: e.clientX, y: e.clientY};
	searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e) || "";

	document.addEventListener('dragover', dragOverHandler);
	document.addEventListener('dragend', e => document.removeEventListener('dragover', dragOverHandler));
	
	// close if drop is offscreen
	document.addEventListener('drop', e => dropped = true);
	document.addEventListener('dragend', e => {
		if ( !dropped ) closePageTiles();
	});
});

document.addEventListener('keydown', e => {
	if ( e.key == "Escape" ) closePageTiles();

	// else if ( e.key === 'ArrowLeft' && !getPageTilesIframe()) 
	// 	openPageTiles(findNode(userOptions.nodeTree, n => n.title === 'Tracking').children)
});


let getPageTilesIframe = () => getShadowRoot().getElementById('CS_pageTilesIframe');
let getOverDiv = () => getShadowRoot().getElementById('CS_pageTilesOverDiv');

let closePageTiles = e => {

	let iframe = getPageTilesIframe();
	if ( iframe ) iframe.parentNode.removeChild(iframe);

	let overDiv = getOverDiv();
	if ( overDiv ) overDiv.parentNode.removeChild(overDiv);

	document.body.classList.remove('CS_blur');

	document.dispatchEvent(new CustomEvent('closePageTiles'));
}

// when pageTiles does not cover entire page
document.addEventListener('click', closePageTiles);

