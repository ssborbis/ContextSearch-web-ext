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

var userOptions = {};

function makeFrameContents(options) {
	
	options 			= options || {};	
	options.mode 		= options.mode || "normal";
	options.resizeOnly 	= options.resizeOnly || false;

	makeQuickMenu({type: "quickmenu", mode: options.mode, singleColumn: userOptions.quickMenuUseOldStyle}).then( (qme) => {
		
		let old_qme = document.getElementById('quickMenuElement');
		
		if (old_qme) document.body.removeChild(old_qme);
	
		document.body.appendChild(qme);
		
		qm = qme;

		let sbc = document.getElementById('searchBarContainer');
		let tb = document.getElementById('toolBar');

		if ( userOptions.quickMenuToolsPosition === 'bottom' && userOptions.quickMenuToolsAsToolbar )	
			document.body.appendChild(tb);
		
		if (userOptions.quickMenuSearchBar === 'bottom') 
			document.body.appendChild(sbc);
		
		if ( options.mode === "resize" ) {
			// qm.style.minWidth = null;
			qm.style.overflowY = null;
			qm.style.height = null;
			qm.style.width = null;
		}
		
		makeSearchBar();
		
		if ( userOptions.quickMenuSearchBar === 'hidden') {
			sbc.style.display = 'none';
			sbc.style.height = '0';
		}

		document.getElementById('closeButton').addEventListener('click', e => {
			browser.runtime.sendMessage({action: "closeQuickMenuRequest"});
		});

		browser.runtime.sendMessage({
			action: "quickMenuIframeLoaded", 
			size: {
				width: qm.getBoundingClientRect().width,
				height: document.body.getBoundingClientRect().height
			},
			resizeOnly: options.resizeOnly,
			tileSize: qm.getTileSize(),
			tileCount: qm.querySelectorAll('.tile:not([data-hidden])').length,
			columns: qm.columns,
			singleColumn: qm.singleColumn
		}).then(() => {
			
			// setTimeout needed to trigger after updatesearchterms
			setTimeout(() => {				
				if (userOptions.quickMenuSearchBarSelect)
					sb.addEventListener('focus', () => sb.select(), {once:true});

				if (userOptions.quickMenuSearchBarFocus)
					sb.focus();
				
				if (userOptions.quickMenuSearchHotkeys && userOptions.quickMenuSearchHotkeys !== 'noAction') {
					sb.blur();
					qm.focus();
				}
			}, 100);
			
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
		});
	});	
}

var maxHeight = Number.MAX_SAFE_INTEGER;

function resizeMenu(o) {
	
	qm.setDisplay();
	
	o = o || {};
	
	let scrollTop = qm.scrollTop;
	let sgScrollTop = sg.scrollTop;
	
	let tileSize = qm.getTileSize();

	window.addEventListener('message', function resizeDoneListener(e) {
		if ( e.data.action && e.data.action === "resizeDone" ) {
			qm.scrollTop = scrollTop;
			sg.scrollTop = sgScrollTop;
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			window.removeEventListener('message', resizeDoneListener);
			document.dispatchEvent(new CustomEvent('resizeDone'));
		}
	});

	tb = document.getElementById('titleBar');
	toolBar = document.getElementById('toolBar');

	let initialHeight = tileSize.height * ((qm.singleColumn) ? userOptions.quickMenuRowsSingleColumn : userOptions.quickMenuRows);
	maxHeight = o.maxHeight || maxHeight || Number.MAX_SAFE_INTEGER;

	let allOtherElsHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height + toolBar.getBoundingClientRect().height;

	let currentHeight = qm.style.height || 0;

	qm.style.height = null;
	qm.style.overflowY = null;
	qm.style.width = null;
	sg.style.width = null;

	if ( o.lockResize )
		qm.style.height = currentHeight;
	else if ( o.suggestionsResize ) 
		qm.style.height = qm.getBoundingClientRect().height + "px";
	else if ( o.openFolder || o.toggleSingleColumn ) 
	//	qm.style.height = Math.min( qm.getBoundingClientRect().height, initialHeight ) + "px";
		qm.style.height = Math.min( qm.getBoundingClientRect().height, maxHeight - allOtherElsHeight ) + "px"; // site search flex
	else if ( o.quickMenuMore || o.groupMore ) 
		qm.style.height = qm.getBoundingClientRect().height + "px";	
	else if ( o.widgetResize )
		qm.style.height = tileSize.height * o.rows + "px";
	else
		qm.style.height = Math.max( tileSize.height, Math.min(qm.getBoundingClientRect().height, (window.innerHeight || maxHeight) - allOtherElsHeight) ) + "px";
	
	if ( qm.getBoundingClientRect().height > maxHeight - allOtherElsHeight )
		qm.style.height = Math.floor(maxHeight - allOtherElsHeight) + "px";
	
	qm.style.width = qm.scrollWidth + qm.offsetWidth - qm.clientWidth + "px";
	
	qm.scrollTop = scrollTop;
	sg.scrollTop = sgScrollTop;
	
	// console.log(o, window.innerHeight, qm.style.height, initialHeight, currentHeight, allOtherElsHeight, maxHeight, tileSize, qm.getBoundingClientRect().height, qm.scrollHeight, {
			// width:  qm.getBoundingClientRect().width, 
			// height: document.body.getBoundingClientRect().height
		// });
	
	window.parent.postMessage({
		action: "quickMenuResize",
		size: {
			width:  qm.getBoundingClientRect().width, 
			height: document.body.getBoundingClientRect().height
		},
		singleColumn: qm.singleColumn,
		tileSize: tileSize,
		tileCount: qm.querySelectorAll('.tile:not([data-hidden="true"])').length,
		columns: qm.columns
	}, "*");
	
}

function closeMenuRequest() {
	if ( userOptions.quickMenuCloseOnClick && !quickMenuObject.locked )
		browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_quickmenutile"});
}

function toolsHandler(qm) {
	
	qm = qm || document.getElementById('quickMenuElement');
	toolBar = document.getElementById('toolBar');
	
	let getVisibleTiles = () => { 
		return [...qm.querySelectorAll('.tile:not([data-hidden="true"])')].filter( tile => tile.style.display !== 'none' );
	}
	
	let moreTileID = userOptions.nodeTree.id;
	
	if ( ! userOptions.quickMenuToolsAsToolbar && qm.rootNode.parent ) return; // has parent = subfolder
	
	let position = userOptions.quickMenuToolsPosition;

	let moreTile = qm.querySelector(`[data-parentid="${moreTileID}"]`);
	
	if ( moreTile ) qm.removeChild( moreTile );
	
//	qm.toolsArray.forEach( tool => tool.classList.remove('singleColumn'));
	
	if ( userOptions.quickMenuToolsAsToolbar && position !== 'hidden' )
		createToolsBar(qm);
	
	if ( !userOptions.quickMenuToolsAsToolbar ) {
		if ( qm.singleColumn ) qm.toolsArray.forEach( tool => tool.classList.add('singleColumn') );
	}

	// unhide tiles hidden by more tile
	qm.querySelectorAll('.tile[data-grouphidden]').forEach( tile => {
		if ( tile.moreTile && tile.moreTile.dataset.parentid === moreTileID ) {
			delete tile.dataset.hidden;
			tile.style.display = null;
			delete tile.dataset.grouphidden;
		}
	});

	// place tools at the beginning before hiding tiles > limit
	if ( !userOptions.quickMenuToolsAsToolbar ) {
		qm.toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
	}

	let visibleTileCountMax = qm.singleColumn ? userOptions.quickMenuRowsSingleColumn : userOptions.quickMenuRows * userOptions.quickMenuColumns;
	
	// hide tools
	if ( !userOptions.quickMenuToolsAsToolbar && position === 'hidden' )
		qm.toolsArray.forEach( _div => qm.removeChild(_div) );

	// more tile
	if ( getVisibleTiles().length > visibleTileCountMax && !qm.rootNode.parent ) {

		let tileArray = qm.querySelectorAll('.tile');
		tileArray = qm.makeMoreLessFromTiles([...tileArray], visibleTileCountMax);
		
		// remove separator bookends
		tileArray.pop();
		tileArray.shift();
		
		// remove group label for root
		if ( tileArray[0].className === "groupFolder" )
			tileArray.shift();

		// replace qm
		qm.innerHTML = null;
		tileArray.forEach( tile => qm.appendChild( tile ) );

		// qm moreTile is special case
		moreTile = qm.querySelector(`[data-parentid="${moreTileID}"]`);
		
		if ( moreTile ) {
			moreTile.classList.add('tile');
			moreTile.dataset.quickmenumore = true;
		}

		let visibleTiles = getVisibleTiles().filter( tile => ! ( tile.dataset.parentid && tile.dataset.parentid === moreTileID ) );
		
		for ( let i=visibleTileCountMax;i<visibleTiles.length;i++) {
			let _div = visibleTiles[i];
			_div.dataset.hidden = "true";
			_div.style.display = "none";
			_div.dataset.grouphidden = "true";
			_div.moreTile = moreTile;
		}
		
		if ( !userOptions.quickMenuToolsAsToolbar) {
			if ( userOptions.quickMenuToolsPosition === 'bottom' )
				qm.toolsArray.forEach(tool => qm.appendChild(tool));
			else if ( userOptions.quickMenuToolsPosition === 'top' )
				qm.toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
		}
		
		// move moreTile to end
		if ( moreTile) qm.appendChild(moreTile);
	}
	
	qm.insertBreaks();
}

if ( userOptions.quickMenuTheme === 'dark' ) {
	let d = document.querySelector('#dark');
	d.rel="stylesheet";
}
	
document.addEventListener("DOMContentLoaded", async () => {

	let msg = await browser.runtime.sendMessage({action: "getUserOptions"});
	
	userOptions = msg.userOptions;

	if ( userOptions.quickMenuTheme === 'dark' ) {
		await new Promise(r => {	
			let url = browser.runtime.getURL('/dark.css');
			var link = document.createElement('link');
			link.type = 'text/css';
			link.rel = 'stylesheet';
			link.href = url;

			link.onload = r;
			
			document.head.appendChild(link);
		});

	}  
	
	if ( userOptions.userStylesEnabled ) {
		// Append <style> element to <head>
		var styleEl = document.createElement('style');
		document.head.appendChild(styleEl);
		styleEl.innerText = userOptions.userStyles;
	}
		
	makeFrameContents();

});

// prevent context menu when using right-hold
function preventContextMenu(e) { if ( e.which === 3 ) e.preventDefault(); }		
document.addEventListener('contextmenu', preventContextMenu);
document.addEventListener('mousedown', function rightMouseDownHandler(e) {
	if ( e.which !== 3 ) return;
	document.removeEventListener('contextmenu', preventContextMenu);
	document.removeEventListener('mousedown', rightMouseDownHandler);
});

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
				
			case "focusSearchBar":
				if (userOptions.quickMenuSearchBarSelect) {
					sb.addEventListener('focus', () => { 
						setTimeout(() => sb.select(), 100);
					}, {once:true});
				}

				sb.focus();

				break;
		}
	}
});

// listen for messages from parent window
window.addEventListener('message', e => {

	switch (e.data.action) {
		case "rebuildQuickMenu":
			userOptions = e.data.userOptions;	
			// qm.columns = qm.singleColumn ? 1 : userOptions.quickMenuColumns;
			
			qm.columns = qm.singleColumn ? 1 : e.data.columns;
			
			toolsHandler();
			// qm.insertBreaks(qm.columns);

			qm.setMinWidth();
			
			resizeMenu({widgetResize: true, rows: e.data.rows});
			
			break;
			
		case "resizeMenu":
			resizeMenu(e.data.options);
			break;
			
		case "lock":
			document.body.classList.add('locked');
			resizeMenu({lockResize: true});
			quickMenuObject.locked = true;
			break;
			
		case "unlock":
			document.body.classList.remove('locked');
			resizeMenu({lockResize: true});
			quickMenuObject.locked = false;
			break;
			
	}
});

mb.addEventListener('dblclick', e => {
		e.preventDefault();
		e.stopImmediatePropagation();
});

mb.addEventListener('mousedown', e => {
	if ( e.which !== 1 ) return;

	mb.moving = true;
	window.parent.postMessage({action: "handle_dragstart", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mouseup', e => {
	if ( e.which !== 1 ) return;

	mb.moving = false;
	window.parent.postMessage({action: "handle_dragend", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mousemove', e => {
	if ( e.which !== 1 ) return;
	
	if ( !mb.moving ) return;
	window.parent.postMessage({action: "handle_dragmove", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

mb.addEventListener('dblclick', e => {
	if ( e.which !== 1 ) return;

	window.parent.postMessage({action: "handle_dock", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});
