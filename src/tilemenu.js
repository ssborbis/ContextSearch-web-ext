var qm = document.getElementById('quickMenuElement');
var sb = document.getElementById('searchBar');
// var tb = document.getElementById('titleBar');
var sg = document.getElementById('suggestions');
var ob = document.getElementById('optionsButton');
var mb = document.getElementById('menuBar');

var type;

//#Source https://bit.ly/2neWfJ2 
const every_nth = (arr, nth) => arr.filter((e, i) => i % nth === nth - 1);

var moreLessStatus = [];

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

function saveUserOptions() {
	return browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
}

// generic search engine tile
function buildSearchIcon(icon_url, title) {
	var div = document.createElement('DIV');

	if ( icon_url )	div.style.backgroundImage = 'url("' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + '")';
	div.style.setProperty('--tile-background-size', 16 * userOptions.quickMenuIconScale + "px");
	div.title = title;
	return div;
}

function setToolIconColor(_toolTile) {
	
	let bg = _toolTile.style.getPropertyValue("background-image");
	
	let img = new Image();
	let fixedbg = bg.replace(/^url\("(.*)"\)/, '$1');

	let color = window.getComputedStyle(document.documentElement).getPropertyValue('--tools-color');

	img.onload = () => {

		var canvas=document.createElement("canvas");
		var ctx=canvas.getContext("2d");
		ctx.canvas.width = img.width;
		ctx.canvas.height = img.height;
		ctx.save();
		
		// draw the shape we want to use for clipping
		ctx.drawImage(img, 0, 0);

		// change composite mode to use that shape
		ctx.globalCompositeOperation = 'source-in';

		// draw the image to be clipped
		// ctx.drawImage(img, 0, 0);

		ctx.beginPath();
		ctx.rect(0, 0, img.width, img.height);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.restore();
		
		let newbg = canvas.toDataURL("image/png");
		_toolTile.style.backgroundImage = `url(${newbg})`;
	}
	
	img.src = fixedbg;
}

// function setToolIconColor(_toolTile) {
	
	// let div = document.createElement('div');
	// let bg = _toolTile.style.getPropertyValue("background-image");
	
	// // _toolTile.style.setProperty("background-image", "none");
	// // _toolTile.style.setProperty("background-color", "var(--tools-color)");
	// // _toolTile.style.setProperty("-webkit-mask", `${bg} no-repeat center`);
	// // _toolTile.style.setProperty("mask", `${bg} no-repeat center`);
	// // _toolTile.style.setProperty("mask-size","var(--tile-background-size, 16px)");
	// // _toolTile.style.setProperty("-webkit-mask-size","var(--tile-background-size, 16px)");
	
	// div.style.setProperty("background-image", "none");
	// div.style.setProperty("background-color", "var(--tools-color)");
	// div.style.setProperty("-webkit-mask", `${bg} no-repeat center`);
	// div.style.setProperty("mask", `${bg} no-repeat center`);
	// div.style.setProperty("mask-size","var(--tile-background-size, 16px)");
	// div.style.setProperty("-webkit-mask-size","var(--tile-background-size, 16px)");
	
	// div.style.width = '100%';
	// div.style.height = '100%';
	
	// _toolTile.appendChild(div);
// }

function setTheme() {
	let d = document.head.querySelector('#dark');
	let stylesheet = d.sheet || d.styleSheet;
	stylesheet.disabled = ( userOptions.quickMenuTheme !== 'dark' );
}

function setUserStyles() {
	if ( userOptions.userStylesEnabled ) {
		// Append <style> element to <head>
		var styleEl = document.createElement('style');
		document.head.appendChild(styleEl);
		styleEl.innerText = userOptions.userStyles;
		
		document.body.getBoundingClientRect();
	}
}

// method for assigning tile click handler
function addTileEventHandlers(_tile, handler) {

	// all click events are attached to mouseup
	_tile.addEventListener('mouseup', async e => {

		if ( _tile.disabled ) return false;
		
		// if ( userOptions.autoCopy /*copypaste*/) {
			// browser.runtime.sendMessage({action: "copy", msg: sb.value});
		// }

		// check if this tile was target of the latest mousedown event
		if ( !userOptions.quickMenuSearchOnMouseUp && !_tile.isSameNode(_tile.parentNode.lastMouseDownTile)) return;

		// prevents unwanted propagation from triggering a parentWindow.click event call to closequickmenu
		quickMenuObject.mouseLastClickTime = Date.now();
		
		if ( _tile.dataset.id && quickMenuObject.lastUsed !== _tile.dataset.id ) {
			// // store the last used id
			quickMenuObject.lastUsed = _tile.dataset.id || null;
			userOptions.lastUsedId = quickMenuObject.lastUsed;
			
			document.dispatchEvent(new CustomEvent('updateLastUsed'));
			
			// browser.runtime.sendMessage({action: "setLastUsed", id: userOptions.lastUsedId});
		}

		quickMenuObject.searchTerms = sb.value;
		browser.runtime.sendMessage({
			action: "updateQuickMenuObject", 
			quickMenuObject: quickMenuObject
		});

		// custom tile methods
		handler(e);
		
		// check for locked / Keep Menu Open 
		if ( !keepMenuOpen(e) && !_tile.keepOpen )
			closeMenuRequest();
	});
	
	// prevent triggering click event accidentally releasing mouse button when menu is opened by HOLD method
	_tile.addEventListener('mousedown', e => _tile.parentNode.lastMouseDownTile = _tile);
	
	// stop all other mouse events for this tile from propagating
	[/*'mousedown',*/'mouseup','click','contextmenu'].forEach( eventType => {
		_tile.addEventListener(eventType, e => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	});
	
	// allow dnd with left-button, ignore other events
	_tile.addEventListener('mousedown', e => {
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

function keepMenuOpen(e, isFolder) {
	
	isFolder = isFolder || false;
	
	if ( /KeepOpen$/.test(getOpenMethod(e, isFolder)) ) return true;
	
	if (
		!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
		!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
		!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen")
	) 
		return false;
	else 
		return true;
}

async function makeQuickMenu(options) {

	type = options.type;
	let mode = options.mode;

	let singleColumn = options.singleColumn;
	
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
	sb.onclick = function(e) { e.stopPropagation();	}
	sb.onmouseup = e => { e.stopPropagation(); }
	
	let sbc = document.getElementById('searchBarContainer');
	
	// replace / append dragged text based on timer
	sb.addEventListener('dragenter', e => {
		sb.select();
		sb.hoverTimer = setTimeout(() => {
			sb.selectionStart = sb.selectionEnd = 0;
			sb.hoverTimer = null;
		},1000);
	});
	sb.addEventListener('drop', e => {
		if (sb.hoverTimer) {
			sb.value = "";	
			clearTimeout(sb.hoverTimer);
		}
	});
	
	sb.addEventListener('change', e => browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: sb.value}));
	
	let csb = document.getElementById('clearSearchBarButton');
	csb.onclick = function() { 
		sb.value = null;
		sb.focus();
	};
	csb.title = browser.i18n.getMessage('delete').toLowerCase();
	
	qm.toggleDisplayMode = async() => {
		qm.rootNode.displayType = function() {
			if ( qm.singleColumn && !qm.rootNode.displayType ) return "grid";
			if ( !qm.singleColumn && !qm.rootNode.displayType ) return "text";
			return "";
		}();
		
		userOptions.nodeTree = JSON.parse(JSON.stringify(root));		
		saveUserOptions();
		
		qm = await quickMenuElementFromNodeTree( qm.rootNode, false );
		
		qm.insertBreaks();

		resizeMenu({toggleSingleColumn: true});
	}
	
	qm.addTitleBarTextHandler = div => {
		
		let tb = document.getElementById('titleBar');
		['mouseenter','dragenter'].forEach( ev => {
			div.addEventListener(ev, () => tb.innerText = div.title || div.dataset.title)
		});
		
		div.addEventListener('mouseleave', () => tb.innerText = '');
	}
	
	// folder styling hotkey
	document.addEventListener('keydown', e => {
		if (e.key === "." && e.ctrlKey) {
			
			e.preventDefault();

			qm.toggleDisplayMode();
		}	
	});
	
	// enter key invokes search
	document.addEventListener('keydown', e => {
		if (e.key === "Enter") {

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
	document.addEventListener('keydown', e => {

		if (!userOptions.quickMenuSearchHotkeys || userOptions.quickMenuSearchHotkeys === 'noAction') return;

		// ignore hotkeys when the search bar is being edited
		if (document.activeElement === sb) return;

		let hotkeyNode = findNode(userOptions.nodeTree, node => node.hotkey === e.which);

		if (!hotkeyNode) return;
		
		browser.runtime.sendMessage({
			action: "quickMenuSearch", 
			info: {
				menuItemId: hotkeyNode.id,
				selectionText: sb.value,
				openMethod: userOptions.quickMenuSearchHotkeys
			}
		});
		
		if ( !keepMenuOpen(e) )
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});

		if (type === 'searchbar' && userOptions.searchBarCloseAfterSearch) window.close();

	});
	
	qm.selectFirstTile = () => {
		let firstTile = qm.querySelector('.tile:not([data-hidden])');
		firstTile.classList.add('selectedFocus');
		sb.selectedIndex = [].indexOf.call(qm.querySelectorAll(".tile"), firstTile);
	}

	sb.addEventListener('keydown', e => {

		if ( ![ "ArrowUp", "ArrowDown", "Tab" ].includes(e.key) ) return;
		
		e.preventDefault();
		
		let direction = ( e.key === "ArrowDown" || ( e.key === "Tab" && !e.shiftKey) ) ? 1 : -1;

		sb.selectionEnd = sb.selectionStart;
		
		// move focus to sg 
		if ( direction === 1 && sg ) {

			let rows = sg.getElementsByTagName('div');
			
			if ( rows.length > 0 && e.key === "ArrowDown" ) { // only down arrow moves to sg

				// check if a suggestion is selected already
				let currentSelection = sg.querySelector('.selectedFocus');
				
				if ( currentSelection ) currentSelection.click();				
				else rows.item(0).click();
				
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
			sb.selectedIndex = [...qm.querySelectorAll('.tile')].indexOf( selectedDiv )
		}
	});
	
	if (sg) {
		sg.addEventListener('keydown', e => {
			
			if ( e.key === "Delete" ) return;

			// not move key means append search terms in search bar
			if ( ![ "ArrowUp", "ArrowDown", "Tab", "Delete" ].includes(e.key) ) {
				sb.focus();
				sb.selectionStart = sb.selectionEnd = sb.value.length;
				return;
			}
			
			// prevent default action (scroll)
			e.preventDefault();
			
			if (e.key === "Tab" && !e.shiftKey) {
				qm.focus();
				qm.selectFirstTile();
				return;
			}
	
			let direction = (e.key === "ArrowDown") ? 1 : -1;
			
			let divs = sg.getElementsByTagName('div');

			let currentIndex = [...divs].findIndex( div => div.classList.contains( "selectedFocus" ) );

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
	
	qm.addEventListener('keydown', e => {
		
		// account for custom folders
		let _columns = qm.querySelector('div').classList.contains('singleColumn') ? 1 : qm.columns;

		if ( ![ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab" ].includes(e.key) ) return;
		
		e.preventDefault();

		let direction = 0;
		if (e.key === "Tab" && !e.shiftKey)
			direction = 1;
		else if (e.key === "Tab" && e.shiftKey)
			direction = -1;
		else if (e.key === "ArrowDown")
			direction = _columns;
		else if (e.key === "ArrowUp")
			direction = -_columns;
		else if (e.key === "ArrowRight")
			direction = 1; 
		else if (e.key === "ArrowLeft")
			direction = -1;

		// get all tiles
		let divs = qm.querySelectorAll('.tile');

		// clear current selection
		if (sb.selectedIndex !== undefined)
			divs[sb.selectedIndex].classList.remove('selectedFocus');

		if (
			(e.key === "Tab" && e.shiftKey && sb.selectedIndex === undefined) ||
			(e.key === "ArrowUp" && sb.selectedIndex === undefined)
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

	document.addEventListener('updatesearchterms', e => {
		sb.value = quickMenuObject.searchTerms.replace(/[\r|\n]+/g, " ");
	});

	// prevent click events from propagating
	[/*'mousedown',*/ 'mouseup', 'click', 'contextmenu'].forEach( eventType => {
		qm.addEventListener(eventType, e => {
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
			if ( _tool ) {
				
				toolsArray.push(_tool.init());
			
				toolsArray[toolsArray.length - 1].context = _tool.context;
				toolsArray[toolsArray.length - 1].tool = _tool;
				
				if ( ! toolsArray[toolsArray.length - 1].dataset.nocolorinvert ) {
					setToolIconColor(toolsArray[toolsArray.length - 1]);
				}

			}

		});

		toolsArray.forEach( tool => {
			tool.dataset.type = 'tool';
			tool.dataset.title = tool.title;
			tool.classList.add('tile');

			if ( tool.context && !tool.context.includes(type) ) {
				tool.disabled = true;
				tool.dataset.disabled = true;
				// tool.style.backgroundImage = 'url(' + browser.runtime.getURL('icons/disabled.svg') + ')';
			}
		});

		let getDragDiv = () => {return document.getElementById('dragDiv')};
		let isTool = e => e.dataTransfer.getData("text") === "tool";
		
		toolsArray.forEach( tool => {
			
			tool.setAttribute('draggable', userOptions.quickMenuTilesDraggable);

			tool.addEventListener('dragstart', e => {
				e.dataTransfer.setData("text", "tool");
				let img = new Image();
				img.src = browser.runtime.getURL('icons/transparent.gif');
				e.dataTransfer.setDragImage(img, 0, 0);
				tool.id = 'dragDiv';
				
				qm.querySelectorAll('.tile:not([data-type="tool"])').forEach( _tile => _tile.classList.add('dragDisabled') );
			});
			tool.addEventListener('dragenter', e => {
				e.preventDefault();
				if ( !isTool(e) ) return;
			});
			tool.addEventListener('dragover', e => {
				e.preventDefault();
				
				if ( !isTool(e) ) return;
			});
			tool.addEventListener('dragend', e => {
				qm.querySelectorAll('.tile:not([data-type="tool"])').forEach( _tile => _tile.classList.remove('dragDisabled') );				
			});
			tool.addEventListener('drop', e => {	
				e.preventDefault();
				
				if ( !isTool(e) ) return;
				
				let side = getSide(tool, e);
				
				let qmt = userOptions.quickMenuTools;
				
				dragName = getDragDiv().tool.name;
				targetName = e.target.tool.name;
				
				dragIndex = qmt.findIndex( t => t.name === dragName );
				targetIndex = qmt.findIndex( t => t.name === targetName );

				if ( side === "before" ) 
					qmt.splice( targetIndex, 0, qmt.splice(dragIndex, 1)[0] );
				else
					qmt.splice( targetIndex + 1, 0, qmt.splice(dragIndex, 1)[0] );
				
				saveUserOptions();
			
				// rebuild menu
				toolsArray.forEach( _tool => _tool.parentNode.removeChild(_tool) );
				qm.toolsArray = createToolsArray();
				toolsHandler();
				qm.expandMoreTiles();
				resizeMenu({tileDrop: true});
			});
		});
		
		toolsArray.forEach( div => qm.addTitleBarTextHandler(div));

		return toolsArray;
	}
	
	qm.toolsArray = createToolsArray();

	qm.insertBreaks = function insertBreaks(_columns) {
		
		_columns = _columns || qm.columns;

		qm.querySelectorAll('br:not(.groupBr)').forEach( br => qm.removeChild(br) );
		
		let count = 1;
		qm.querySelectorAll('.tile:not([data-hidden="true"])').forEach( tile => {
			if ( tile.nodeName === "BR" ) 
				count = 0;
			
			if ( count === _columns ) {
				tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);
				count = 0;
			}
			
			count++;
		});

		// every_nth([ ...qm.querySelectorAll('.tile:not([data-hidden="true"])')], _columns).forEach( tile => {
			// tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);
		// });
	}
	
	function buildQuickMenuElement(options) {
		
		let _singleColumn = options.forceSingleColumn || options.node.displayType === "text" || singleColumn;
		
		if ( options.node.displayType === "grid" ) _singleColumn = false;
		
		let _columns = _singleColumn ? 1 : getColumns();
	
		let tileArray = options.tileArray;

		qm.innerHTML = null;

		// initialize slide-in animation
		qm.style.position = 'relative';
		qm.style.visibility = 'hidden';
		qm.style.transition = 'none';
		
		qm.columns = _columns;
	
		// remove separators if using grid
		if (!_singleColumn) tileArray = tileArray.filter( tile => tile.dataset.type !== 'separator' );
	
		qm.singleColumn = _singleColumn;
			
		// make rows / columns
		tileArray.forEach( tile => {
			
			tile.classList.add('tile');

			if (_singleColumn) tile.classList.add("singleColumn");
			
			if ( !_singleColumn && tile.node && tile.node.type === 'folder' && tile.dataset.type === 'folder' )
				tile.style.backgroundImage = 'url(' + browser.runtime.getURL('icons/transparent.gif') + ')';
			
			qm.appendChild(tile);
		});
		
		qm.getTileSize = () => { 

			let div = document.createElement('div');
			div.className = "tile";
			
			if ( qm.singleColumn ) div.classList.add('singleColumn');
			qm.appendChild(div);
			
			let rect = div.getBoundingClientRect();
			qm.removeChild(div);

			return {width: rect.width, height: rect.height};
		};
		
		qm.setDisplay = () => {
			qm.querySelectorAll('.tile').forEach( _tile => {
				if (qm.singleColumn || qm.rootNode.displayType === "text" ) _tile.classList.add("singleColumn");
				else _tile.classList.remove("singleColumn");
			});
			
			qm.insertBreaks();
		}

		// check if any search engines exist and link to Options if none
		if (userOptions.nodeTree.children.length === 0 && userOptions.searchEngines.length === 0 ) {
			var div = document.createElement('div');
			div.style='width:auto;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
			div.innerText = browser.i18n.getMessage("WhereAreMyEngines");
			div.onclick = function() {
				browser.runtime.sendMessage({action: "openOptions", hashurl: "#engines"});
			}	
			qm.appendChild(div);
		}

		// set min-width to prevent menu shrinking with smaller folders
		qm.setMinWidth = () => { qm.style.minWidth = qm.columns * qm.getTileSize().width + "px"; }	
		qm.setMinWidth();

		// slide-in animation
		if ( !userOptions.enableAnimations ) qm.style.setProperty('--user-transition', 'none');
		qm.style.left = qm.getBoundingClientRect().width * ( options.reverse ? -1 : 1 ) + "px";
		void( qm.offsetHeight );
		qm.style.transition = null;
		qm.style.visibility = null;
		qm.style.left = '0px';
		
		function getGroupFolderSiblings(div) {
			return [ ...qm.querySelectorAll('.groupFolder')].filter( el => el.node && el.node.parent === div.node.parent);
		}
		
		function isTool(e) {
			return ( e.dataTransfer.getData("text") === "tool" );
		}

		/* dnd */
		let tileDivs = qm.querySelectorAll('.tile:not([data-type="tool"])');
		tileDivs.forEach( div => {

			div.setAttribute('draggable', userOptions.quickMenuTilesDraggable);
	
			// group move
			if ( div.classList.contains("groupFolder") ) {
				div.addEventListener('mousedown', function holdListener(e) {
					if ( e.which !== 1) return;
					
					let holdTimeout = setTimeout(() => {
						div.groupMove = true;
						div.disabled = true;
						
						let groupDivs = getGroupFolderSiblings(div);
						
						groupDivs.forEach( _div => _div.classList.add('groupMove'));

						div.addEventListener('mouseup', _e => {
							groupDivs.forEach( _div => _div.classList.remove('groupMove'));	
							setTimeout(() => div.disabled = false, 100);
						});
						
						
					}, 1000);
					
					div.addEventListener('mousemove', () => clearTimeout(holdTimeout));
					div.addEventListener('mouseup', () => clearTimeout(holdTimeout));
				});
				
			}

			div.addEventListener('dragstart', e => {
				e.dataTransfer.setData("text", "");
				let img = new Image();
				img.src = browser.runtime.getURL('icons/transparent.gif');
				e.dataTransfer.setDragImage(img, 0, 0);
				div.id = 'dragDiv';
				div.style.opacity = .5;
			});
			div.addEventListener('dragover', e => {
				e.preventDefault();
				
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv || isTool(e) ) return;
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
					
					if ( targetDiv.classList.contains("groupFolder") && !targetDiv.classList.contains('groupMove') ) {
						
						let dec = getSideDecimal(targetDiv, e);
						
						let targetGroupDivs = getGroupFolderSiblings(targetDiv);

						if ( isTargetBeforeGroup(targetDiv, dec) ) 
							targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
						else if ( isTargetAfterGroup(targetDiv, dec) ) 
							targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
						else
							targetGroupDivs.forEach( el => el.classList.add("groupHighlight") );
					}
				}
			});
			div.addEventListener('dragenter', e => {

				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv || isTool(e) ) return;

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
					arrow.className = ( qm.singleColumn ) ? 'singleColumn' : null;
					
					arrow.id = 'arrow';
					arrow.style.top = targetDiv.getBoundingClientRect().top + "px";
					arrow.style.display = null;
				}
			});
			div.addEventListener('dragleave', e => {
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv || isTool(e) ) return;

				targetDiv.classList.remove('dragHover');
				targetDiv.style.transition = null;
				
				delete targetDiv.dataset.side;
				
				if ( targetDiv.textDragOverFolderTimer )
					clearTimeout(targetDiv.textDragOverFolderTimer);
				
				let arrow = document.getElementById('arrow');
				if ( arrow ) arrow.style.display = 'none';
				
				getGroupFolderSiblings(targetDiv).forEach( el => el.classList.remove('groupHighlight') );
			});
			div.addEventListener('dragend', async e => {
				
				if ( isTool(e) ) return;

				let dragDiv = document.getElementById('dragDiv');
				
				if ( dragDiv ) {
					dragDiv.style.opacity = null;
					dragDiv.id = "";
				}

				let targetDiv = getTargetElement(e.target);
				if ( targetDiv ) targetDiv.classList.remove('dragHover');

				let arrow = document.getElementById('arrow');
				if ( arrow ) arrow.style.display = 'none';

				// store scroll position
				let scrollPos = qm.scrollTop;
				
				let animation = userOptions.enableAnimations;
				userOptions.enableAnimations = false;
				await quickMenuElementFromNodeTree(qm.rootNode);
				userOptions.enableAnimations = animation;

				qm.expandMoreTiles();
				
				qm.scrollTop = scrollPos;

				resizeMenu({tileDrop: true});
				
			});
			
			div.addEventListener('drop', e => {
				e.preventDefault();
				
				if ( isTool(e) ) return;
				
			//	console.log(e.dataTransfer, e.dataTransfer.getData("text/html"), e.dataTransfer.getData("text/x-moz-place"), e.dataTransfer.getData("text/x-moz-url"));
			
				// console.log(e, e.dataTransfer);
				// console.log(e.dataTransfer.getData("text"));
				
				let targetDiv = getTargetElement(e.target);
				targetDiv.classList.remove('dragHover');

				// look for text dnd
				if ( e.dataTransfer.getData("text") && !e.dataTransfer.getData("text/x-moz-place") ) {
					e.preventDefault();
					sb.value = e.dataTransfer.getData("text");
					div.parentNode.lastMouseDownTile = div;
					div.dispatchEvent(new MouseEvent('mouseup'));
					return;
				}

				let dragDiv = document.getElementById('dragDiv');

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

						img.onload = () => {
							dragDiv.node.icon = imageToBase64(img, 32);
							dragDiv.style.backgroundImage = `url(${dragDiv.node.icon})`;
							
							setTimeout(() => {
								userOptions.nodeTree = JSON.parse(JSON.stringify(root));
								saveUserOptions();
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
				if ( dragDiv.groupMove && targetDiv.node.parent === dragDiv.node.parent ) {
					console.error('cannot group move within parent');
					return;
				}
				
				let dragNode = ( dragDiv.groupMove) ? dragDiv.node.parent : dragDiv.node;
				let targetNode = targetDiv.node;

				// cut the node from the children array
				let slicedNode = dragNode.parent.children.splice(dragNode.parent.children.indexOf(dragNode), 1).shift();

				let side = getSide(targetDiv, e);
	
				if ( targetDiv.classList.contains("groupFolder") ) {
					
					let dec = getSideDecimal(targetDiv, e);
					
					if ( isTargetBeforeGroup(targetDiv, dec) ) {
						
						console.log('moving before group');
						slicedNode.parent = targetNode.parent.parent;
						slicedNode.parent.children.splice(slicedNode.parent.children.indexOf(targetNode.parent),0,slicedNode);
						
						_save();
						return;
					} else if ( isTargetAfterGroup(targetDiv, dec) ) {
						
						console.log('moving after group');
						slicedNode.parent = targetNode.parent.parent;
						slicedNode.parent.children.splice(slicedNode.parent.children.indexOf(targetNode.parent) + 1,0,slicedNode);
						
						_save();
						return;
					}
					
					if ( targetDiv.dataset.type && ['more','less'].includes(targetDiv.dataset.type) ) {
						
						console.log('drop to more / less tile ... appending tile to group');
						slicedNode.parent = targetNode.parent;
						slicedNode.parent.children.push(slicedNode);
						
						_save();
						return;
					}
				}

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
				
				_save();
				
				function _save() {
					// save the tree
					userOptions.nodeTree = JSON.parse(JSON.stringify(root));
					saveUserOptions();
				}
			});
			
		});
		
		/* end dnd */

		toolsHandler(qm);

		qm.querySelectorAll('.tile').forEach( div => qm.addTitleBarTextHandler(div));

		qm.expandMoreTiles = () => {
			let moreTiles = [...qm.querySelectorAll('[data-type="more"]')];

			moreLessStatus.forEach( id => {
				let moreTile = moreTiles.find( div => div.dataset.parentid === id );
				
				if ( moreTile ) moreTile.dispatchEvent(new MouseEvent("mouseup"));
			});
		}
		
		qm.expandMoreTiles();

		return qm;
	}

	async function quickMenuElementFromNodeTree( rootNode, reverse ) {

		reverse = reverse || false; // for slide-in animation direction
		
		let nodes = rootNode.children;
		let tileArray = [];
		
		// update the qm object with the current node
		qm.rootNode = rootNode;
		
		if ( userOptions.syncWithFirefoxSearch ) {	
			nodes = [];
			qm.rootNode = Object.assign({}, qm.rootNode);
			let ffses = await browser.runtime.sendMessage({action: "getFirefoxSearchEngines"});
			
			ffses.forEach( ffse => {
				let node = findNode( userOptions.nodeTree, n => n.title === ffse.name );
				
				if ( !node ) {
					console.log("couldn't find node for " + ffse.name);
					return;
				}
				
				node.parent = qm.rootNode;
				
				nodes.push(node);
			});
			
			qm.rootNode.children = nodes;
			
			rootNode = qm.rootNode;
		}
		
		// set the lastOpenedFolder object
		browser.runtime.sendMessage({action: "setLastOpenedFolder", folderId: rootNode.id});
		
		if (rootNode.parent) { // if parentId was sent, assume subfolder and add 'back' button

			let tile = buildSearchIcon(browser.runtime.getURL('/icons/back.svg'), browser.i18n.getMessage('back'));
			
			tile.dataset.type = "tool";
			tile.node = rootNode.parent;
			
			tile.addEventListener('mouseup', _back);
			tile.addEventListener('openFolder', _back);

			addOpenFolderOnHover(tile);
			
			setToolIconColor(tile);
			
			async function _back(e) {

				// back button rebuilds the menu using the parent folder ( or parent->parent for groupFolders )
				let quickMenuElement = await quickMenuElementFromNodeTree(( rootNode.parent.groupFolder ) ? rootNode.parent.parent : rootNode.parent, true);

				resizeMenu({openFolder: true});
			}
			
			tile.addEventListener('dragenter', e => {
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
			tile.addEventListener('dragleave', e => clearTimeout(tile.textDragOverFolderTimer));
			tile.addEventListener('dragover', e => e.preventDefault());
			tile.addEventListener('dragend', e => e.preventDefault());
			tile.addEventListener('drop', async e => {
				e.preventDefault();
				
				let dragDiv = document.getElementById('dragDiv');
				
				if ( !dragDiv || !dragDiv.node ) return;
				
				dragDiv.parentNode.removeChild(dragDiv);
				
				dragDiv.id = null;

				let dragNode = ( dragDiv.groupMove ) ? dragDiv.node.parent : dragDiv.node;
				let targetNode = tile.node;
				
				let slicedNode = dragNode.parent.children.splice(dragNode.parent.children.indexOf(dragNode), 1).shift();
				
				slicedNode.parent = targetNode;
					
				// add to target children
				targetNode.children.push(slicedNode);
				
				// save the tree
				userOptions.nodeTree = JSON.parse(JSON.stringify(root));
				
				saveUserOptions();
				
				// rebuild menu
				let animation = userOptions.enableAnimations;
				userOptions.enableAnimations = false;
				await quickMenuElementFromNodeTree(rootNode);
				userOptions.enableAnimations = animation;
				resizeMenu();				
			});
			
			delete sb.selectedIndex;
			tileArray.push(tile);
		}
		
		function makeMoreLessFromTiles( _tiles, limit ) {

			function addSeparators() {
				_tiles.unshift( nodeToTile( {type: "separator"}) );
				_tiles.push( nodeToTile( {type: "separator"}) );
			}
			
			let firstTile = _tiles.find( _tile => _tile.node );
			
			if ( !firstTile ) return _tiles;
			
			let node = firstTile.node.parent;
			
			if (!node) return _tiles;
			
			if ( !node.id ) node.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
			
			let label = nodeToTile( node );
			label.style.setProperty("--group-color", node.groupColor || null);
			label.classList.add("groupFolder");
			label.style.textAlign='center';
			_tiles.unshift( label );

			if ( !limit || limit >= _tiles.length ) {
				addSeparators();
				return _tiles;
			}

			let moreTile = buildSearchIcon(browser.runtime.getURL('/icons/add.svg'), browser.i18n.getMessage('more'));
			setToolIconColor(moreTile);

			moreTile.style.textAlign='center';
			moreTile.dataset.type = "more";
			moreTile.dataset.title = moreTile.title = browser.i18n.getMessage("more");
			moreTile.style.setProperty("--group-color",node.groupColor);
			moreTile.classList.add("groupFolder");
			moreTile.node = { parent: node };
			moreTile.dataset.parentid = node.id;
			
			moreTile.ondragstart = moreTile.ondragover = moreTile.ondragenter = moreTile.ondragend = moreTile.ondragleave = () => { return false; }
			moreTile.setAttribute('draggable', false);
			
			function more() {
				qm.querySelectorAll('.tile[data-hidden="true"]').forEach( _div => {

					// ignore divs not associated with this more tile
					if ( _div.moreTile !== moreTile ) return;
					
					_div.dataset.hidden = "false";
					_div.style.display = null;
				});
				
				qm.insertBreaks();	
				moreTile.onmouseup = less;	
				moreTile.dataset.title = moreTile.title = browser.i18n.getMessage("less");
				moreTile.dataset.type = "less";
				moreTile.style.backgroundImage = `url(${browser.runtime.getURL('icons/crossmark.svg')}`;
				setToolIconColor(moreTile);
				resizeMenu({groupMore: true});
	
				if ( !moreLessStatus.includes( node.id ) )
					moreLessStatus.push(node.id);
			}
			
			function less() {
				qm.querySelectorAll('.tile[data-hidden="false"]').forEach( _div => {

					// ignore divs not associated with this more tile
					if ( _div.moreTile !== moreTile ) return;
					
					_div.dataset.hidden = "true";
					_div.style.display = "none";
				});
				
				qm.insertBreaks();
				moreTile.onmouseup = more;
				moreTile.dataset.title = moreTile.title = browser.i18n.getMessage("more");
				moreTile.dataset.type = "more";
				moreTile.style.backgroundImage = `url(${browser.runtime.getURL('icons/add.svg')}`;
				setToolIconColor(moreTile);
				resizeMenu({groupLess: true});
				
				moreLessStatus = moreLessStatus.filter( id => id !== moreTile.dataset.parentid );
			}

			moreTile.onmouseup = more;
			
			moreTile.expandTimerStart = () => { moreTile.expandTimer = setTimeout( moreTile.dataset.type === "more" ? more : less, 1500 )};	
			
			moreTile.addEventListener('dragenter', e => {
				moreTile.expandTimerStart();
			
				['dragleave', 'drop', 'dragexit', 'dragend'].forEach( _e => { moreTile.addEventListener(_e, () => clearTimeout(moreTile.expandTimer), {once: true}); } );
			});

			let count = 1;
			_tiles.forEach( ( _tile, index ) => {
				
				if ( _tile.dataset.hidden == "true" || _tile.style.display === 'none' ) {
					return false;
				}

				if ( count > limit ) {
					_tiles[index].dataset.hidden = true;
					_tiles[index].style.display = 'none';
					_tiles[index].dataset.grouphidden = true;
					_tiles[index].moreTile = moreTile;
					
					// console.log('hiding tile ' + _tiles[index].title);
				} else {
					// console.log('showing tile ' + _tiles[index].title);
				}
				
				count++;
			});

			if ( userOptions.groupLabelMoreTile && node !== qm.rootNode) {
				
				moreTile.classList.remove('tile');
				moreTile.classList.add('groupLabelMoreTile');
				
				['mouseup', 'click'].forEach( _e => {
					moreTile.addEventListener(_e, e => e.stopPropagation() );
				});
				
				if ( !node.groupHideMoreTile ) label.appendChild(moreTile);
				
			} else {
				if ( !node.groupHideMoreTile ) _tiles.push( moreTile );
			}

			addSeparators();

			return _tiles;
		}
	
		function makeGroupTilesFromNode( node ) {
			let tiles = [];
			
			node.children.forEach( _node => {
				let _tile = nodeToTile(_node);
				
				if ( !_tile ) return;
				
				_tile.style.setProperty("--group-color",node.groupColor);
				_tile.classList.add("groupFolder");

				_tile.title = node.title + " / " + _tile.title;

				if ( _tile ) tiles.push( _tile );
			});
			
			return tiles;
		}

		nodes.forEach( (node, index) => {

			let tile = nodeToTile(node);
			
			if ( tile ) tileArray.push( tile );
			else return;
			
			// remove parent folder from menu
			if ( node.groupFolder ) tileArray.pop();
			
			if ( node.groupFolder && !node.parent.parent) { // only top-level folders
			
				let groupTiles = makeGroupTilesFromNode( node );
				
				makeMoreLessFromTiles( groupTiles, node.groupLimit );

				// remove leading separator if consecutive groups
				let previousNode = nodes[index - 1];
				if ( previousNode && previousNode.groupFolder ) groupTiles.splice(0,1);
				
				if ( userOptions.groupFolderRowBreaks ) {
					// separate groupFolders in rows
					let _br = document.createElement('br');
					_br.className = 'groupBr';
					groupTiles.push(_br);
					groupTiles.unshift(_br.cloneNode());
				}
				
				tileArray = tileArray.concat(groupTiles);
			}

		});

		qm.makeMoreLessFromTiles = makeMoreLessFromTiles;

		return buildQuickMenuElement({tileArray:tileArray, reverse: reverse, parentId: rootNode.parent, forceSingleColumn: rootNode.forceSingleColumn, node: rootNode});
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

				tile = buildSearchIcon(se.icon_base64String || se.icon_url || browser.runtime.getURL('/icons/search.svg'), se.title);
				tile.dataset.title = se.title;
				
				// site search picker
				if ( se.template.indexOf('{selectdomain}') !== -1 ) {
					tile.dataset.id = node.id;
					tile.dataset.type = 'folder';
					tile.dataset.subtype = 'sitesearch';

					tile.addEventListener('mouseup', openFolder);
					tile.addEventListener('openFolder', openFolder);
					
					async function openFolder(e) {

						let tab = await browser.runtime.sendMessage({action: 'getCurrentTabInfo'});

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
						
						quickMenuElement = await quickMenuElementFromNodeTree(siteSearchNode);

						for ( let _tile of qm.querySelectorAll('.tile') ) {
							if ( _tile.node.title === url.hostname ) {
								_tile.classList.add('selectedFocus');
								_tile.dataset.selectfirst = "true";
								break;
							}
						}

						resizeMenu({openFolder: true});
					}
					
					break;
				}
				
				addTileEventHandlers(tile, e => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							selectionText: sb.value,
							openMethod: getOpenMethod(e)
						}
					});
				});
				
				tile.dataset.id = node.id;
				tile.dataset.type = 'searchEngine';
				
				break;
		
			case "bookmarklet":

				tile = buildSearchIcon(node.icon || browser.runtime.getURL('/icons/code.svg'), node.title);
				tile.dataset.type = 'bookmarklet';
				tile.dataset.title = node.title;

				addTileEventHandlers(tile, e => {
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
				tile.dataset.title = node.title;

				addTileEventHandlers(tile, e => {
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

			case "separator":
				tile = document.createElement('hr');
				tile.dataset.type = 'separator';

				break;
		
			case "folder":
				tile = buildSearchIcon( node.icon || browser.runtime.getURL("/icons/folder-icon.svg"), node.title);

				tile.dataset.type = 'folder';
				tile.dataset.title = node.title;
				
				// prevent scroll icon
				tile.addEventListener('mousedown', e => {
					
					// skip for dnd events
					if ( e.which === 1 ) return;
					e.preventDefault();
					e.stopPropagation();
				});

				tile.addEventListener('mouseup', openFolder);
				tile.addEventListener('openFolder', openFolder);

				addOpenFolderOnHover(tile);
					
				async function openFolder(e) {
					let method = getOpenMethod(e, true);

					if (method === 'noAction') return;

					if (method === 'openFolder' || e.openFolder) { 
						qm = await quickMenuElementFromNodeTree(node);		
						return resizeMenu({openFolder: true});
					}
					
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							selectionText: sb.value,
							openMethod: method
						}
					});
					
					quickMenuObject.lastUsed = node.id
					userOptions.lastUsedId = quickMenuObject.lastUsed;
					document.dispatchEvent(new CustomEvent('updateLastUsed'));
				}

				break;
				
			case "siteSearch":

				tile = buildSearchIcon(node.icon, node.title);
				tile.dataset.type = 'siteSearch';
				tile.dataset.id = node.id || "";	
				tile.dataset.title = node.title;

				addTileEventHandlers(tile, e => {
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

				addTileEventHandlers(tile, e => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							openMethod: getOpenMethod(e),
						}
					});
				});
				
				break;
				
			case "grouplabel":
				tile = document.createElement('div');
				tile.dataset.type = 'grouplabel';	
				tile.dataset.title = node.title;
				
				break;
		}
		
		tile.node = node;
		
		return tile;
	}

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	setParents(root);

	let lastFolderId = await browser.runtime.sendMessage({action: "getLastOpenedFolder"});
	
	if ( userOptions.rememberLastOpenedFolder && lastFolderId ) {
		let folder = findNodes( root, node => node.id == lastFolderId )[0] || null;
		
		if ( folder && folder.type === "folder" ) return Promise.resolve(quickMenuElementFromNodeTree(folder));
	}

	return Promise.resolve(quickMenuElementFromNodeTree(root));
	
}

async function getSuggestions(terms) {

	let url = 'https://suggestqueries.google.com/complete/search?output=toolbar&hl=' + browser.i18n.getUILanguage() + '&q=' + encodeURIComponent(terms);
	
	setTimeout(() => {return false}, 500);
	
	let resp = await fetch(url);
	
	if (!resp.ok) return false;
	
	let text = await resp.text();
	
	let parsed = new DOMParser().parseFromString(text, 'application/xml');
	
	if (parsed.documentElement.nodeName=="parsererror") {
		console.log('xml parse error', parsed);
		return false;
	}
	
	return parsed;	
}

function makeSearchBar() {
	
	const suggestionsCount = userOptions.searchBarSuggestionsCount || 25; // number of total sg to display (browser_action height is limited!)
	const suggestionsDisplayCount = 5;
	
	let si = document.getElementById('searchIcon');
	
	si.onclick = function() {
		
		sb.focus();
		
		if ( sg.querySelector('div') ) {
			sg.innerHTML = null;
			//sg.addEventListener('transitionend', resizeMenu);
			sg.style.maxHeight = null;
			// resizeMenu({suggestionsResize: true});
			sg.userOpen = false;
			return;
		}
		
		sg.userOpen = true;
		
		sg.innerHTML = null;
		let history = [];
		[...new Set([...userOptions.searchBarHistory].reverse())].slice(0,suggestionsCount).forEach( h => {
			history.push({searchTerms: h, type: 0})
		});
		displaySuggestions(history);
	}
	
	sb.placeholder = browser.i18n.getMessage('Search');
			
	sb.dataset.position = userOptions.quickMenuSearchBar;

	browser.runtime.sendMessage({action: "getLastSearch"}).then((message) => {
		
		if ( userOptions.autoPasteFromClipboard ) {
			sb.select();
			document.execCommand("paste");
			sb.select();
			return;
		}
		
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
		
		// losing keystrokes. Why was this used?
	//	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: sb.value});
				
		suggestions = suggestions.sort(function(a,b) {
			return a.searchTerms - b.searchTerms;
		});
		
		for (let s of suggestions) {
			let div = document.createElement('div');
			div.style.height = "20px";
			div.type = s.type;
			div.onclick = function() {
				let selected = sg.querySelector('.selectedFocus');
				if (selected) selected.classList.remove('selectedFocus');
				this.classList.add('selectedFocus');
				sb.value = this.innerText;
			}
			
			div.ondblclick = () => {
				var e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, key: "Enter"});
				sb.dispatchEvent(e);
			}
			
			let img = document.createElement("img");
			img.src = "/icons/history.svg";
			img.title = browser.i18n.getMessage('History') || "history";
			
			if (s.type === 1) img.style.visibility = 'hidden';
			div.appendChild(img);

			let text = document.createTextNode(s.searchTerms);
			div.appendChild(text);
			sg.appendChild(div);
			
			div.searchTerms = s.searchTerms;
		}
		
		sg.style.width = sb.parentNode.getBoundingClientRect().width + "px";

		sg.addEventListener('transitionend', e => resizeMenu({suggestionsResize: true}));
		
		let sg_height = suggestions.length ? sg.firstChild.getBoundingClientRect().height : 0;
		
		sg.style.maxHeight = Math.min(sg_height * suggestionsDisplayCount, suggestions.length * sg_height) + "px";

	}
	
	var saveDebounce = null;
	
	// listen for and delete history
	document.addEventListener('keydown', (e) => {

		if ( e.key === "Delete" && document.activeElement === sg && sg.querySelector('.selectedFocus') ) {
			
			e.preventDefault();
			
			let selected = sg.querySelector('.selectedFocus');
			
			// test for suggestions type ( history / google suggestion )	
			if ( selected.type !== 0 ) return;

			let i = userOptions.searchBarHistory.lastIndexOf(selected.searchTerms);
			
			if ( i === -1 ) {
				console.error( "search string not found" );
				return;
			}
			
			if ( selected.nextSibling ) selected.nextSibling.click();
			else if ( selected.previousSibling ) selected.previousSibling.click();
			
			selected.parentNode.removeChild(selected);

			userOptions.searchBarHistory.splice(i,1);
			
			// clear old timers
			if ( saveDebounce !== null ) {
				clearTimeout(saveDebounce);
				console.log('debouncing save');
			}
				
			saveDebounce = setTimeout( () => {
				saveUserOptions();
				saveDebounce = null;
				console.log('executing save');
			}, 200);
			
			// saveUserOptions();
	
		}
	});
		
	sb.typeTimer = null;
	sb.onkeypress = function(e) {

		if ( sg.userOpen ) return;
		
		clearTimeout(sb.typeTimer);
		
		sb.typeTimer = setTimeout(async () => {
			
			if (sb.value.trim() === "") {
				sg.style.maxHeight = null;
				return;
			}

			sg.style.minHeight = sg.getBoundingClientRect().height + "px";
			sg.innerHTML = null;
			
			let history = [];
			let lc_searchTerms = sb.value.toLowerCase();
			for (let h of userOptions.searchBarHistory) {
				if (h.toLowerCase().indexOf(lc_searchTerms) === 0)
					history.push({searchTerms: h, type: 0});
				
				if (history.length === suggestionsCount) break;
			}

			if (userOptions.searchBarSuggestions) {
				let xml = await getSuggestions(sb.value);
					
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
					
			} else if ( userOptions.searchBarEnableHistory )
				displaySuggestions(history);
			
			sg.style.minHeight = null;
			
		}, 500);
	}
	
	sb.addEventListener('keydown', (e) => {
		if (e.key === "Enter") {
			if (userOptions.searchBarCloseAfterSearch) window.close();	
		}
	});
	
	// execute a keypress event to trigger some sb methods reserved for typing events
	sb.addEventListener('keydown', (e) => {
		if ( [ "Backspace", "Delete" ].includes(e.key) )
			sb.dispatchEvent(new KeyboardEvent('keypress'));
	});

	ob.onclick = async function() {
		await browser.runtime.sendMessage({action: "openOptions"});
		if ( window == top ) window.close(); // close toolbar menu
	}
}

function createToolsBar(qm) {
	toolBar = document.getElementById('toolBar');
	qm = qm || document.getElementById('quickMenuElement');
	
	// clear the old tools bar
	toolBar.innerHTML = null;
	
	if ( qm.toolsArray.length === 0 ) return;
	
	qm.toolsArray.forEach( tool => {
		tool.className = 'tile';
		toolBar.appendChild(tool);
	});

	let ls = document.createElement('span');
	ls.innerHTML = "&#9668;";		
	ls.style.left = 0;
	toolBar.appendChild(ls);
	
	let rs = document.createElement('span');
	rs.innerHTML = "&#9658;";
	rs.style.right = 0;
	toolBar.appendChild(rs);
	
	ls.className = rs.className = "toolBarArrow";
	ls.style.height = rs.style.height = ls.style.lineHeight = rs.style.lineHeight = qm.toolsArray[0].offsetHeight + "px";
	
	let mouseoverInterval = null;
	rs.addEventListener('mouseenter', e => {
		mouseoverInterval = setInterval(() => toolBar.scrollLeft += 10, 50);
	});
	
	ls.addEventListener('mouseenter', e => {	
		mouseoverInterval = setInterval(() => toolBar.scrollLeft -= 10, 50);
	});
	
	[rs,ls].forEach(s => s.addEventListener('mouseleave', () => clearInterval(mouseoverInterval)));

	function showScrollButtons() {
		ls.style.display = toolBar.scrollLeft ? 'inline-block' : null;
		rs.style.display = ( toolBar.scrollLeft < toolBar.scrollWidth - toolBar.clientWidth ) ? 'inline-block' : null;
	}
	
	// scroll on mouse wheel
	toolBar.addEventListener('wheel', e => {
		toolBar.scrollLeft += (e.deltaY*6);
		e.preventDefault();
	});
	
	toolBar.addEventListener('scroll', showScrollButtons);
	toolBar.addEventListener('mouseenter', showScrollButtons);
	toolBar.addEventListener('mouseleave', () => ls.style.display = rs.style.display = null);	
}

function getSideDecimal(t, e) {
	let rect = t.getBoundingClientRect();
	
	if ( qm.singleColumn ) return ( e.y - rect.y ) / rect.height;
	else return ( e.x - rect.x ) / rect.width;
}

function getSide(t, e) {
	let rect = t.getBoundingClientRect();
	
	let dec = getSideDecimal(t, e);
	
	if ( t.node && t.node.type === 'folder' ) {
		if ( dec < .3 ) return "before";
		else if ( dec > .7 ) return "after";
		else return "middle";
	} else {
		if ( dec < .5 ) return "before";
		else return "after";
	}
}

function getTargetElement(el) {		
	while ( el.parentNode ) {
		if ( el.node ) return el;
		if ( el.dataset.type && ['more','less'].includes(el.dataset.type) ) return el;
		el = el.parentNode;
	}
	return null;
}

function getPreviousSiblingOfType(_div) {
	let s = _div.previousSibling;
	while( s && s.nodeName !== _div.nodeName ) s = s.previousSibling;
	return s;
}

function getNextSiblingOfType(_div) {
	let s = _div.nextSibling;
	while( s && s.nodeName !== _div.nodeName ) s = s.nextSibling;
	return s;
}

function isTargetBeforeGroup(_div, dec) {
	let sibling = getPreviousSiblingOfType(_div);
	return ( dec < .2 && ( !sibling || sibling.node.parent !== _div.node.parent ));
}

function isTargetAfterGroup(_div, dec) {
	let sibling = getNextSiblingOfType(_div);
	return ( dec > .8 && ( !sibling || sibling.node.parent !== _div.node.parent ));
}

function addOpenFolderOnHover(_tile) {

	if ( !userOptions.openFoldersOnHoverTimeout ) return;

	_tile.addEventListener('mouseover', e => {
		_tile.mouseOverFolderTimer = setTimeout(() => {					
			let _e = new CustomEvent('openFolder');
			_e.openFolder = true;
			_tile.dispatchEvent(_e);
		}, userOptions.openFoldersOnHoverTimeout);
	});

	_tile.addEventListener('mouseout', e => {
		clearTimeout(_tile.mouseOverFolderTimer);
		_tile.mouseOverFolderTimer = null;
	});
				
}