var userOptions = {};

async function makeFrameContents() {

	let qme = await makeQuickMenu({type: "quickmenu", singleColumn: userOptions.quickMenuUseOldStyle});

	let old_qme = document.getElementById('quickMenuElement');
	
	if (old_qme) old_qme.parentNode.removeChild(old_qme);

	document.body.appendChild(qme);
	
	qm = qme;

	if ( userOptions.quickMenuToolsPosition === 'bottom' && userOptions.quickMenuToolsAsToolbar )	
		document.body.appendChild(toolBar);
	
	if (userOptions.quickMenuSearchBar === 'bottom') 
		document.body.appendChild(sbc);
	
	makeSearchBar();

	if ( userOptions.quickMenuSearchBar === 'hidden') {
		sbc.style.display = 'none';
		sbc.style.height = '0';
	}

	// get proper sizing for opening position
	setMenuSize();

	// override layout
	setLayoutOrder(userOptions.quickMenuDomLayout);

	document.getElementById('closeButton').addEventListener('click', e => {
		browser.runtime.sendMessage({action: "closeQuickMenuRequest"});
	});
	
	await browser.runtime.sendMessage({
		action: "quickMenuIframeLoaded", 
		size: {
			width: qm.getBoundingClientRect().width,
			height: document.body.getBoundingClientRect().height
		},
		resizeOnly: false,
		tileSize: qm.getTileSize(),
		tileCount: qm.querySelectorAll('.tile:not([data-hidden])').length,
		columns: qm.columns,
		singleColumn: qm.singleColumn
	});

	// setTimeout needed to trigger after updatesearchterms
	setTimeout(() => {				
		if (userOptions.quickMenuSearchBarSelect)
			sb.addEventListener('focus', () => sb.select(), {once:true});

		if (userOptions.quickMenuSearchBarFocus)
			sb.focus();
		
		if (userOptions.quickMenuSearchHotkeys && userOptions.quickMenuSearchHotkeys !== 'noAction' && userOptions.quickMenuFocusOnOpen ) {
			sb.blur();
			qm.focus();
		}
	}, 100);
	
	document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

}

var maxHeight = Number.MAX_SAFE_INTEGER;

function setMenuSize(o) {
	o = o || {};

	maxHeight = o.maxHeight || maxHeight;

	let tileSize = qm.getTileSize();

	qm.style.transition = 'none';
	document.body.style.transition = 'none';
	let rows = qm.insertBreaks();

	let currentHeight = qm.style.height || qm.getBoundingClientRect().height + "px" || 0;

	qm.style.height = null;
	qm.style.overflow = null;
	qm.style.width = null;
	document.body.style.width = '9999px';
	document.body.style.height = maxHeight + "px";

	document.documentElement.style.setProperty('--iframe-body-width', qm.getBoundingClientRect().width + "px");
	
	if ( !o.more && !o.move ) {
		let toolBarMore = toolBar.querySelector('[data-type="more"], [data-type="less"]');
		toolBar.querySelectorAll('[data-hidden="true"]').forEach( t => {
			unhideTile(t);
		});

		if ( toolBarMore ) toolBar.removeChild(toolBarMore);

		makeContainerMore(toolBar, userOptions.quickMenuToolbarRows);

		// qm.querySelectorAll('group').forEach( g => {
		// 	if ( g.style.display != 'block') return;

		// 	let c = g.querySelector('container');
		// 	if ( c ) makeContainerMore(c, 1);
		// })
	}

	//if ( !o.more ) makeContainerMore(toolBar, 1, false);

	let allOtherElsHeight = getAllOtherHeights();

	if ( o.lockResize )
		qm.style.height = currentHeight;
	else if ( o.suggestionsResize ) 
		qm.style.height = qm.getBoundingClientRect().height + "px";
	else if ( o.openFolder || o.toggleSingleColumn ) 
		qm.style.height = Math.min( qm.getBoundingClientRect().height, maxHeight - allOtherElsHeight ) + "px"; // site search flex
	else if ( o.more ) 
		qm.style.height = qm.getBoundingClientRect().height + "px";	
	else if ( o.widgetResize ) {
		qm.style.height = tileSize.height * o.rows + "px";
		// qm.style.width = tileSize.width * o.columns + "px";
	}
	else
		qm.style.height = Math.max( tileSize.height, Math.min(qm.getBoundingClientRect().height, (window.innerHeight || maxHeight) - allOtherElsHeight) ) + "px";
	
	if ( qm.getBoundingClientRect().height > maxHeight - allOtherElsHeight )
		qm.style.height = Math.ceil(maxHeight - allOtherElsHeight) + "px";

	let scrollbarWidth = qm.offsetWidth - qm.clientWidth; // account for fractions

	qm.style.width = Math.ceil(qm.getBoundingClientRect().width + scrollbarWidth) + "px";

	document.body.style.height = null;
	document.body.style.width = null;

	qm.removeBreaks();

	qm.style.transition = null;
	document.body.style.transition = null;

	return rows;
}

function resizeMenu(o) {
	o = o || {};

	let scrollTop = qm.scrollTop;
	let sgScrollTop = sg.scrollTop;
	
	let tileSize = qm.getTileSize();

	window.addEventListener('message', function resizeDoneListener(e) {
		if ( e.data.action && e.data.action === "resizeDone" ) {
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			document.dispatchEvent(new CustomEvent('resizeDone'));
		}
	}, {once: true});

	if ( o.widgetResize) {
		qm.style.width = null;
		qm.style.height = "auto";
		document.documentElement.style.setProperty('--iframe-body-width', qm.getBoundingClientRect().width + "px");
		toolBar.querySelectorAll('[data-hidden]').forEach( unhideTile );
		makeContainerMore(toolBar, userOptions.quickmenuToolbarRows, o.columns);
		return;
	}

	let rows = setMenuSize(o);

	qm.scrollTop = scrollTop;
	sg.scrollTop = sgScrollTop;

	window.parent.postMessage({
		action: "quickMenuResize",
		size: {
			width: qm.getBoundingClientRect().width, 
			height: Math.ceil(document.body.getBoundingClientRect().height) // account for fractions
		},
		singleColumn: qm.singleColumn,
		tileSize: tileSize,
		tileCount: qm.querySelectorAll('.tile:not([data-hidden="true"])').length,
		columns: qm.columns,
		rows: rows
	}, "*");

//	qm.style.width = null;
//	qm.style.height = null;
}

function closeMenuRequest(e) {
	if ( e.key === "Escape" || userOptions.quickMenuCloseOnClick && !quickMenuObject.locked ) {

		browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_quickmenutile"});
	}
}

function toolsHandler(o) {

	o = o || {};

	let hideEmptyGroups = moreTile => {
		qm.querySelectorAll('GROUP').forEach(g => {
			if ( !getVisibleTiles(g).length ) {
				hideTile(g, moreTile);
			}
		})
	}

	let getVisibleTiles = el => el.querySelectorAll('.tile:not([data-hidden="true"]):not([data-morehidden="true"])');

	let moreTileID = userOptions.nodeTree.id;
	let moreTile = qm.querySelector(`[data-parentid="${moreTileID}"]`);
	
	if ( moreTile ) moreTile.parentNode.removeChild( moreTile );
	
	if ( ! userOptions.quickMenuToolsAsToolbar && qm.rootNode.parent ) return; // has parent = subfolder
	
	let position = userOptions.quickMenuToolsPosition;
	
	if ( userOptions.quickMenuToolsAsToolbar && position !== 'hidden' )
		createToolsBar(qm);
	
	if ( !userOptions.quickMenuToolsAsToolbar ) {
		if ( qm.singleColumn ) qm.toolsArray.forEach( tool => tool.classList.add('singleColumn') );
	}

	// unhide tiles hidden by more tile
	qm.querySelectorAll('[data-morehidden]').forEach( tile => {
		if ( tile.moreTile && tile.moreTile.dataset.parentid === moreTileID ) {
			unhideTile(tile);
		}
	});

	// place tools at the beginning before hiding tiles > limit
	if ( !userOptions.quickMenuToolsAsToolbar ) {
		qm.toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
	}

	// hide tools
	if ( !userOptions.quickMenuToolsAsToolbar && position === 'hidden' )
		qm.toolsArray.forEach( _div => qm.removeChild(_div) );

	qm.insertBreaks(o.columns);

	let rows = o.rows || ( qm.singleColumn ? userOptions.quickMenuRowsSingleColumn : userOptions.quickMenuRows );

	let lastBreak = qm.getElementsByTagName('br').item(rows - 1);

	if ( lastBreak ) {

		(() => {

			let visibleElements = [...qm.querySelectorAll('.tile:not([data-hidden="true"]):not([data-morehidden="true"]), BR')].filter( tile => tile.style.display !== 'none' );

			let breakIndex = visibleElements.indexOf(lastBreak);

			let lastVisible;
			for ( let i=breakIndex;i>-1;i--) {
				if ( visibleElements[i].classList.contains('tile')) {
					lastVisible = visibleElements[i];
					break;
				}
			}
			
			qm.removeBreaks();

			let visibleTiles = [...getVisibleTiles(qm)].filter( tile => tile.style.display !== 'none' );

			let index = visibleTiles.indexOf(lastVisible);
			let tileArray = visibleTiles.slice(index + 1, visibleTiles.length);

			tileArray = qm.makeMoreLessFromTiles(tileArray, 1, false, qm, qm.rootNode);

			if ( !tileArray ) return;
			
			moreTile = tileArray.pop();

			if ( !moreTile ) return;

			for ( let i=index + 1;i<visibleTiles.length;i++) {

				let el = visibleTiles[i];

				hideTile(el, moreTile);
				//el.style.backgroundColor = null;
			}

			moreTile.classList.add('quickMenuMore');
			moreTile.classList.remove('tile');
			moreTile.dataset.parentid = moreTileID;

			hideEmptyGroups(moreTile);

		})();
	}

	qm.removeBreaks();

	if ( !userOptions.quickMenuToolsAsToolbar) {
		if ( userOptions.quickMenuToolsPosition === 'bottom' ) 
			qm.toolsArray.forEach(tool => qm.appendChild(tool));
		else if ( userOptions.quickMenuToolsPosition === 'top' )
			qm.toolsArray.forEach((tool, index) => qm.insertBefore(tool, qm.children.item(index)));
	}

	// move moreTile to end
	if ( moreTile ) {
		qm.appendChild(moreTile);

		// moreTile sometimes hidden?
		unhideTile(moreTile);
	}
}
	
document.addEventListener("DOMContentLoaded", async () => {

	userOptions = await browser.runtime.sendMessage({action: "getUserOptions"});
		
	setTheme()
		.then(setUserStyles)
		.then(makeFrameContents);
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

function setLockToolStatus() {
	let tile = document.querySelector(`[data-type="tool"][data-name="lock"]`);
	if ( tile ) tile.dataset.locked = quickMenuObject.locked;
}

// listen for messages from parent window
window.addEventListener('message', e => {

	switch (e.data.action) {
		case "rebuildQuickMenu":
			userOptions = e.data.userOptions;	
			qm.columns = qm.singleColumn ? 1 : e.data.columns;

			let o = {widgetResize: true, rows: e.data.rows, columns:e.data.columns};

			toolsHandler(o);
			resizeMenu(o);
			break;
			
		case "resizeMenu":
			resizeMenu(e.data.options);
			break;
			
		case "lock":
			document.body.classList.add('locked');
			resizeMenu({lockResize: true});
			quickMenuObject.locked = true;

			setLockToolStatus();
			break;
			
		case "unlock":
			document.body.classList.remove('locked');
			resizeMenu({lockResize: true});
			quickMenuObject.locked = false;

			setLockToolStatus();
			break;
			
	}
});

document.addEventListener('keydown', e => {
	if ( e.key === 'Escape' ) closeMenuRequest(e);
});

// prevent docking
document.body.addEventListener('dblclick', e => {
	e.preventDefault();
	e.stopImmediatePropagation();
});

// addChildDockingListeners(mb, "quickMenu");
addChildDockingListeners(document.body, "quickMenu", "#searchBarContainer > *");

// drag overdiv listener for chrome
window.addEventListener("message", e => {
	if ( !e.data.drop ) return;
	let el = document.elementFromPoint(e.data.offsetX, e.data.offsetY);

	// dispatch both to fool timer
	el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
	el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
});

// initOptionsBar();
