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

		document.getElementById('closeButton').addEventListener('click', (e) => {
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
			tileCount: qm.querySelectorAll('div:not([data-hidden])').length
		}).then(() => {
			
			// setTimeout needed to trigger after updatesearchterms
			setTimeout(() => {				
				if (userOptions.quickMenuSearchBarSelect) {
					sb.addEventListener('focus', ()=> {
						sb.select();
					},{once:true});
				}

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
	
	o = o || {};
	
	let scrollTop = qm.scrollTop;
	window.addEventListener('message', function resizeDoneListener(e) {
		if ( e.data.action && e.data.action === "resizeDone" ) {
			qm.scrollTop = scrollTop;
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			window.removeEventListener('message', resizeDoneListener);
		}
	});

	tb = document.getElementById('titleBar');
	toolBar = document.getElementById('toolBar');

	let initialHeight = qm.firstChild.offsetHeight * userOptions.quickMenuRows;
	maxHeight = o.maxHeight || maxHeight || Number.MAX_SAFE_INTEGER;

	let allOtherElsHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height + toolBar.getBoundingClientRect().height;

	let currentHeight = qm.style.height;

	qm.style.height = null;
	qm.style.overflowY = null;
	qm.style.width = null;
	sg.style.width = null;

	if ( o.lockResize )
		qm.style.height = currentHeight;
	else if ( o.suggestionsResize ) 
		qm.style.height = qm.getBoundingClientRect().height + "px";
	else if ( o.openFolder || o.toggleSingleColumn ) 
		qm.style.height = Math.min( qm.getBoundingClientRect().height, initialHeight ) + "px";
	else if ( o.quickMenuMore || o.groupMore )
		qm.style.height = qm.getBoundingClientRect().height + "px";	
	else if ( o.widgetResize )
		qm.style.height = qm.firstChild.getBoundingClientRect().height * o.rows + "px";
	else
		qm.style.height = Math.min(qm.getBoundingClientRect().height, window.innerHeight - allOtherElsHeight) + "px";
	
	if ( qm.getBoundingClientRect().height > maxHeight - allOtherElsHeight )
		qm.style.height = Math.floor(maxHeight - allOtherElsHeight) + "px";
	
	qm.style.width = qm.scrollWidth + qm.offsetWidth - qm.clientWidth + "px";
	
	// console.log(o.groupMore, qm.style.height, maxHeight, allOtherElsHeight, parseFloat(qm.style.height) + allOtherElsHeight, document.body.getBoundingClientRect().height);
	
	qm.scrollTop = scrollTop;
	
	window.parent.postMessage({
		action: "quickMenuResize",
		size: {
			width:  qm.getBoundingClientRect().width, 
			height: document.body.getBoundingClientRect().height
		},
		singleColumn: qm.singleColumn,
		tileSize: qm.getTileSize()
	}, "*");
}

function toolsHandler(qm) {
	
	qm = qm || document.getElementById('quickMenuElement');
	toolBar = document.getElementById('toolBar');
	
	if ( qm.rootNode.parent ) return; // has parent = child node
	
	let position = userOptions.quickMenuToolsPosition;

	// unhide tile hidden by more tile
	qm.querySelectorAll('[data-hidden="true"]:not([data-grouphidden])').forEach( tile => {
		tile.dataset.hidden = 'false';
		tile.style.display = null;
	});
	
	// remove more tile
	if ( qm.moreTile.parentNode ) qm.removeChild(qm.moreTile);

	// set the number of tiles to show
	let visibleTileCountMax = qm.singleColumn ? userOptions.quickMenuRows : userOptions.quickMenuRows * userOptions.quickMenuColumns;
	
	let toolsArray = qm.toolsArray;
	let tileArray = qm.querySelectorAll('.tile:not([data-type="tool"])');

	// set tools position
	if ( userOptions.quickMenuToolsAsToolbar && position !== 'hidden' ) {
		
		// move tools bar below qm
		if ( position === 'bottom' ) toolBar.parentNode.insertBefore(toolBar, qm.nextSibling);
		
		// clear the old tools bar
		toolBar.innerHTML = null;

		let ls = document.createElement('span');
		ls.innerHTML = "&#9668;";		
		ls.style.left = 0;
		toolBar.appendChild(ls);
		
		let rs = document.createElement('span');
		rs.innerHTML = "&#9658;";
		rs.style.right = 0;
		toolBar.appendChild(rs);
		
		let mouseoverInterval = null;
		rs.addEventListener('mouseenter', (e) => {
			mouseoverInterval = setInterval(() => {toolBar.scrollLeft += 10;}, 50);
		});
		
		ls.addEventListener('mouseenter', (e) => {	
			mouseoverInterval = setInterval(() => {toolBar.scrollLeft -= 10;}, 50);
		});
		
		[rs,ls].forEach(s => s.addEventListener('mouseleave', () => {clearInterval(mouseoverInterval)}));
		
		toolsArray.forEach( tool => {
			tool.className = 'tile';
			toolBar.appendChild(tool);
		});
		
		function showScrollButtons() {
			ls.style.display = toolBar.scrollLeft ? 'inline-block' : null;
			rs.style.display = ( toolBar.scrollLeft < toolBar.scrollWidth - toolBar.clientWidth ) ? 'inline-block' : null;
		}
		
		// scroll on mouse wheel
		toolBar.addEventListener('wheel', (e) => {
			toolBar.scrollLeft += (e.deltaY*6);
			e.preventDefault();
		});
		
		toolBar.addEventListener('scroll', showScrollButtons);
		toolBar.addEventListener('mouseenter', showScrollButtons);
		toolBar.addEventListener('mouseleave', () => { ls.style.display = rs.style.display = null; });	
	} 

	let count = 1;
	let alwaysShowTools = true;
	
	if ( userOptions.quickMenuToolsPosition === 'bottom' && !userOptions.quickMenuToolsAsToolbar ) {	
		toolsArray.forEach(tool => qm.appendChild(tool));
		if ( alwaysShowTools) count = toolsArray.length + 1; // shift hidden tiles to start after tools
	} else if ( userOptions.quickMenuToolsPosition === 'top' && !userOptions.quickMenuToolsAsToolbar ) {
		toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
	}

	if ( visibleTileCountMax <= count && position === 'bottom' && alwaysShowTools ) {
		toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
		count = 1;
		position = 'top';
	}

	// begin moreTile - hide tiles outside initial grid dimensions
	let tilesToHide = position === 'top' || !alwaysShowTools ? qm.querySelectorAll('.tile') : qm.querySelectorAll('.tile:not([data-type="tool"])');
	
	let visibleTiles = [...qm.querySelectorAll('.tile:not([data-hidden="true"]):not([data-grouphidden])')].filter( tile => tile.style.display !== 'none' );
	
	tilesToHide.forEach( _tile => {
		
		if (_tile.dataset.hidden == "true") return false;

		if (count > visibleTileCountMax - 1) {
			_tile.dataset.hidden = true;
			_tile.style.display = 'none';
		}
		
		count++;
	});

	let newVisibleTiles = [...qm.querySelectorAll('.tile:not([data-hidden="true"]):not([data-grouphidden])')].filter( tile => tile.style.display !== 'none' );

	if ( newVisibleTiles.length < visibleTiles.length ) {
		qm.moreTile.classList.add('tile');
		qm.appendChild(qm.moreTile);
	}
	
	// end moreTile

	qm.insertBreaks(qm.columns);
	
}
	
document.addEventListener("DOMContentLoaded", () => {

	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
		
		if ( userOptions === {} ) return;
		
		if ( userOptions.quickMenuTheme === 'dark' )
			document.querySelector('#dark').rel="stylesheet";
		
		makeFrameContents();
		
	});
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
window.addEventListener('message', (e) => {

	switch (e.data.action) {
		case "rebuildQuickMenu":
			userOptions = e.data.userOptions;	
			qm.columns = userOptions.quickMenuColumns;
			
			toolsHandler();
			qm.insertBreaks(qm.columns);
			
			resizeMenu({widgetResize: true, rows: userOptions.quickMenuRows});
			break;
			
		case "resizeMenu":
			resizeMenu(e.data.options);
			break;
			
		case "lock":
			document.body.classList.add('locked');
			resizeMenu({lockResize: true});
			break;
			
		case "unlock":
			document.body.classList.remove('locked');
			resizeMenu({lockResize: true});
			break;
			
	}
});

document.getElementById('menuBar').addEventListener('dblclick', (e) => {
		e.preventDefault();
		e.stopImmediatePropagation();
});

document.getElementById('menuBar').addEventListener('mousedown', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = true;
	window.parent.postMessage({action: "handle_dragstart", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mouseup', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = false;
	window.parent.postMessage({action: "handle_dragend", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mousemove', (e) => {
	if ( e.which !== 1 ) return;
	
	if ( !document.getElementById('menuBar').moving ) return;
	window.parent.postMessage({action: "handle_dragmove", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

document.getElementById('menuBar').addEventListener('dblclick', (e) => {
	if ( e.which !== 1 ) return;

	window.parent.postMessage({action: "handle_dock", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});
