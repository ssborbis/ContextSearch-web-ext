var qm = document.getElementById('quickMenuElement');
var sb = document.getElementById('searchBar');
// var tb = document.getElementById('titleBar');
var sg = document.getElementById('suggestions');
var ob = document.getElementById('optionsButton');
var mb = document.getElementById('menuBar');

// Append <style> element to <head>
var styleEl = document.createElement('style');
document.head.appendChild(styleEl);

var type;

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

function getSearchBar() {
	return document.getElementById('searchBar');
}

// generic search engine tile
function buildSearchIcon(icon_url, title) {
	var div = document.createElement('DIV');
	
	if ( icon_url )	div.style.backgroundImage = 'url("' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + '")';
	div.style.setProperty('--tile-background-size', 16 * userOptions.quickMenuIconScale + "px");
	div.title = title;
	return div;
}

// method for assigning tile click handler
function addTileEventHandlers(_tile, handler) {

	// all click events are attached to mouseup
	_tile.addEventListener('mouseup', (e) => {
		
		if ( _tile.disabled ) return false;

		// check if this tile was target of the latest mousedown event
		if ( !userOptions.quickMenuSearchOnMouseUp && !_tile.isSameNode(_tile.parentNode.lastMouseDownTile)) return;

		// prevents unwanted propagation from triggering a parentWindow.click event call to closequickmenu
		quickMenuObject.mouseLastClickTime = Date.now();
		
		if ( _tile.dataset.id && quickMenuObject.lastUsed !== _tile.dataset.id ) {
			// store the last used id
			quickMenuObject.lastUsed = _tile.dataset.id || null;
			userOptions.lastUsedId = quickMenuObject.lastUsed;
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
		}
		
		if (type === 'quickmenu') {
			quickMenuObject.searchTerms = getSearchBar().value;
			browser.runtime.sendMessage({
				action: "updateQuickMenuObject", 
				quickMenuObject: quickMenuObject
			});
		}

		// custom tile methods
		handler(e);
		
		// check for locked / Keep Menu Open 
		if ( !keepMenuOpen(e) && !_tile.keepOpen )
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_quickmenutile"});
		
		if (type === 'searchbar' && userOptions.searchBarCloseAfterSearch) window.close();

	});
	
	// prevent triggering click event accidentally releasing mouse button when menu is opened by HOLD method
	_tile.addEventListener('mousedown', (e) => {
		_tile.parentNode.lastMouseDownTile = _tile;
	});
	
	// stop all other mouse events for this tile from propagating
	[/*'mousedown',*/'mouseup','click','contextmenu'].forEach( eventType => {
		_tile.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	});
	
	// allow dnd with left-button, ignore other events
	_tile.addEventListener('mousedown', (e) => {
		if ( e.which !== 1 ) {
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	});
	
}

// get open method based on user preferences
function getOpenMethod(e, isFolder) {
	
	isFolder = isFolder || false;

	let left = isFolder ? userOptions.quickMenuFolderLeftClick : userOptions.quickMenuLeftClick;
	let right = isFolder ? userOptions.quickMenuFolderRightClick : userOptions.quickMenuRightClick;
	let middle = isFolder ? userOptions.quickMenuFolderMiddleClick : userOptions.quickMenuMiddleClick;
	let shift = isFolder ? userOptions.quickMenuFolderShift : userOptions.quickMenuShift;
	let ctrl = isFolder ? userOptions.quickMenuFolderCtrl : userOptions.quickMenuCtrl;
	let alt = isFolder ? userOptions.quickMenuFolderAlt : userOptions.quickMenuAlt;
	
	let openMethod = "";
	if (e.which === 3)
		openMethod = right;
	else if (e.which === 2)
		openMethod = middle;
	else if (e.which === 1) {
		openMethod = left;
		
		// ignore methods that aren't opening methods
		if (e.shiftKey && shift !== 'keepMenuOpen')
			openMethod = shift;
		if (e.ctrlKey && ctrl !== 'keepMenuOpen')
			openMethod = ctrl;
		if (e.altKey && alt !== 'keepMenuOpen')
			openMethod = alt;
	
	}

	return openMethod;
}

function keepMenuOpen(e) {
	
	if ( /KeepOpen$/.test(getOpenMethod(e)) ) return true;
	
	if (
		!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
		!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
		!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen") &&
		userOptions.quickMenuCloseOnClick &&
		!quickMenuObject.locked
	) 
		return false;
	else 
		return true;
}

function makeQuickMenu(options) {
	
	if ( userOptions.userStylesEnabled ) styleEl.innerText = userOptions.userStyles;

	type = options.type;
	let mode = options.mode;

	let singleColumn = ( 
		(type === 'searchbar' && userOptions.searchBarUseOldStyle) ||
		(type === 'quickmenu' && userOptions.quickMenuUseOldStyle) ||
		(type === 'sidebar' && userOptions.sideBar.singleColumn)
	) ? true : false;
	
	let columns = singleColumn ? 1 : getColumns();
	
	function getColumns() {
		if (type === 'searchbar') return userOptions.searchBarColumns;
		if (type === 'sidebar') return userOptions.sideBar.columns;
		if (type === 'quickmenu') return userOptions.quickMenuColumns;
	}
	
	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	// sg div for toolbar search
	if (sg) sg.tabIndex = -1;

	var qm = document.getElementById('quickMenuElement') || document.createElement('div');
	qm.id = 'quickMenuElement';
	qm.tabIndex = -1;
	
	qm.dataset.menu = type;
	qm.dataset.columns = columns;
	qm.columns = columns;
	document.body.dataset.menu = type;

	let sb = document.getElementById('searchBar');
	sb.onclick = function(e) {
		e.stopPropagation();
	}
	sb.onmouseup = function(e) {
		e.stopPropagation();
	}
	
	let sbc = document.getElementById('searchBarContainer');
	
	// replace / append dragged text based on timer
	sb.addEventListener('dragenter', (e) => {
		sb.select();
		sb.hoverTimer = setTimeout(() => {
			sb.selectionStart = sb.selectionEnd = 0;
			sb.hoverTimer = null;
		},1000);
	});
	sb.addEventListener('drop', (e) => {
		if (sb.hoverTimer) {
			sb.value = "";	
			clearTimeout(sb.hoverTimer);
		}
	});
	
	sb.addEventListener('change', (e) => {
		browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: sb.value});
	});
	
	let csb = document.getElementById('clearSearchBarButton');
	csb.onclick = () => { 
		sb.value = null;
		sb.focus();
	};
	csb.title = browser.i18n.getMessage('delete').toLowerCase();
	
	let tb = document.getElementById('toolBar') || document.createElement('div');
	
	// prevent context menu on toolbar deadzone
	if ( !userOptions.quickMenuAllowContextMenu ) {
		tb.addEventListener('contextmenu', e => e.preventDefault());
	}

	// folder styling hotkey
	document.addEventListener('keydown', (e) => {
		if (e.keyCode === 190 && e.ctrlKey) {
			
			e.preventDefault();

			qm.rootNode.displayType = function() {
				if ( singleColumn && !qm.rootNode.displayType ) return "grid";
				if ( !singleColumn && !qm.rootNode.displayType ) return "text";
				return "";
			}();
			
			userOptions.nodeTree = JSON.parse(JSON.stringify(root));
			
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
			
			quickMenuElement = quickMenuElementFromNodeTree( qm.rootNode, false );
			
			browser.runtime.sendMessage({
				action: "quickMenuIframeLoaded", 
				size: {
					width: qm.getBoundingClientRect().width,
					height: document.body.getBoundingClientRect().height + "px"
				},
				resizeOnly: true,
				tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight},
				tileCount: qm.children.length
			});
			
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
		}	
	});
	
	// enter key invokes search
	document.addEventListener('keydown', (e) => {
		if (e.keyCode === 13) {

			let div = qm.querySelector('div.selectedFocus') || qm.querySelector('div.selectedNoFocus') || qm.querySelector('div[data-id]');
			
			if (!div) return;
			
			div.parentNode.lastMouseDownTile = div;
			div.dispatchEvent(new MouseEvent('mouseup'));
		}	
	});

	// tab and arrow keys move selected search engine
	sb.addEventListener('focus', () => {
		
		let div = qm.querySelector('.selectedFocus');
		if (div) div.classList.remove('selectedFocus');
		
		delete sb.selectedIndex;
		
		div = qm.querySelector('div[data-selectfirst]') || qm.querySelector('div[data-id]');
		if (div) {
			sb.selectedIndex = [].indexOf.call(qm.querySelectorAll('div[data-id]'), div);
			div.classList.add('selectedNoFocus');
		}

	});
	
	sb.addEventListener('blur', () => {
		let div = qm.querySelector('div[data-id]');
		if (div) div.classList.remove('selectedNoFocus');
	});
	
	// hotkey listener
	document.addEventListener('keydown', (e) => {

		if (!userOptions.quickMenuSearchHotkeys || userOptions.quickMenuSearchHotkeys === 'noAction') return;

		// ignore hotkeys when the search bar is being edited
		if (document.activeElement === sb) return;

		let hotkeyNodes = findNodes(userOptions.nodeTree, node => node.hotkey === e.which);

		if (!hotkeyNodes.length) return;
		
		browser.runtime.sendMessage({
			action: "quickMenuSearch", 
			info: {
				menuItemId: (hotkeyNodes[0].type === 'oneClickSearchEngine') ? "__oneClickSearchEngine__" + hotkeyNodes[0].id : hotkeyNodes[0].id,
				selectionText: sb.value,
				openMethod: userOptions.quickMenuSearchHotkeys
			}
		});
		
		if ( typeof addToHistory !== 'undefined' ) addToHistory(sb.value);
		
		if ( !keepMenuOpen(e) )
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});

		if (type === 'searchbar' && userOptions.searchBarCloseAfterSearch) window.close();

	});
	
	qm.selectFirstTile = function() {
		let firstTile = qm.querySelector('.tile:not([data-hidden])');
		firstTile.classList.add('selectedFocus');
		sb.selectedIndex = [].indexOf.call(qm.querySelectorAll(".tile"), firstTile);
	}

	sb.addEventListener('keydown', (e) => {

		if ( [ 38, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
		
		e.preventDefault();
		
		let direction = ( e.keyCode === 40 || ( e.keyCode === 9 && !e.shiftKey) ) ? 1 : -1;

		sb.selectionEnd = sb.selectionStart;
		
		// move focus to sg 
		if ( direction === 1 && sg ) {

			let rows = sg.getElementsByTagName('div');
			
			if ( rows.length > 0 && e.keyCode === 40 ) { // only down arrow moves to sg

				rows.item(0).click();
				
				e.preventDefault();
				sg.focus();

			} else {
				e.preventDefault();
				qm.focus();
				qm.selectFirstTile();
			}
			
			return;
		} else {
			e.preventDefault();
			qm.focus();
			
			let divs = qm.querySelectorAll('.tile:not([data-type="tool"]):not([data-hidden])');
			
			let selectedDiv = ( direction === 1 ) ? divs[0] : divs[divs.length - 1];

			selectedDiv.classList.add('selectedFocus');
			sb.selectedIndex = [].indexOf.call(qm.querySelectorAll('.tile'), selectedDiv);
		}
	});
	
	if (sg) {
		sg.addEventListener('keydown', (e) => {

			if ( [ 38, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
			
			// prevent default action (scroll)
			e.preventDefault();
			
			if (e.keyCode === 9 && !e.shiftKey) {
				qm.focus();
				qm.selectFirstTile();
				return;
			}
	
			let direction = (e.keyCode === 40) ? 1 : -1;
			
			let divs = sg.getElementsByTagName('div');

			let currentIndex = [].findIndex.call(divs, div => div.classList.contains( "selectedFocus" ));

			if ( currentIndex !== -1 ) {
				divs[currentIndex].classList.remove("selectedFocus");
				
				let selectedDiv = null;
				
				if ( currentIndex + direction > divs.length -1 ) {
					qm.focus();
					qm.selectFirstTile();
					return;
				} else if ( currentIndex + direction < 0 ) {
					sb.focus();
					return;
				}
				else
					selectedDiv = divs[currentIndex + direction];
					
				selectedDiv.click();
				
				selectedDiv.scrollIntoView({block: "nearest"}); 
			}

		});
	}
	
	qm.addEventListener('keydown', (e) => {
		
		// account for custom folders
		let _columns = qm.querySelector('div').classList.contains('singleColumn') ? 1 : qm.columns;

		if ( ! [ 37, 38, 39, 40, 9 ].includes(e.keyCode) ) return;
		
		e.preventDefault();

		let direction = 0;
		if (e.keyCode === 9 && !e.shiftKey)
			direction = 1;
		else if (e.keyCode === 9 && e.shiftKey)
			direction = -1;
		else if (e.keyCode === 40)
			direction = _columns;
		else if (e.keyCode === 38)
			direction = -_columns;
		else if (e.keyCode === 39)
			direction = 1; 
		else if (e.keyCode === 37)
			direction = -1;

		// get all tiles
		let divs = qm.querySelectorAll('.tile');

		// clear current selection
		if (sb.selectedIndex !== undefined)
			divs[sb.selectedIndex].classList.remove('selectedFocus');

		if (
			(e.keyCode === 9 && e.shiftKey && sb.selectedIndex === undefined) ||
			(e.keyCode === 38 && sb.selectedIndex === undefined)
		)
			sb.selectedIndex = divs.length -1;
		else if (sb.selectedIndex === undefined)
			sb.selectedIndex = [].indexOf.call( divs, qm.querySelector('div[data-id]') );
		else if (sb.selectedIndex + direction >= divs.length) {
			sb.focus();
			sb.select();
			return;
		}
		else if (sb.selectedIndex + direction < 0) {
			sb.focus();
			sb.select();
			return;
		}
		else {
			sb.selectedIndex+=direction;
			
			// skip hidden tiles by reissuing the event
			if ( divs[sb.selectedIndex].dataset.hidden ) {
				qm.dispatchEvent(new e.constructor(e.type, e));
				return;
			}
		}

		divs[sb.selectedIndex].classList.add('selectedFocus');
		
		
		divs[sb.selectedIndex].scrollIntoView({block: "nearest"});

	});

	document.addEventListener('updatesearchterms', (e) => {
		sb.value = quickMenuObject.searchTerms.replace(/[\r|\n]+/g, " ");
	});
	
	if ( type === 'quickmenu' && userOptions.quickMenuSearchBar === 'hidden') {
		sb.parentNode.style.display = 'none';
		sb.parentNode.style.height = '0';
	}
	
	// prevent click events from propagating
	[/*'mousedown',*/ 'mouseup', 'click', 'contextmenu'].forEach( eventType => {
		qm.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	});

	function createToolsArray() {
	
		let toolsArray = [];

		// iterate over tools
		userOptions.quickMenuTools.forEach( tool => {

			// skip disabled tools
			if (tool.disabled) return;
			
			let _tool = QMtools.find( t => t.name === tool.name );
			toolsArray.push(_tool.init());

		});

		toolsArray.forEach( tool => tool.dataset.type = 'tool' );

		return toolsArray;
	}
	
	//#Source https://bit.ly/2neWfJ2 
	const every_nth = (arr, nth) => arr.filter((e, i) => i % nth === nth - 1);
	
	function insertBreaks(_columns) {

		qm.querySelectorAll('br').forEach( br => {
			qm.removeChild(br);
		});
		// qm.querySelectorAll('.tile:not([data-hidden]):nth-of-type(' + _columns + 'n)').forEach( tile => {
			// tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);
		// });
		
		every_nth([ ...qm.querySelectorAll('.tile:not([data-hidden="true"])')], _columns).forEach( tile => {
			tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);;
		});
	}
	
	function buildQuickMenuElement(options) {
		
		let _singleColumn = options.forceSingleColumn || options.node.displayType === "text";
		
		if ( options.node.displayType === "grid" ) _singleColumn = false;
		
		let _columns = _singleColumn ? 1 : getColumns();

		function buildMoreTile() {
			let moreTile = buildSearchIcon(browser.runtime.getURL('/icons/add.svg'), browser.i18n.getMessage('more'));

			moreTile.style.textAlign='center';
			moreTile.dataset.type = "tool";

			moreTile.addEventListener('mouseup', _more);
			moreTile.addEventListener('openFolder', _more);
			
			function _more(e) {

				moreTile.parentNode.removeChild(moreTile);

				qm.querySelectorAll('[data-hidden="true"]').forEach( div => {
					div.style.display = null;
					delete div.dataset.hidden;
				});
				
				// if tools are on the bottom, move them
				if (userOptions.quickMenuToolsPosition === 'bottom') {
					qm.querySelectorAll('[data-type="tool"]').forEach( div => { qm.appendChild(div) } );
				}
				
				// rebuild breaks
				insertBreaks(_columns);

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: qm.getBoundingClientRect().width,
						height: document.body.getBoundingClientRect().height + "px"
					},
					resizeOnly: true,
					tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight},
					tileCount: qm.querySelectorAll('.tile:not([data-hidden])').length
				});
				
				document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

			}
			
			return moreTile;
		}
		
		let tileArray = options.tileArray;
		let toolsArray = options.toolsArray;

		qm.innerHTML = null;

		// initialize slide-in animation
		qm.style.position = 'relative';
		qm.style.visibility = 'hidden';
		qm.style.transition = 'none';
		
		qm.columns = _columns;
	
		// remove separators if using grid
		if (!_singleColumn) {
			tileArray = tileArray.filter( tile => tile.dataset.type !== 'separator' );
		}
	
		// set the number of tiles to show
		let visibleTileCountMax = _singleColumn ? userOptions.quickMenuRows : userOptions.quickMenuRows * userOptions.quickMenuColumns;

		// set tools position
		if ( userOptions.quickMenuToolsAsToolbar && userOptions.quickMenuToolsPosition !== 'hidden' && type === 'quickmenu' ) {

			tb.style = 'overflow-x:hidden;white-space: nowrap;';
			tb.addEventListener('wheel', (e) => {
				tb.scrollLeft += (e.deltaY*6);
				e.preventDefault();
			});
			tb.innerHTML = null;
			
			let ls = document.createElement('img');
			ls.style = 'width:15px;height:15px;background-color:gray;display:none;left:0;position:absolute;z-index:2;opacity:.6;transform:rotate(-90deg)';
			ls.src = browser.runtime.getURL('icons/chevron-up.svg');
			tb.appendChild(ls);
			
			let rs = document.createElement('img');
			rs.style = 'width:15px;height:15px;background-color:gray;display:none;right:0;position:absolute;z-index:2;opacity:.6;transform:rotate(90deg)';
			rs.src = browser.runtime.getURL('icons/chevron-up.svg');
			tb.appendChild(rs);
			
			let mouseoverInterval = null;
			rs.addEventListener('mouseenter', (e) => {
				mouseoverInterval = setInterval(() => {tb.scrollLeft += 10;}, 50);
			});
			
			ls.addEventListener('mouseenter', (e) => {	
				mouseoverInterval = setInterval(() => {tb.scrollLeft -= 10;}, 50);
			});
			
			[rs,ls].forEach(s => s.addEventListener('mouseleave', () => {clearInterval(mouseoverInterval)}));
			
			toolsArray.forEach( tool => {
				tool.className = 'tile';
				tb.appendChild(tool);
			});
			
			function showScrollButtons() {
				ls.style.display = tb.scrollLeft ? 'inline-block' : 'none';
				rs.style.display = ( tb.scrollLeft < tb.scrollWidth - tb.clientWidth ) ? 'inline-block' : 'none';
			}
			
			tb.addEventListener('scroll', showScrollButtons);
			tb.addEventListener('mouseenter', showScrollButtons);
			tb.addEventListener('mouseleave', () => {
				ls.style.display = rs.style.display = 'none';
			});
			
		} else if (userOptions.quickMenuToolsPosition === 'top' && type === 'quickmenu')
			tileArray = toolsArray.concat(tileArray);
		else if (userOptions.quickMenuToolsPosition === 'bottom' && type === 'quickmenu')
			tileArray.splice(visibleTileCountMax - toolsArray.length - 1, 0, ...toolsArray);
	
		// hide tiles outside initial grid dimensions
		if ( type === 'quickmenu' && tileArray.length > visibleTileCountMax && !options.parentId ) {
			tileArray.splice(visibleTileCountMax - 1, 0, buildMoreTile());
			
			for (let i=visibleTileCountMax;i<tileArray.length;i++) {
				tileArray[i].style.display = 'none';
				tileArray[i].dataset.hidden = true;
			}
		}
		
		// shift tiles to match quickmenu and searchbar
		if ( 
			((type === "searchbar" && userOptions.quickMenuColumns === userOptions.searchBarColumns) ||
			(type === "sidebar" && userOptions.quickMenuColumns === userOptions.sideBar.columns)) && 
			userOptions.quickMenuToolsPosition === "top" && !_singleColumn && !options.parentId && toolsArray.length !== _columns && !userOptions.quickMenuToolsAsToolbar) {
			toolsArray.forEach( tool => {
				tool.dataset.disabled = true;
				tool.dataset.hidden = true;
				tool.disabled = true;
				tool.title = "";
				tileArray.unshift(tool);
			});
		}

		// add empty cells for resizing ( needs work )
		if ( mode === "resize" ) {
			let resizeMaxTiles = _singleColumn ? userOptions.quickMenuRows : userOptions.quickMenuRows * userOptions.quickMenuColumns;
			for ( let i=tileArray.length; i<resizeMaxTiles;i++) {
				let tile = document.createElement('div');
				tile.dataset.type = 'empty';
				tileArray.push(tile);
			}
		}

		// make rows / columns
		tileArray.forEach( tile => {
			
			tile.classList.add('tile');
			tile.dataset.title = tile.title;

			if (_singleColumn) tile.classList.add("singleColumn");
			
			if ( !_singleColumn && tile.node && tile.node.type === 'folder' && tile.dataset.type === 'folder' )
				tile.style.backgroundImage = 'url(' + browser.runtime.getURL('icons/transparent.gif') + ')';
			
			qm.appendChild(tile);
		});
		
		insertBreaks(_columns);

		// check if any search engines exist and link to Options if none
		if (userOptions.nodeTree.children.length === 0 && userOptions.searchEngines.length === 0 ) {
			var div = document.createElement('div');
			div.style='width:auto;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
			div.innerText = browser.i18n.getMessage("WhereAreMyEngines");
			div.onclick = function() {
				browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=enginesTab"});
			}	
			qm.appendChild(div);
		}

		// set min-width to prevent menu shrinking with smaller folders
		qm.style.minWidth = _columns * qm.querySelector('.tile').getBoundingClientRect().width + "px";
		
		// slide-in animation
		if ( !userOptions.enableAnimations ) qm.style.setProperty('--user-transition', 'none');
		qm.style.left = qm.getBoundingClientRect().width * ( (options.reverse) ? -1 : 1 ) + "px";
		void( qm.offsetHeight );
		qm.style.transition = null;
		qm.style.visibility = null;
		qm.style.left = '0px';

		/* dnd */
		let tileDivs = qm.querySelectorAll('.tile:not([data-type="tool"]):not([data-type="empty"])');
		tileDivs.forEach( div => {
			
			function getSide(t, e) {
				let rect = t.getBoundingClientRect();
				
				if ( t.node.type === 'folder' ) {
					if ( _singleColumn ) {
						if ( e.y - rect.y < .3 * rect.height ) return "before";
						else if ( e.y - rect.y > .7 * rect.height ) return "after";
						else return "middle";
					} else {
						if ( e.x - rect.x < .3 * rect.width ) return "before";
						else if ( e.x - rect.x > .7 * rect.width ) return "after";
						else return "middle";
					}
				} else {
					if ( _singleColumn ) 
						return ( e.y - rect.y < .5 * rect.height ) ? "before" : "after";
					else
						return ( e.x - rect.x < .5 * rect.width ) ? "before" : "after";
				}
			}
			
			function getTargetElement(el) {
				while ( el.parentNode ) {
					if ( el.node ) return el;
					el = el.parentNode;
				}
				return null;
			}
			
			div.setAttribute('draggable', true);

			div.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData("text", "");
				let img = new Image();
				img.src = browser.runtime.getURL('icons/transparent.gif');
				e.dataTransfer.setDragImage(img, 0, 0);
				div.id = 'dragDiv';
				div.style.opacity = .5;
			});
			div.addEventListener('dragover', (e) => {
				e.preventDefault();
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;
				let dragDiv = document.getElementById('dragDiv');

				if ( targetDiv === dragDiv ) return;

				targetDiv.classList.add('dragHover');

				// if moving tiles, show arrow
				if ( dragDiv ) {
					
					let side = getSide(targetDiv, e);
					targetDiv.dataset.side = side;
					
					let arrow = document.getElementById('arrow');
					arrow.style.display = null;
					
					let rect = targetDiv.getBoundingClientRect();
					arrow.style.setProperty('--target-left', rect.left + "px");
					arrow.style.setProperty('--target-top', rect.top + "px");
					arrow.style.setProperty('--target-width', rect.width + "px");
					arrow.style.setProperty('--target-height', rect.height + "px");
					arrow.dataset.side = side;
				}
			});
			div.addEventListener('dragenter', (e) => {

				e.target.dispatchEvent(new MouseEvent('mouseenter'));
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;

				targetDiv.style.transition = 'none';
				
				let dragDiv = document.getElementById('dragDiv');
				
				if ( !dragDiv && targetDiv.dataset.type === 'folder' ) {

					targetDiv.textDragOverFolderTimer = setTimeout(() => {					
						let _e = new CustomEvent('openFolder');
						// let _e = new MouseEvent('mouseup');
						_e.openFolder = true;
						targetDiv.dispatchEvent(_e);
					}, 500);
					return;
				}
				
				// if moving tiles, show indicator
				if ( dragDiv ) {
					let arrow = document.getElementById('arrow');
						
					if ( !arrow ) {
						arrow = document.createElement('div');
						document.body.appendChild(arrow);
					}
					if ( _singleColumn ) arrow.className = 'singleColumn';
					arrow.id = 'arrow';
					arrow.style.top = targetDiv.getBoundingClientRect().top + "px";
					arrow.style.display = null;
				}
			});
			div.addEventListener('dragleave', (e) => {
				e.target.dispatchEvent(new MouseEvent('mouseleave'));
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;

				targetDiv.classList.remove('dragHover');
				targetDiv.style.transition = null;
				
				delete targetDiv.dataset.side;
				
				if ( targetDiv.textDragOverFolderTimer )
					clearTimeout(targetDiv.textDragOverFolderTimer);
				
				let arrow = document.getElementById('arrow');
				if ( arrow ) arrow.style.display = 'none';
			});
			div.addEventListener('dragend', (e) => {

				let dragDiv = document.getElementById('dragDiv');
				
				if ( dragDiv ) {
					dragDiv.style.opacity = null;
					dragDiv.id = "";
				}
				
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;
				targetDiv.classList.remove('dragHover');

				let arrow = document.getElementById('arrow');
				if ( arrow ) arrow.style.display = 'none';
				
				// refresh menu when moving groups
				if ( dragDiv.node.groupFolder || dragDiv.node.parent.groupFolder ) {
					quickMenuElementFromNodeTree(tileDivs[0].node.parent);
				}
				
			});
			div.addEventListener('drop', (e) => {
				e.preventDefault();
				
			//	console.log(e.dataTransfer, e.dataTransfer.getData("text/html"), e.dataTransfer.getData("text/x-moz-place"), e.dataTransfer.getData("text/x-moz-url"));
			
				// console.log(e, e.dataTransfer);
				// console.log(e.dataTransfer.getData("text"));

				// look for text dnd
				if ( e.dataTransfer.getData("text") && !e.dataTransfer.getData("text/x-moz-place") ) {
					e.preventDefault();
					sb.value = e.dataTransfer.getData("text");
					div.parentNode.lastMouseDownTile = div;
					div.dispatchEvent(new MouseEvent('mouseup'));
					return;
				}

				let dragDiv = document.getElementById('dragDiv');
				
				let targetDiv = getTargetElement(e.target);
				targetDiv.classList.remove('dragHover');
				
				// firefox DnD for bookmarks
				if ( e.dataTransfer.getData("text/x-moz-place") ) {
					let _bm = JSON.parse(e.dataTransfer.getData("text/x-moz-place"));
					
					if ( !_bm.uri ) return; // ignore folders
			//		console.log(_bm);

					dragDiv = nodeToTile({
						title: _bm.title,
						type: "bookmark",
						uri: _bm.uri,
						id: _bm.itemGuid,
						parent: targetDiv.node.parent,
						toJSON: targetDiv.node.toJSON,
						icon: browser.runtime.getURL('icons/search.svg')
					});

					dragDiv.className = "tile";
					targetDiv.parentNode.appendChild(dragDiv);
					targetDiv.node.parent.children.push(dragDiv.node);

					try {
						let _url = new URL(_bm.uri);
						let img = new Image();

						img.onload = function() {
							dragDiv.node.icon = imageToBase64(img, 32);
							dragDiv.style.backgroundImage = `url(${dragDiv.node.icon})`;
							
							setTimeout(() => {
								userOptions.nodeTree = JSON.parse(JSON.stringify(root));
								browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
							}, 500);
							
						}
						img.src = 'https://s2.googleusercontent.com/s2/favicons?domain_url=' + _url.hostname;
					} catch (error) {
						console.log(error);
					}
				}	

				if (!targetDiv) return;
				if (!dragDiv || !dragDiv.node) return;
				if (targetDiv === dragDiv) return;
				
				let side = getSide(targetDiv, e);

				if ( side === "before" )
					dragDiv.parentNode.insertBefore(dragDiv, targetDiv);
				else if ( side === "after" )
					dragDiv.parentNode.insertBefore(dragDiv, targetDiv.nextSibling);
				else dragDiv.parentNode.removeChild(dragDiv);

				let dragNode = dragDiv.node;
				let targetNode = targetDiv.node;

				// cut the node from the children array
				let slicedNode = dragNode.parent.children.splice(dragNode.parent.children.indexOf(dragNode), 1).shift();

				// set new parent
				slicedNode.parent = targetNode.parent;

				if ( side === "before" ) {
					// add to children before target
					targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode),0,slicedNode);
				} else if ( side === "after" ) {
					// add to children after target
					targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode)+1,0,slicedNode);
				} else {
					slicedNode.parent = targetNode;
					// add to target children
					targetNode.children.push(slicedNode);
				}
	
				// save the tree
				userOptions.nodeTree = JSON.parse(JSON.stringify(root));
				
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
				
				// rebuild breaks	
				insertBreaks(qm.columns);

			});
			
		});
		
		/* end dnd */

		return qm;
	}

	function quickMenuElementFromNodeTree( rootNode, reverse ) {

		reverse = reverse || false; // for slide-in animation direction
		
		let nodes = rootNode.children;
		let tileArray = [];
		
		// update the qm object with the current node
		qm.rootNode = rootNode;
		
		if (rootNode.parent) { // if parentId was sent, assume subfolder and add 'back' button
			
			let tile = buildSearchIcon(browser.runtime.getURL('/icons/back.png'), browser.i18n.getMessage('back') || 'back');
			
			tile.dataset.type = "tool";
			tile.node = rootNode.parent;
			
			tile.addEventListener('mouseup', _back);
			tile.addEventListener('openFolder', _back);
			
			function _back(e) {

				// back button rebuilds the menu using the parent folder ( or parent->parent for groupFolders )
				let quickMenuElement = quickMenuElementFromNodeTree(( rootNode.parent.groupFolder ) ? rootNode.parent.parent : rootNode.parent, true);

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: qm.getBoundingClientRect().width,
						height: document.body.getBoundingClientRect().height + "px"
					},
					resizeOnly: true,
					tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight},
					tileCount: qm.querySelectorAll('.tile:not([data-hidden])').length
				});
				
				document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

			}
			
			tile.addEventListener('dragenter', (e) => {
				// ignore tile dnd
				if ( document.getElementById('dragDiv') ) return;
				
				// start hover timer
				tile.textDragOverFolderTimer = setTimeout(() => {

					let _e = new CustomEvent("openFolder");
					// let _e = new MouseEvent('mouseup');
					_e.openFolder = true;
					tile.dispatchEvent(_e);
				}, 500);
			});
			tile.addEventListener('dragleave', (e) => {
				// clear hover timer
				clearTimeout(tile.textDragOverFolderTimer);
			});
			tile.addEventListener('dragover', (e) => {e.preventDefault();});
			tile.addEventListener('dragend', (e) => {e.preventDefault();});
			tile.addEventListener('drop', (e) => {
				e.preventDefault();
				
				let dragDiv = document.getElementById('dragDiv');
				
				if ( !dragDiv || !dragDiv.node ) return;
				
				dragDiv.parentNode.removeChild(dragDiv);
				
				dragDiv.id = null;

				let dragNode = dragDiv.node;
				let targetNode = tile.node;
				
				let slicedNode = dragNode.parent.children.splice(dragNode.parent.children.indexOf(dragNode), 1).shift();
				
				slicedNode.parent = targetNode;
					
				// add to target children
				targetNode.children.push(slicedNode);
				
				// save the tree
				userOptions.nodeTree = JSON.parse(JSON.stringify(root));
				
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
				
			});
			
			delete sb.selectedIndex;
			tileArray.push(tile);
		}

		nodes.forEach( node => {

			let tile = nodeToTile(node);
			
			if ( tile ) tileArray.push( tile );
			else return;
			
			if ( node.groupFolder ) {
				let count = 1;
				node.children.forEach( _node => {
					let _tile = nodeToTile(_node);
					_tile.style.setProperty("--group-color",tile.node.groupColor);
					_tile.classList.add("groupFolder");

					if ( node.groupLimit && count >= node.groupLimit ) {
						_tile.dataset.hidden = true;
						_tile.style.display = 'none';
					}
	
					if ( _tile ) {
						tileArray.push( _tile );
						count++;
					}
					
				});
				
				if ( node.groupLimit && node.children.length >= node.groupLimit ) {
					let moreTile = buildSearchIcon(browser.runtime.getURL('/icons/add.svg'), browser.i18n.getMessage('more'));

					moreTile.style.textAlign='center';
					moreTile.dataset.type = "tool";
					moreTile.style.setProperty("--group-color",tile.node.groupColor);
					moreTile.classList.add("groupFolder");
					
					function more() {
						qm.querySelectorAll('.tile[data-hidden="true"]').forEach( _div => {
							if ( _div.node.parent !== node ) return;
							
							_div.dataset.hidden = "false";
							_div.style.display = null;
						});
						
						insertBreaks(qm.columns);
						
						moreTile.addEventListener('mouseup', less);
						moreTile.removeEventListener('mouseup', more);	
						
						moreTile.style.backgroundImage = `url(${browser.runtime.getURL('icons/crossmark.svg')}`;
					}
					
					function less() {
						qm.querySelectorAll('.tile[data-hidden="false"]').forEach( _div => {
							if ( _div.node.parent !== node ) return;
							
							_div.dataset.hidden = "true";
							_div.style.display = "none";
						});
						
						insertBreaks(qm.columns);
						
						moreTile.addEventListener('mouseup', more);
						moreTile.removeEventListener('mouseup', less);	
						
						moreTile.style.backgroundImage = `url(${browser.runtime.getURL('icons/add.svg')}`;
					}
					
					moreTile.addEventListener('mouseup', more);
					
					tileArray.push( moreTile );
				}
			}
		});

		// do not display tools if in a subfolder
		let toolsArray = rootNode.parent ? [] : createToolsArray();

		return buildQuickMenuElement({tileArray:tileArray, toolsArray:toolsArray, reverse: reverse, parentId: rootNode.parent, forceSingleColumn: rootNode.forceSingleColumn, node: rootNode});
	}
	
	function nodeToTile( node ) {
			
		let tile;

		if (node.hidden) return;
		
		switch ( node.type ) {

			case "searchEngine":

				let se = userOptions.searchEngines.find(se => se.id === node.id);
				
				if (!se) {
					console.log('no search engine found for ' + node.id);
					return;
				}

				tile = buildSearchIcon(se.icon_base64String || browser.runtime.getURL('/icons/search.svg'), se.title);
				
				// site search picker
				if ( se.template.indexOf('{selectdomain}') !== -1 ) {
					tile.dataset.id = node.id;
					tile.dataset.type = 'folder';
					tile.dataset.subtype = 'sitesearch';

					tile.addEventListener('mouseup', openFolder);
					tile.addEventListener('openFolder', openFolder);
					
					function openFolder(e) {

						browser.runtime.sendMessage({action: 'getCurrentTabInfo'}).then( tab => {

							let siteSearchNode = {
								type:"folder",
								parent:node.parent,
								children:[],
								id:node.id,
								forceSingleColumn:true
							}
							
							let url = new URL(tab.url);

							getDomainPaths(url).forEach( path => {
								siteSearchNode.children.push({
									type: "siteSearch",
									title: path,
									parent:node,
									icon: tab.favIconUrl || browser.runtime.getURL('/icons/search.svg')
								});	
							});
							
							quickMenuElement = quickMenuElementFromNodeTree(siteSearchNode);

							for ( let _tile of qm.querySelectorAll('.tile') ) {
								if ( _tile.node.title === url.hostname ) {
									_tile.classList.add('selectedFocus');
									_tile.dataset.selectfirst = "true";
									break;
								}
							}

							browser.runtime.sendMessage({
								action: "quickMenuIframeLoaded", 
								size: {
									width: qm.getBoundingClientRect().width,
									height: document.body.getBoundingClientRect().height + "px"
								},
								resizeOnly: true,
								tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight},
								tileCount: siteSearchNode.children.length
							});
							
							document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
						});
					}
					
					break;
				}
				
				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							selectionText: sb.value,
							openMethod: getOpenMethod(e)
						}
					});

					if (typeof addToHistory !== "undefined") addToHistory(sb.value);
				});
				
				tile.dataset.id = node.id;
				tile.dataset.type = 'searchEngine';
				
				break;
		
			case "bookmarklet":

				tile = buildSearchIcon(node.icon || browser.runtime.getURL('/icons/code.svg'), node.title);
				tile.dataset.type = 'bookmarklet';

				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id, // needs work
							selectionText: sb.value,
							openMethod: getOpenMethod(e)
						}
					});
				});

				break;

			case "oneClickSearchEngine":

				tile = buildSearchIcon(node.icon, node.title);
				tile.dataset.type = 'oneClickSearchEngine';
				tile.dataset.id = node.id;

				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: "__oneClickSearchEngine__" + node.id, // needs work
							selectionText: sb.value,
							openMethod: getOpenMethod(e)
						}
					});
				});

				break;

			case "separator":
				tile = document.createElement('hr');
				tile.dataset.type = 'separator';

				break;
		
			case "folder":
				tile = buildSearchIcon( browser.runtime.getURL("/icons/folder-icon.png"), node.title);

				tile.dataset.type = 'folder';
				
				// prevent scroll icon
				tile.addEventListener('mousedown', (e) => {
					
					// skip for dnd events
					if ( e.which === 1 ) return;
					e.preventDefault();
					e.stopPropagation();
				});

				tile.addEventListener('mouseup', openFolder);
				tile.addEventListener('openFolder', openFolder);
					
				function openFolder(e) {
					let method = getOpenMethod(e, true);

					if (method === 'noAction') return;

					if (method === 'openFolder' || e.openFolder) { 
						let quickMenuElement = quickMenuElementFromNodeTree(node);
						
						browser.runtime.sendMessage({
							action: "quickMenuIframeLoaded", 
							size: {
								width: qm.getBoundingClientRect().width,
								height: document.body.getBoundingClientRect().height + "px"
							},
							resizeOnly: true,
							tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight},
							tileCount: qm.querySelectorAll('.tile:not([data-hidden])').length
						});

						document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

						return;
					}

					let messages = [];

					for (let _node of node.children) {

						if (_node.type === 'searchEngine') {
							messages.push(browser.runtime.sendMessage({
								action: "quickMenuSearch", 
								info: {
									menuItemId: _node.id,
									selectionText: sb.value,
								//	when opening method is a new window, only do so on first engine, then open in background
									openMethod: (messages.length === 0 ) ? method : "openBackgroundTab",
									folder: true
								}
							}));
						}	
					}
					
					Promise.all( messages );
				}

				break;
				
			case "siteSearch":

				tile = buildSearchIcon(node.icon, node.title);
				tile.dataset.type = 'siteSearch';
				tile.dataset.id = node.id || "";	
				tile.dataset.title = node.title;

				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.parent.id,
							selectionText: sb.value,
							openMethod: getOpenMethod(e),
							domain: tile.dataset.title
						}
					});
					
					// click the back button
					tile.parentNode.querySelector('.tile').dispatchEvent(new MouseEvent('mouseup'));
				});

				break;
				
			case "bookmark":
				tile = buildSearchIcon(node.icon, node.title);
				tile.dataset.type = 'bookmark';
				tile.dataset.id = node.id || "";	
				tile.dataset.title = node.title;

				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							openMethod: getOpenMethod(e),
						}
					});
				});
				
				break;
		}
		
		tile.node = node;
		
		return tile;
	}

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	setParents(root);

	return Promise.resolve(quickMenuElementFromNodeTree(root));
	
}

function addToHistory(terms) {
	
	terms = terms.trim();
	
	// send last search to backgroundPage for session storage
	browser.runtime.sendMessage({action: "setLastSearch", lastSearch: terms});
	
	// return if history is disabled
	if ( ! userOptions.searchBarEnableHistory ) return;
	
	// ignore duplicates
//	if (userOptions.searchBarHistory.includes(terms)) return;
	
	// remove first entry if over limit
	if (userOptions.searchBarHistory.length === historyLength)
		userOptions.searchBarHistory.shift();
	
	// add new term
	userOptions.searchBarHistory.push(terms);
	
	// update prefs
	browser.runtime.sendMessage({action: "saveUserOptions", "userOptions": userOptions});
}

function getSuggestions(terms, callback) {
		
	let url = 'https://suggestqueries.google.com/complete/search?output=toolbar&hl=' + browser.i18n.getUILanguage() + '&q=' + encodeURIComponent(terms);
	callback = callback || function() {};
	var xmlhttp;

	xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = function()	{
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if(xmlhttp.status == 200) {

				let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'application/xml');
				
				if (parsed.documentElement.nodeName=="parsererror") {
					console.log('xml parse error');
					
					console.log(parsed);
					parsed = false;
				}
				callback(parsed);
		   } else {
			   console.log('Error fetching ' + url);
		   }
		}
	}
	
	xmlhttp.ontimeout = function (e) {
		console.log('Timeout fetching ' + url);
		callback(false);
	};

	xmlhttp.open("GET", url, true);
	xmlhttp.timeout = 500;
	xmlhttp.send();
}

const historyLength = 1024; // number of searches to save in userOptions
const suggestionsCount = 10; // number of total sg to display (browser_action height is limited!)
const suggestionsDisplayCount = 5;

function makeSearchBar() {
	let si = document.getElementById('searchIcon');
	let sb = document.getElementById('searchBar');
	
	si.onclick = function() {
		
		sb.focus();
		
		if ( sg.querySelector('div') ) {
			sg.innerHTML = null;
			//sg.addEventListener('transitionend', resizeMenu);
			sg.style.maxHeight = null;
			resizeMenu();
			return;
		}
		
		sg.innerHTML = null;
		let history = [];
		[...new Set([...userOptions.searchBarHistory].reverse())].slice(0,suggestionsCount).forEach( h => {
			history.push({searchTerms: h, type: 0})
		});
		displaySuggestions(history);
	}

	sb.typeTimer = null;
	sb.placeholder = browser.i18n.getMessage('Search');

	browser.runtime.sendMessage({action: "getLastSearch"}).then((message) => {
		
		// skip empty 
		if (!message.lastSearch || !userOptions.searchBarDisplayLastSearch) return;
		
		sb.value = message.lastSearch;
		sb.select();

		// workaround for linux 
		var selectInterval = setInterval( () => {

			if (getSelectedText(sb) == sb.value)
				clearInterval(selectInterval);
			else
				sb.select();
		}, 50);

	});
	
	columns = (userOptions.searchBarUseOldStyle) ? 1 : userOptions.searchBarColumns;
	
	function displaySuggestions(suggestions) {
		
		browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: sb.value});
				
		suggestions = suggestions.sort(function(a,b) {
			return a.searchTerms - b.searchTerms;
		});
		
		for (let s of suggestions) {
			let div = document.createElement('div');
			div.style.height = "20px";
			div.onclick = function() {
				let selected = sg.querySelector('.selectedFocus');
				if (selected) selected.classList.remove('selectedFocus');
				this.classList.add('selectedFocus');
				sb.value = this.innerText;
			}
			
			div.ondblclick = function() {
				var e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, keyCode: 13});
				sb.dispatchEvent(e);
			}
			
			let img = document.createElement("img");
			img.src = "/icons/history.png";
			img.title = browser.i18n.getMessage('History') || "history";
			
			if (s.type === 1) img.style.visibility = 'hidden';
			div.appendChild(img);
								
			// put search terms in bold
			// let matches = new RegExp("^(.*)(" + sb.value + ")(.*)").exec(s.searchTerms);
			// //browser.runtime.sendMessage({action: "log", msg: matches});

			// for (let i=1;i<matches.length;i++) {
				// let part = matches[i];
				// let el = null;
				// if (!part) continue;
				// else if (part === sb.value) {
					// el = document.createElement('b');
					// el.innerText = sb.value;
					// el.style.fontWeight = '600';
				// } else  {
					// el = document.createTextNode(part);
				// }

				// div.appendChild(el);
			// }

			let text = document.createTextNode(s.searchTerms);
			div.appendChild(text);
			
//					div.innerHTML = div.innerText.replace(sb.value, "<b>" + sb.value + "</b>");
			sg.appendChild(div);
		}
		
		sg.style.width = sb.parentNode.getBoundingClientRect().width + "px";

		sg.addEventListener('transitionend', (e) => {

			// for browser_action
			// reset the menu height for window resizing
			// document.getElementById('quickMenuElement').style.height = null;

			resizeMenu();
		});
		
		let sg_height = suggestions.length ? sg.firstChild.getBoundingClientRect().height : 0;
		
		sg.style.maxHeight = Math.min(sg_height * suggestionsDisplayCount, suggestions.length * sg_height) + "px";

	}
		
	sb.onkeypress = function(e) {
		
		clearTimeout(sb.typeTimer);
		
		sb.typeTimer = setTimeout(() => {
			
			if (!sb.value.trim()) {
				sg.style.maxHeight = null;
				return;
			}

			sg.innerHTML = null;
			
			let history = [];
			let lc_searchTerms = sb.value.toLowerCase();
			for (let h of userOptions.searchBarHistory) {
				if (h.toLowerCase().indexOf(lc_searchTerms) === 0)
					history.push({searchTerms: h, type: 0});
				
				if (history.length === suggestionsCount) break;
			}

			if (userOptions.searchBarSuggestions) {
				getSuggestions(sb.value, (xml) => {
					
					let suggestions = [];
					for (let s of xml.getElementsByTagName('suggestion')) {
						let searchTerms = s.getAttribute('data');
						
						let found = false;
						for (let h of history) {
							if (h.searchTerms.toLowerCase() === searchTerms.toLowerCase()) {
								found = true;
								break;
							}
						}
						if (!found)
							suggestions.push({searchTerms: searchTerms, type: 1});
					}

					suggestions = history.concat(suggestions);
					
					displaySuggestions(suggestions);
					
				});
			} else if ( userOptions.searchBarEnableHistory )
				displaySuggestions(history);
			
		}, 500);
	}
	
	sb.onkeydown = function(e) {
		if (e.keyCode === 13) {
			
			addToHistory(sb.value);
			
			if (userOptions.searchBarCloseAfterSearch) window.close();	
		}
	}
	
	// add titleBar & options button functions after menu is loaded
	document.addEventListener('quickMenuIframeLoaded', () => {

		let titleBar = document.getElementById('titleBar');
		document.querySelectorAll('.tile').forEach( div => {
			div.onmouseenter = () => titleBar.innerText = div.title;
			div.onmouseleave = () => titleBar.innerText = ' ';
		});

		ob.onclick = function() {
			// document.body.style.visibility = 'hidden';
			browser.runtime.sendMessage({action: "openOptions"});
			if ( window == top ) window.close();
		}
	});
}
