var userOptions;
var focusSearchBar = true;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	
	if ( message.userOptions ) userOptions = message.userOptions;

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			case "updateQuickMenuObject":
				quickMenuObject = message.quickMenuObject;
				
				// quickMenuObject can update before userOptions. Grab the lastUsed
				userOptions.lastUsedId = quickMenuObject.lastUsed || userOptions.lastUsedId;
				
				// send event to OpenAsLink tile to enable/disable
				document.dispatchEvent(new CustomEvent('updatesearchterms'));
				break;
		}
	}
});

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then( async uo => {
	userOptions = uo;
	
	makeSearchBar();
	makeAddEngineBar();

	let singleColumn = window == top ? userOptions.searchBarUseOldStyle : userOptions.sideBar.singleColumn;

	await setTheme();
	await setUserStyles();
	await makeQuickMenu({type: window == top ? "searchbar" : "sidebar", singleColumn: singleColumn})
		.then( qme => {
			document.body.appendChild(qme);
			
			if ( userOptions.quickMenuToolsPosition === 'bottom' && userOptions.quickMenuToolsAsToolbar )	
				document.body.appendChild(toolBar);
		});

	document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

	let sideBarOpenedOnSearchResults = await browser.runtime.sendMessage({action: 'sideBarOpenedOnSearchResults'});
	if ( sideBarOpenedOnSearchResults ) focusSearchBar = false;

});

document.addEventListener('quickMenuIframeLoaded', () => {

	// combined with inline body style prevents glitching when opening menu
	document.body.style.display = 'block';
		
	// focus the searchbar on open
	if ( focusSearchBar ) sb.focus();

	// trigger resize for sidebar. Resize triggers on load in the browser_action
	resizeMenu();
	
	// replace text with selection
	(async () => {
		let results = await browser.runtime.sendMessage({action: "getSelectedText"});
		let text = results ? results.shift() : null;
	
		if ( text ) sb.value = text;

		if ( focusSearchBar ) sb.select();
	})();

});

function toolsHandler() {
	
	if ( !qm ) return;
	
	if ( ! userOptions.quickMenuToolsAsToolbar && qm.rootNode.parent ) return; // has parent = subfolder
	
	qm.toolsArray.forEach( tool => tool.classList.remove('singleColumn'));
	
	let position = userOptions.quickMenuToolsPosition;
	
	// set tools position
	if ( userOptions.quickMenuToolsAsToolbar && position !== 'hidden' )
		createToolsBar(qm);
	
	if ( !userOptions.quickMenuToolsAsToolbar ) {
		if ( position === "top")
			qm.toolsArray.forEach( (tool, index) => qm.insertBefore(tool, qm.children.item(index)));
		else if ( position === "bottom" )
			qm.toolsArray.forEach( (tool, index) => qm.appendChild( tool ));
	}

	qm.toolsArray.forEach( tool => {
		if ( qm.singleColumn && !userOptions.quickMenuToolsAsToolbar ) tool.classList.add('singleColumn');
	});

//	qm.insertBreaks();
}

function toolBarResize(options) {

	options = options || {}

	if ( window != top ) return;

	let setFlexWidth = () => {
		document.documentElement.style.setProperty('--iframe-body-width', qm.getBoundingClientRect().width + "px");
	}

	let resizeHeightOnly = options.suggestionsResize || options.more || options.groupLess;

	let minWidth = 200;
	let maxHeight = 600;
	let maxWidth = 800;

	if ( !window.firstRun ) document.documentElement.style.visibility = 'hidden';
	window.firstRun = true;

	let tileSize = qm.getTileSize();

	qm.style.minWidth = 'initial';
	qm.style.height = null;
	qm.style.overflowY = 'scroll';

	// ignore width resizing if only opening suggestions ( prevents flashing )
	if ( !resizeHeightOnly ) {
		qm.style.width = null;
		qm.style.overflowX = null;
		setFlexWidth();
	}
	
	// set min width for singleColumn
	if ( qm.singleColumn ) minWidth = tileSize.width;

	// minimum toolbar width for Chrome ( Firefox min = 200 )
	document.body.style.minWidth = minWidth + "px";

	runAtTransitionEnd(document.documentElement, ["width", "height"], () => {

		let minWindowWidth = Math.max(minWidth, window.innerWidth);

		if ( !resizeHeightOnly && !qm.singleColumn && qm.scrollWidth <= window.innerWidth && qm.columns * tileSize.width <= document.documentElement.scrollWidth ) {

			qm.style.width = Math.max( minWindowWidth, Math.min(maxWidth, document.documentElement.scrollWidth ) ) + "px";

			// pad for scrollbars
			qm.style.paddingRight = qm.offsetWidth - qm.clientWidth + "px";

			let padding = tileSize.width - tileSize.rectWidth;

			let div_width = 'calc(' + 100 / qm.columns + "% - " + padding + "px)";

			qm.querySelectorAll('DIV.tile:not(.singleColumn)').forEach( div => {
				div.style.transition = 'none';
				div.style.width = div_width;
				div.offsetWidth;
				div.style.transition = null;
			});

		} else if ( qm.scrollWidth <= window.innerWidth ) {
		} else {
			qm.style.overflowX = 'scroll';
			qm.style.width = '100%';
		}

		setFlexWidth();

		if ( window.innerHeight < document.documentElement.scrollHeight ) {

			let sumHeight = getAllOtherHeights();
			qm.style.height = sumHeight + qm.scrollHeight > maxHeight ? maxHeight - sumHeight + "px": null;
		} 

		document.dispatchEvent(new CustomEvent('resizeDone'));

		document.documentElement.style.visibility = null;				
	}, 50);
}

var docked = false;

function minifySideBar() {
	document.body.classList.toggle('mini');
	setTimeout(sideBarResize, 500);
}
function unminifySideBar() {
	document.body.classList.remove('mini');
	sideBarResize();
}

async function sideBarResize(options) {
	
	options = options || {};

	if ( window == top ) return;

	qm.insertBreaks();

	// simple resize when mini
	if ( document.body.classList.contains('mini') ) {
		return window.parent.postMessage({
			action:"resizeSideBarIframe", 
			size: {width: sbc.getBoundingClientRect().width, height: sbc.getBoundingClientRect().height + mb.getBoundingClientRect().height}, 
			singleColumn: qm.singleColumn,
			tileSize: qm.getTileSize()
		}, "*");
	}
	
	// throwing sidebar errors
	if ( !qm ) return;

	let qm_height = qm.style.height;

	let iframeHeight = options.iframeHeight || ( !docked ? userOptions.sideBar.height : 9999 );
	
	document.body.style.height = docked ? "100vh" : document.body.style.height;
	
	//document.body.style.height = 9999 + "px";
	document.body.style.width = 9999 + "px";

	qm.style.width = null;
	qm.style.height = null;

	document.documentElement.style.setProperty('--iframe-body-width', qm.getBoundingClientRect().width + "px");	

	let allOtherElsHeight = getAllOtherHeights();

	qm.style.height = function() {
		
		if ( docked ) return `calc(100% - ${allOtherElsHeight}px)`;

		if ( options.suggestionsResize ) return qm_height;
				
		// if ( options.more ) return qm.getBoundingClientRect().height + "px";
		
		return Math.min(iframeHeight - allOtherElsHeight, qm.getBoundingClientRect().height) + "px";
	}();

	qm.style.width = qm.getBoundingClientRect().width + "px";

	document.body.style.width = null;

	document.documentElement.style.setProperty('--iframe-body-width', document.body.offsetWidth + "px");

	qm.removeBreaks();

	// account for scrollbars
	let scrollbarWidth = qm.offsetWidth - qm.clientWidth + 1; // account for fractions
	qm.style.width = qm.getBoundingClientRect().width + scrollbarWidth + "px";

	toolBar.style.width = qm.style.width;

	window.parent.postMessage({
		action:"resizeSideBarIframe", 
		size: {width: qm.getBoundingClientRect().width, height: document.body.offsetHeight}, 
		singleColumn: qm.singleColumn,
		tileSize: qm.getTileSize()
	}, "*");
}

function resizeMenu(o) {
	
	if (!qm) return;
	// store scroll position
	let scrollTop = qm.scrollTop;
	let sgScrollTop = sg.scrollTop;
	
	qm.setDisplay();
	qm.insertBreaks();

	document.addEventListener('resizeDone', e => {
		qm.scrollTop = scrollTop;
		sg.scrollTop = sgScrollTop;
	});

	toolBarResize(o);
	sideBarResize(o);
	
	qm.scrollTop = scrollTop;
	sg.scrollTop = sgScrollTop;
}

function closeMenuRequest() {
	if ( window == top ) {
		if ( userOptions.searchBarCloseAfterSearch ) window.close();
	} else if ( userOptions.sideBar.closeAfterSearch ) {
		window.parent.postMessage({action: "closeSideBarRequest"}, "*");
	}
}

async function makeAddEngineBar() {

	let oses = await browser.runtime.sendMessage({action: "getOpenSearchLinks"});

	if ( !oses ) return;

	console.log("oses", oses);

	oses.forEach( async ose => {

		let div = document.createElement('div');
		let img = new Image();
		img.src = browser.runtime.getURL('icons/add.svg');
		div.innerText = " ";
		div.insertBefore(img, div.firstChild);
		div.title = browser.i18n.getMessage("AddCustomSearch");
		aeb.appendChild(div);

		let xml_se = await browser.runtime.sendMessage({action: "openSearchUrlToSearchEngine", url: ose.href}).then( details => {
			return (!details) ? null : details.searchEngines[0];
		});

		if ( !xml_se || userOptions.searchEngines.find( _se => _se.title === xml_se.title) ) {
			div.parentNode.removeChild(div);
			return;
		} 

		div.innerText = xml_se.title;
		div.insertBefore(img, div.firstChild);

		div.onclick = async() => {

			browser.runtime.sendMessage({action: "openCustomSearch", se: xml_se});
			return;

			// img.src = browser.runtime.getURL('icons/spinner.svg');
			// let loadImages = await browser.runtime.sendMessage({action: "openSearchUrlToSearchEngine", url:ose.href});
			// let se = loadImages.searchEngines[0];

			// if ( !se ) return;

			// let node = await browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine:se});
			// userOptions = await browser.runtime.sendMessage({action: "getUserOptions"});
			
			// div.addEventListener('transitionend', async e => {
			// 	div.parentNode.removeChild(div);

			// 	let tile = nodeToTile(node);

			// 	let firstTile = qm.querySelector('DIV.tile');
			// 	tile.className = firstTile.className;
			// 	tile.style.width = firstTile.style.width;
			// 	qm.appendChild(tile);
			// 	tile.scrollIntoView({block: "start", behavior:"smooth"});
			// });
			// img.src = browser.runtime.getURL('icons/checkmark.svg');
			// div.style.opacity = 0;

		}
		
		
	});

	document.body.appendChild(aeb);

	// place at the end again after qm loads
	document.addEventListener('quickMenuIframeLoaded', e => document.body.appendChild(aeb), {once: true})
}

window.addEventListener('message', e => {

	switch (e.data.action) {
		case "sideBarResize":
			if ( e.data.docked !== undefined ) docked = e.data.docked;
			resizeMenu({iframeHeight: e.data.iframeHeight});
			break;
		
		case "quickMenuIframeLoaded":
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			break;
			
		case "sideBarRebuild":
			qm.columns = e.data.columns;

			toolsHandler();
			
			qm.style.height = null;
			qm.style.width = null;

			// reset the minWidth for the tilemenu
			qm.setMinWidth();
			
			let rect = document.body.getBoundingClientRect();
			let rect_qm = qm.getBoundingClientRect();

			// send size to parent window for sidebar widget
			window.parent.postMessage({
				action:"resizeSideBarIframe", 
				size: {width: rect_qm.width, height: rect.height}, 
				tileSize: qm.getTileSize(), 
				singleColumn: qm.singleColumn
			}, "*");
			
			break;

		case "minifySideBar":
			minifySideBar();
			break;
	}
});

document.getElementById('closeButton').addEventListener('click', e => {

	if ( window != top )
		window.parent.postMessage({action: "closeSideBar"}, "*");
	else
		window.close();
});

addChildDockingListeners(mb, "sideBar");

if ( window == top ) {
	document.getElementById('minimizeButton').style.display = "none";
}

document.getElementById('minimizeButton').addEventListener('click', e => {
	window.parent.postMessage({action: "minimizeSideBarRequest"}, "*");
});

document.addEventListener('keydown', e => {
	if ( e.key === 'Escape' ) {
		if ( window != top)
			window.parent.postMessage({action: "minimizeSideBarRequest"}, "*");
	}
});
