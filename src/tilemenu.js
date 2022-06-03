// unique object to reference globally
var quickMenuObject = { 
	keyDownTimer: 0,
	mouseDownTimer: null,
	mouseCoords: {x:0, y:0},
	screenCoords: {x:0, y:0},
	mouseCoordsInit: {x:0, y:0},
	mouseLastClickTime: 0,
	lastSelectTime: 0,
	lastSelectText: "",
	locked: false,
	searchTerms: "",
	searchTermsObject:{},
	disabled: false,
	mouseDownTargetIsTextBox: false,
	contexts:[]
};

var dragFolderTimeout = 1500;

var qm = document.getElementById('quickMenuElement');
var sb = document.getElementById('searchBar');
var tb = document.getElementById('titleBar');
var sg = document.getElementById('suggestions');
var ob = document.getElementById('optionsButton');
var mb = document.getElementById('menuBar');
var toolBar = document.getElementById('toolBar');
var sbc = document.getElementById('searchBarContainer');
var aeb = document.getElementById('addEngineBar');

var type;

// track if tiles can be moved
window.tilesDraggable = false;

document.addEventListener('quickMenuIframeLoaded', e => {
	if ( !userOptions.alwaysAllowTileRearranging ) return;

	window.tilesDraggable = true;
	setDraggable();
}, {once: true});


//#Source https://bit.ly/2neWfJ2 
const every_nth = (arr, nth) => arr.filter((e, i) => i % nth === nth - 1);

var moreLessStatus = [];

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

function saveUserOptions() {
	return browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions, source: "tilemenu.js"});
}

function clickChecker(el) {
	// check if this element was target of the latest mousedown event
	if ( !userOptions.quickMenuSearchOnMouseUp && !el.isSameNode(el.parentNode.lastMouseDownTile)) 
		return false;
	else 
		return true;
}

function getFullElementSize(el) {
	let rect = el.getBoundingClientRect();

	var style = window.getComputedStyle ? getComputedStyle(el, null) : el.currentStyle;

	var marginLeft = parseFloat(style.marginLeft) || 0;
	var marginRight = parseFloat(style.marginRight) || 0;
	var marginTop = parseFloat(style.marginTop) || 0;
	var marginBottom = parseFloat(style.marginBottom) || 0;

	var paddingLeft = parseFloat(style.paddingLeft) || 0;
	var paddingRight = parseFloat(style.paddingRight) || 0;
	var paddingTop = parseFloat(style.paddingTop) || 0;
	var paddingBottom = parseFloat(style.paddingBottom) || 0;

	var borderLeftWidth = parseFloat(style.borderLeftWidth) || 0;
	var borderRightWidth = parseFloat(style.borderRightWidth) || 0;
	var borderTopWidth = parseFloat(style.borderTopWidth) || 0;
	var borderBottomWidth = parseFloat(style.borderBottomWidth) || 0;

	let fullWidth = rect.width + marginLeft + marginRight - ( paddingLeft + paddingRight ) + borderLeftWidth + borderRightWidth;
	let fullHeight = rect.height + marginTop + marginBottom - ( paddingTop + paddingBottom ) + borderTopWidth + borderBottomWidth;

	return {width: fullWidth, height: fullHeight, rectWidth: rect.width, rectHeight: rect.height, noBorderWidth: fullWidth - borderLeftWidth - borderRightWidth };
}

// generic search engine tile
function buildSearchIcon(icon_url, title) {
	var div = document.createElement('DIV');

	if ( icon_url )	div.style.backgroundImage = 'url("' + ( icon_url || browser.runtime.getURL("/icons/logo_notext.svg") ) + '")';
	div.style.setProperty('--tile-background-size', 16 * userOptions.quickMenuIconScale + "px");
	div.title = title;
	return div;
}

function mouseClickBack(e) {
	// assume mouse click is a call to go back
	if ( qm.rootNode.parent && getOpenMethod(e) === "noAction" && getOpenMethod(e, true) === "openFolder" ) {
		e.preventDefault();
		e.stopImmediatePropagation();
		qm.back();
		return true;
	}

	return false;
}

function getSearchAction(e, isFolder) {

	isFolder = isFolder || false;

	if ( defaultSearchActions ) {
		for ( let key in defaultSearchActions ) {
			defaultSearchActions[key].action = userOptions[key];
			let sa = defaultSearchActions[key];
			if ( isSearchAction(sa, e) && isFolder === sa.folder ) {
				// console.log(key, sa.action);
				return sa;
			}
		}
	}

	for ( let sa of userOptions.customSearchActions ) {
		if ( isSearchAction(sa, e) && isFolder === sa.folder ) {
			// console.log('customSearchActions', sa);
			return sa;
		}
	}
}

function getSearchActions(e, isFolder, allEvents) {

	allEvents = allEvents || false;

	let sas = [];

	isFolder = isFolder || false;

	if ( defaultSearchActions ) {
		for ( let key in defaultSearchActions ) {
			defaultSearchActions[key].action = userOptions[key];
			let sa = defaultSearchActions[key];
			if ( isSearchAction(sa, e, allEvents) && isFolder === sa.folder ) {
				// console.log(key, sa.action);
				sas.push(sa);;
			}
		}
	}

	for ( let sa of userOptions.customSearchActions ) {
		if ( isSearchAction(sa, e, allEvents) && isFolder === sa.folder ) {
			// console.log('customSearchActions', sa);
			sas.push(sa);
		}
	}

	return sas;
}

// get open method based on user preferences
function getOpenMethod(e, isFolder) {

	isFolder = isFolder || false;

	// if ( defaultSearchActions ) {
	// 	for ( let key in defaultSearchActions ) {
	// 		defaultSearchActions[key].action = userOptions[key];
	// 		let sa = defaultSearchActions[key];
	// 		if ( isSearchAction(sa, e) && isFolder === sa.folder ) {
	// 			// console.log(key, sa.action);
	// 			return sa.action;
	// 		}
	// 	}
	// }

	// for ( let sa of userOptions.customSearchActions ) {
	// 	if ( isSearchAction(sa, e) && isFolder === sa.folder ) {
	// 		// console.log('customSearchActions', sa);
	// 		return sa.action;
	// 	}
	// }

	let sa = getSearchAction(e, isFolder);
	if ( sa ) return sa.action;

	console.error('no searchAction found', e);
	
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

	qm = qm || document.createElement('div');
	qm.id = 'quickMenuElement';
	qm.tabIndex = -1;
	
	qm.dataset.menu = type;
	qm.dataset.columns = columns;
	qm.columns = columns;
	document.body.dataset.menu = type;

	sb.onclick = e => e.stopPropagation();
	sb.onmouseup = e => e.stopPropagation();

	sb.set = text => {
		sb.value = text;
		sb.title = text;
	}
		
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
			sb.set("");	
			clearTimeout(sb.hoverTimer);
		}
	});

	sb.addEventListener('input', e => {
		quickMenuObject.searchTerms = sb.value;
		quickMenuObject.searchTermsObject.selection = sb.value;
	//	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: sb.value});
	});

	sb.addEventListener('keydown', e => {
		if ( e.key !== "Enter") return;

		quickMenuObject.searchTerms = sb.value;
		quickMenuObject.searchTermsObject.selection = sb.value;
	})

	let csb = document.getElementById('clearSearchBarButton');
	csb.onclick = function() { 
		sb.set("");
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
		setDraggable();	
		
		resizeMenu({toggleSingleColumn: true});
	}
	
	qm.addTitleBarTextHandler = div => {
		
		['mouseenter','dragenter'].forEach( ev => {
			div.addEventListener(ev, () => {

				if ( tb.lastChild && tb.lastChild.nodeType === 3 )
					tb.removeChild(tb.lastChild);

				tb.appendChild(document.createTextNode( div.title || div.dataset.title ) );
			});
		});
		
		div.addEventListener('mouseleave', () => {
			if ( tb.lastChild && tb.lastChild.nodeType === 3 )
				tb.lastChild.textContent = "...";
		});
	}

	// prevent context menu anywhere but the search bar
	document.documentElement.addEventListener('contextmenu', e => {
		if (e.target !== sb ) e.preventDefault();
	});

	// openFolder button will trigger back
	qm.addEventListener("mouseup", e => {
		if ( qm === e.target ) mouseClickBack(e);
	});
	
	// enter key invokes search
	document.addEventListener('keydown', e => {
		if ("Enter" === e.key || ( " " === e.key && e.target === qm ) ) {

			let div = qm.querySelector('div.selectedFocus') || qm.querySelector('div.selectedNoFocus') || qm.querySelector('div[data-id]');
			
			if (!div) return;
			
			div.parentNode.lastMouseDownTile = div;
			
			div.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
		}

		// backspace triggers Back event
		if ('Backspace' === e.key && qm.rootNode.parent && sb !== document.activeElement ) {
			qm.back();
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

	qm.selectFirstTile = () => {
		let firstTile = qm.querySelector('.tile:not([data-hidden]):not([data-undraggable])');
		firstTile.classList.add('selectedFocus');
		sb.selectedIndex = [].indexOf.call(qm.querySelectorAll(".tile"), firstTile);
	}

	sb.addEventListener('keydown', e => {

		if ( ![ "ArrowUp", "ArrowDown", "Tab" ].includes(e.key) ) return;
		if ( e.ctrlKey || e.altKey || e.metaKey ) return;
		
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
			
			let divs = sg.querySelectorAll('div:not(.tool)');

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

		// works for open and close
		sg.addEventListener('transitionend', e => resizeMenu({suggestionsResize: true}));
	}
	
	qm.addEventListener('keydown', e => {
		
		// account for custom folders
		let _columns = qm.querySelector('div').classList.contains('singleColumn') ? 1 : qm.columns;

		if ( ![ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab" ].includes(e.key) ) return;
		
		if ( e.ctrlKey || e.altKey || e.metaKey ) return;
		
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
			if ( 
				(divs[sb.selectedIndex].dataset.hidden && divs[sb.selectedIndex].dataset.hidden == "true")
				|| (divs[sb.selectedIndex].node && divs[sb.selectedIndex].node.type === 'separator')
			) {
				qm.dispatchEvent(new e.constructor(e.type, e));
				return;
			}
		}

		divs[sb.selectedIndex].classList.add('selectedFocus');
		divs[sb.selectedIndex].scrollIntoView({block: "nearest"});

	});

	document.addEventListener('updatesearchterms', e => {

	//	quickMenuObject.searchTerms = quickMenuObject.searchTerms || "";
		sb.set(quickMenuObject.searchTerms.replace(/[\r|\n]+/g, " "));
		updateMatchRegexFolder();
	});

	// prevent click events from propagating
	['mousedown', 'mouseup', 'click', 'contextmenu'].forEach( eventType => {

		document.addEventListener(eventType, e => {
			if ( e.button && [1,3,4].includes(e.button) ) e.preventDefault();
		});

		qm.addEventListener(eventType, e => {

			// move fix
			if ( e.target.closest('.tile, GROUP, .quickMenuMore')) return;

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
			}

		});

		toolsArray.forEach( tool => {
			tool.dataset.type = 'tool';
			tool.dataset.title = tool.title;
			tool.dataset.name = tool.tool.name;
			tool.classList.add('tile');

			if ( tool.context && !tool.context.includes(type) ) {
				tool.disabled = true;
				tool.dataset.disabled = true;
			}
		});

		// add drop text handler
		toolsArray.forEach( tool => {
			tool.addEventListener('drop', e => {
				let text = e.dataTransfer.getData("text");
				if ( !text ) return;

				sb.set(text);
				tool.dispatchEvent(new MouseEvent('mousedown'));
				tool.dispatchEvent(new MouseEvent('mouseup'));
			});
		});

		let getDragDiv = () => {return document.getElementById('dragDiv')};
		let isTool = e => e.dataTransfer.getData("tool") === "true";
		
		toolsArray.forEach( tool => {
			
			tool.setAttribute('draggable', window.tilesDraggable);

			tool.addEventListener('dragstart', e => {

				if ( !window.tilesDraggable ) return false;

				e.dataTransfer.setData("tool", "true");
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
				if ( getDragDiv() ) getDragDiv().id = null;
			});
			tool.addEventListener('drop', async e => {	
				e.preventDefault();
				
				if ( !isTool(e) ) return;
				
				let side = getSide(tool, e);
				
				let qmt = userOptions.quickMenuTools;
				
				dragName = getDragDiv().tool.name;
				targetName = e.target.tool.name;
				
				dragIndex = qmt.findIndex( t => t.name === dragName );
				targetIndex = qmt.findIndex( t => t.name === targetName );

				if ( side === "before" ) {
					qmt.splice( targetIndex, 0, qmt.splice(dragIndex, 1)[0] );
					e.target.parentNode.insertBefore(getDragDiv(), e.target);
				}
				else {
					qmt.splice( targetIndex + 1, 0, qmt.splice(dragIndex, 1)[0] );
					e.target.parentNode.insertBefore(getDragDiv(), e.target.nextSibling);
				}
				
				saveUserOptions();
			
				// rebuild menu
				// toolsArray.forEach( _tool => _tool.parentNode.removeChild(_tool) );
				// qm.toolsArray = createToolsArray();
			//	toolsHandler();

			//	qm.expandMoreTiles();

			//	resizeMenu({tileDrop: true});

			//	qm = await quickMenuElementFromNodeTree(qm.rootNode);

			});
		});
		
		toolsArray.forEach( div => qm.addTitleBarTextHandler(div));

		return toolsArray;
	}
	
	qm.toolsArray = createToolsArray();

	qm.removeBreaks = () => {
		qm.querySelectorAll('br').forEach( br => br.parentNode.removeChild(br) );
		qm.style.whiteSpace = null;
		qm.style.overflow = null;
	}

	qm.insertBreaks = _columns => {

		qm.removeBreaks();

		qm.style.whiteSpace = 'nowrap';
		qm.style.overflow = 'hidden';
		
		_columns = _columns || qm.columns;

		let tiles = [...qm.querySelectorAll('.tile:not([data-hidden="true"])')].filter( t => t.style.display !== 'none' );

		let br = () => document.createElement('br');

		let count = 1;
		tiles.forEach( t => {
			let closestBlock = t.closest('GROUP.block, GROUP.break');

			// first in GROUP.block, reset counter
			if ( !t.previousSibling && closestBlock) {
				qm.insertBefore(br(), closestBlock);
				count = 2;
				return;
			}

			// last in GROUP.block, reset counter
			if ( !t.nextSibling && closestBlock ) {
				t.parentNode.insertBefore(br(), t.nextSibling);
				count = 1;
				return;
			}

			if ( t.nodeName === 'HR' ) {
				t.parentNode.insertBefore(br(), t.nextSibling);
				t.parentNode.insertBefore(br(), t);
				count = 1;
				return
			}

			if ( count === _columns ) {
				t.parentNode.insertBefore(br(), t.nextSibling);
				count = 1;
				return
			}

			count++;
		});

		// remove doubles
		qm.querySelectorAll('br').forEach( el => {

			// back-to-back BRs
			if (el.previousSibling && el.previousSibling.nodeName === el.nodeName && el.previousSibling.className === el.className )
				el.parentNode.removeChild(el);

			// groups
			if ( el.previousSibling && el.previousSibling.nodeName === "GROUP" ) {
				let g = el.previousSibling;

				// inline groups
				if ( g.lastChild && g.lastChild.nodeName === el.nodeName )
					g.removeChild(g.lastChild);

				// block groups
				let lastBr = g.querySelector('br:last-of-type');
				if ( lastBr && !lastBr.nextSibling )
					lastBr.parentNode.removeChild(lastBr);
			}

		});

		return qm.querySelectorAll('br').length;

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
		qm.style.pointerEvents = 'none';
		
		qm.columns = _columns;
	
		// remove separators if using grid
		if (!_singleColumn && userOptions.quickMenuHideSeparatorsInGrid) tileArray = tileArray.filter( tile => tile.dataset.type !== 'separator' );
	
		qm.singleColumn = _singleColumn;
			
		// make rows / columns
		tileArray.forEach( tile => {
			
			tile.classList.add('tile');

			tile.classList.toggle("singleColumn", _singleColumn);
			
			if ( !_singleColumn && tile.node && tile.node.type === 'folder' && tile.dataset.type === 'folder' ) {
				
				if ( tile.node.icon )
					tile.dataset.hasicon = 'true'; // removes pseudo element label set by content:attr(data-title) in tilemenu.css 
				else
					tile.style.backgroundImage = 'url(' + browser.runtime.getURL('icons/transparent.gif') + ')';
			}

			qm.appendChild(tile);
		});

		qm.getTileSize = () => { 

			let div = document.createElement('div');
			div.className = "tile";
			
			div.classList.toggle('singleColumn', qm.singleColumn );
			qm.appendChild(div);

			let size = getFullElementSize(div);
			
			qm.removeChild(div);

			return size;
		};
		
		qm.setDisplay = () => {
			qm.querySelectorAll('.tile').forEach( _tile => {
				let _sc = (qm.singleColumn || qm.rootNode.displayType === "text" )
				_tile.classList.toggle("singleColumn", _sc);
			});
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
		qm.setMinWidth = () => qm.style.minWidth = qm.columns * qm.getTileSize().noBorderWidth + "px";
		
		// slide-in animation
		if ( !userOptions.enableAnimations ) qm.style.setProperty('--user-transition', 'none');
		qm.style.left = qm.getBoundingClientRect().width * ( options.reverse ? -1 : 1 ) + "px";
		void( qm.offsetHeight );
		qm.style.transition = null;
		qm.style.visibility = null;
		qm.style.left = '0px';

		runAtTransitionEnd(qm, "left", () => qm.style.pointerEvents = null, 100);
				
		function isTool(e) {
			return ( e.dataTransfer.getData("tool") === "true" );
		}

		(() => {

			if ( qm.rootNode.parent ) return;
			let specialFolderNodes = [];

			if ( userOptions.quickMenuShowRecentlyUsed )
				specialFolderNodes.push(recentlyUsedListToFolder());

			if ( userOptions.quickMenuRegexMatchedEngines )
				specialFolderNodes.push(matchingEnginesToFolder(quickMenuObject.searchTerms));

			specialFolderNodes.forEach( folder => {
				folder.displayType = qm.rootNode.displayType;

				let _tile = nodeToTile( folder );
				_tile.node.displayType = qm.rootNode.displayType;
				// _tile.node.groupFolder = 'block';
				_tile.classList.add('tile');
				_tile.dataset.hasicon = 'true';
				_tile.dataset.undraggable = true;
				_tile.dataset.undroppable = true;

				tileArray.unshift(_tile);
				qm.insertBefore(_tile, qm.firstChild);
			});
		})();

		qm.setDisplay();

		(() => { //formatGroupFolders()

			let groupFolders = tileArray.filter( t => t.node && t.node.groupFolder && t.dataset.type !== 'tool' && t.node.parent === qm.rootNode );

			groupFolders.forEach( gf => {

				let g = makeGroupFolderFromTile(gf);
				if ( !g ) return;

				// make GROUP draggable
				g.draggable = true;

				qm.insertBefore(g, gf);
				if ( gf.parentNode && g.classList.contains('block') ) gf.parentNode.removeChild(gf);
				else g.insertBefore(gf, g.querySelector('.tile') || g.lastChild);

				// bubbles the drag event for the inline root folder to the GROUP
				gf.dataset.undraggable = true;

				let footer = g.querySelector('.footer');

				// display groups limited to a row count and change more tile style
				if ( gf.node.groupFolder === "block") {

					makeContainerMore(g.querySelector('.container'), gf.node.groupLimit || Number.MAX_SAFE_INTEGER, qm.columns);
					let moreTile = g.querySelector('[data-type="more"]');

					if (moreTile) {
						moreTile.parentNode.removeChild(moreTile);

						footer.appendChild(moreTile);

						moreTile.className = "groupMoreTile";
					} else {
						footer.parentNode.removeChild(footer);	
					}
				}
			});
		})();

		qm.querySelectorAll('.tile').forEach( div => qm.addTitleBarTextHandler(div));

		qm.expandMoreTiles = () => {
			let moreTiles = [...document.querySelectorAll('[data-type="more"], [data-type="less"]')];

			moreLessStatus.forEach( id => {
				let moreTile = moreTiles.find( div => div.dataset.parentid === id );				
				if ( moreTile ) moreTile.more();
			});
		}
		
		toolsHandler();

		qm.expandMoreTiles();

		return qm;
	}

	async function quickMenuElementFromNodeTree( rootNode, reverse ) {

		qm.contexts = quickMenuObject.contexts;
		qm.contextualLayout = false;

		// filter node tree for matching contexts
		if ( userOptions.quickMenuUseContextualLayout && qm.contexts && qm.contexts.length ) {		

			let tempRoot = filterContexts(rootNode, qm.contexts);

			// flatten
			let seNodes = findNodes(tempRoot, n => !['folder', 'separator'].includes(n.type) );
			if ( seNodes.length < userOptions.quickMenuContextualLayoutFlattenLimit ) {
				tempRoot.children = seNodes;
			}

			setParents(tempRoot);

			tempRoot.parent = rootNode.parent;
			rootNode = tempRoot;

			qm.contextualLayout = true;
		}

		let debug = rootNode.title === "empty";

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

			let tile = buildSearchIcon(null, browser.i18n.getMessage('back'));
			tile.appendChild(makeToolMask({icon: 'icons/back.svg'}));

			tile.dataset.type = "folder";
			tile.node = rootNode.parent;
			tile.dataset.undraggable = true;
	
			tile.addEventListener('mouseup', _back);
			tile.addEventListener('openFolder', _back);

			addOpenFolderOnHover(tile);
			
			qm.back = _back;
			
			async function _back(e) {

				// back button rebuilds the menu using the parent folder ( or parent->parent for groupFolders )
				qm = await quickMenuElementFromNodeTree(( rootNode.parent.groupFolder ) ? rootNode.parent.parent : rootNode.parent, true);
				setDraggable();	
				qm.expandMoreTiles();
				resizeMenu({openFolder: true});
			}
						
			delete sb.selectedIndex;
			tileArray.push(tile);
		}
			
		function makeGroupTilesFromNode( node ) {
			let tiles = [];
			
			node.children.forEach( _node => {
				let _tile = nodeToTile(_node);
				
				if ( !_tile ) return;

				_tile.title = node.title + " / " + _tile.title;

				if ( _tile ) tiles.push( _tile );
			});
			
			return tiles;
		}

		nodes.forEach( node => {

			let tile = nodeToTile(node);
			
			if ( tile ) tileArray.push( tile );
			else return;
						
		//	if ( node.groupFolder && !node.parent.parent) { // only top-level folders

			if ( node.groupFolder && node.parent === qm.rootNode ) { 
				let groupTiles = makeGroupTilesFromNode( node );

				tileArray = tileArray.concat(groupTiles);
			}

		});

		try { // fails on restricted pages
			await browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then((message) => {
				let qmo = message[0];

				if ( qmo ) quickMenuObject.searchTerms = qmo.searchTerms
			});
		} catch (error) {

		}

		qm.makeMoreLessFromTiles = makeMoreLessFromTiles;

		return buildQuickMenuElement({tileArray:tileArray, reverse: reverse, parentId: rootNode.parent, forceSingleColumn: rootNode.forceSingleColumn, node: rootNode});
	}
	
	window.quickMenuElementFromNodeTree = quickMenuElementFromNodeTree;

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	window.root = root;
	quickMenuObject.contexts = options.contexts || [];

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

	sb.placeholder = browser.i18n.getMessage('Search');		
	sb.dataset.position = userOptions.quickMenuSearchBar;

	columns = (userOptions.searchBarUseOldStyle) ? 1 : userOptions.searchBarColumns;
	
	si.onclick = function() {
		
		sb.focus();
		
		// if suggestions are open
		if ( sg.querySelector('div') ) {
			sg.innerHTML = null;
			sg.style.maxHeight = null;
			sg.userOpen = false;

			si.style.transform = null;

			runAtTransitionEnd(sg, "height", resizeMenu)

			return;
		}

		si.style.transform = 'rotate(-180deg)';
		
		sg.userOpen = true;
		
		sg.innerHTML = null;
		let history = [];
		[...new Set([...userOptions.searchBarHistory].reverse())].slice(0,suggestionsCount).forEach( h => {
			history.push({searchTerms: h, type: 0})
		});
		displaySuggestions(history);
	}
	
	browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then((message) => {
		let qmo = message[0];

		if ( qmo && qmo.searchTerms)
			setTimeout(() => sb.set(qmo.searchTerms), 10);
		else displayLastSearchTerms();
	}, () => {
		displayLastSearchTerms();
	});

	function displayLastSearchTerms() {
		browser.runtime.sendMessage({action: "getLastSearch"}).then((message) => {
			
			if ( userOptions.autoPasteFromClipboard ) {
				let paste = () => {
					try {
						navigator.clipboard.readText().then(clipText => sb.set(clipText));
					} catch ( error ) { console.error(error) }
				}
				if ( window == top ) paste(); // toolbar menu
				else window.addEventListener('focus', paste, {once: true}); // qm, sb
				
				return;
			}
			
			// skip empty 
			if (!message.lastSearch || !userOptions.searchBarDisplayLastSearch) return;
			
			sb.set(message.lastSearch);
			sb.select();

			// workaround for linux 
			var selectInterval = setInterval( () => {

				if (getSelectedText(sb) == sb.value)
					clearInterval(selectInterval);
				else
					sb.select();
			}, 50);

		});
	}
	
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
				sb.set(this.innerText);
			}
			
			div.ondblclick = () => {
				var e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, key: "Enter"});
				sb.dispatchEvent(e);
			}
			
			let img = document.createElement("div");
			img.style.setProperty("--mask-image", "url(/icons/history.svg)");
			img.title = browser.i18n.getMessage('History') || "history";
			img.classList.add('tool');
			
			if (s.type === 1) img.style.visibility = 'hidden';
			div.appendChild(img);

			let text = document.createTextNode(s.searchTerms);
			div.appendChild(text);
			sg.appendChild(div);
			
			div.searchTerms = s.searchTerms;
		}
		
		sg.style.width = sb.parentNode.getBoundingClientRect().width + "px";
		
		let sg_height = suggestions.length ? sg.firstChild.getBoundingClientRect().height : 0;
		
		sg.style.maxHeight = Math.min(sg_height * suggestionsDisplayCount, suggestions.length * sg_height) + "px";

	}

	async function updateSuggestions() {
			
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
		
	}
		
	// listen for and delete history
	document.addEventListener('keydown', e => {

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

			debounce(saveUserOptions, 500, "saveDebounce")
		}
	});
	
	sb.onkeypress = function(e) {

		if ( sg.userOpen ) return;
		debounce(updateSuggestions, 500, "typeTimer");
	}
	
	// execute a keypress event to trigger some sb methods reserved for typing events
	sb.addEventListener('keydown', e => {
		if ( [ "Backspace", "Delete" ].includes(e.key) )
			sb.dispatchEvent(new KeyboardEvent('keypress'));
	});

	ob.onclick = async function() {
		await browser.runtime.sendMessage({action: "openOptions"});
		if ( window == top ) window.close(); // close toolbar menu
	}

	sb.addEventListener('keydown', e => {
		debounce(() => updateMatchRegexFolder(sb.value), 500, "typeTimer2");
	})
}

function createToolsBar(qm) {
	
	qm = qm || document.getElementById('quickMenuElement');
	
	// clear the old tools bar
	toolBar.innerHTML = null;
	
	if ( qm.toolsArray.length === 0 ) return;
	
	qm.toolsArray.forEach( tool => {
		tool.className = 'tile';
		toolBar.appendChild(tool);
	});
}

function getSideDecimal(t, e) {
	let rect = t.getBoundingClientRect();
	
	if ( qm.singleColumn || t.classList.contains('block')) return ( e.y - rect.y ) / rect.height;
	else return ( e.x - rect.x ) / rect.width;
}

function getSide(t, e) {
	let rect = t.getBoundingClientRect();
	
	let dec = getSideDecimal(t, e);
	
	if ( t.node && t.node.type === 'folder' ) {
		if ( dec < .25 ) return "before";
		else if ( dec > .75 ) return "after";
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

function getPreviousSiblingOfType(el) {
	let s = el.previousSibling;
//	while( s && s.nodeName !== el.nodeName ) s = s.previousSibling;
	return s;
}

function getNextSiblingOfType(el) {
	let s = el.nextSibling;
//	while( s && s.nodeName !== el.nodeName ) s = s.nextSibling;
	return s;
}

function isTargetBeforeGroup(el, dec) {
	let sibling = getPreviousSiblingOfType(el);
	return ( dec < .2 && ( !sibling || !sibling.node || sibling.node.parent !== el.node.parent ));
}

function isTargetAfterGroup(el, dec) {
	let sibling = getNextSiblingOfType(el);

	//if ( !sibling.node ) console.log('no node', sibling);
	return ( dec > .8 && ( !sibling || !sibling.node || sibling.node.parent !== el.node.parent ));
}

function getGroupFolderSiblings(el) {
	return [ ...qm.querySelectorAll('.groupFolder')].filter( el => el.node && el.node.parent === el.node.parent);
}

function dispatchOpenFolderEvent(el) {
	let e = new CustomEvent('openFolder');
	e.openFolder = true;
	el.dispatchEvent(e);
}

function openFolderTimer(el, ms) {
	ms = ms || userOptions.openFoldersOnHoverTimeout;
	return setTimeout(() => dispatchOpenFolderEvent(el), ms);
}

function addOpenFolderOnHover(_tile, ms) {

	if ( !userOptions.openFoldersOnHoverTimeout && !ms) return;

	_tile.addEventListener('mouseenter', e => _tile.mouseOverFolderTimer = openFolderTimer(_tile, ms));

	_tile.addEventListener('mouseleave', e => {
		clearTimeout(_tile.mouseOverFolderTimer);
		_tile.mouseOverFolderTimer = null;
	});			
}

// hotkey listener
function checkForNodeHotkeys(e) {

	if (!userOptions.quickMenuSearchHotkeys || userOptions.quickMenuSearchHotkeys === 'noAction') return;

	// ignore hotkeys when the search bar is being edited
	if (document.activeElement === sb) return;

	let hotkeyNode = findNode(userOptions.nodeTree, node => node.hotkey === e.which);

	if (!hotkeyNode) return;

	if ( e.ctrlKey || e.altKey || e.shiftKey || e.metaKey ) return;

	e.preventDefault();
	e.stopPropagation();
	
	browser.runtime.sendMessage({
		action: "quickMenuSearch", 
		info: {
			menuItemId: hotkeyNode.id,
			selectionText: sb.value,
			quickMenuObject: JSON.parse(JSON.stringify(quickMenuObject)),
			openMethod: userOptions.quickMenuSearchHotkeys
		}
	}).then(() => {
		if ( !keepMenuOpen(e) )
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});

		if (type === 'searchbar' && userOptions.searchBarCloseAfterSearch) window.close();
	});

}

getAllOtherHeights = (_new) => {

	if ( _new ) return document.body.getBoundingClientRect().height - qm.getBoundingClientRect().height;
	
	let height = 0;
	[sbc,tb,mb,toolBar,aeb].forEach( el => height += getFullElementSize(el).height );
	return height;
}

isMoving = e => {
	return e.which === 1 && e.type === 'mouseup' && document.body.classList.contains('moving');
}

// causing window drag to fail in chrome
// prevent most click events
// document.addEventListener('mousedown', e => {
// 	if ( !e.target.closest("INPUT"))
// 		e.preventDefault();
// });

document.addEventListener('click', e => {
	let tile = e.target.closest('.tile');

	if ( !tile ) return;

	e.preventDefault();
})

document.addEventListener('mousedown', e => {

	let tile = e.target.closest('.tile, .quickMenuMore');

	if ( !tile ) return;

	if ( !tile.node && !tile.action ) {
		console.log('no node or action', tile);
		return;
	}

	tile.parentNode.lastMouseDownTile = tile;

	// allow tile actions if override is set
	if ( window.tilesDraggable ) return;

	e.preventDefault();
});

// tools
document.addEventListener('mouseup', async e => {

	if ( !e.target.closest ) return;

	let tile = e.target.closest('.tile, .quickMenuMore');

	if ( !tile || !tile.action ) return;

	if ( tile.disabled ) return;

	if ( window.tilesDraggable && !tile.dataset.type === "tool" && !tile.dataset.name === "edit") return;

	if ( mouseClickBack(e) ) return;

	if ( !clickChecker(tile) ) return;

	e.stopImmediatePropagation();
	e.preventDefault();

	await tile.action(e);

	if ( !keepMenuOpen(e) && !tile.keepOpen )
		closeMenuRequest(e);

});

document.addEventListener('mouseup', e => {

	// docking drag throws error on HTMLDocument element
	if ( !e.target.closest) return;

	let tile = e.target.closest('.tile');

	if ( !tile || !tile.node ) return;

	if (tile.node && tile.node.type && !['searchEngine', 'bookmarklet', 'oneClickSearchEngine', 'siteSearch', 'siteSearchFolder', 'externalProgram'].includes(tile.node.type)) return;

	if ( tile.disabled ) return;

	// allow tile actions if override is set
	if ( window.tilesDraggable && !userOptions.alwaysAllowTileRearranging) return;

	if ( mouseClickBack(e) ) return;

	if ( !clickChecker(tile) ) return;

	// skip click tests on dispatchEvents
	if ( !e.isTrusted ) return mouseupHandler(e);

	// if a double-click is set to the same meta + button, delay exe until dblclick timeout
	let sa = getSearchAction(e);

	// catch unbound double-clicks
	if ( !sa ) {
		clearTimeout(window.mouseupHandlerTimeout);
		return;
	}

	// single-clicks go to a timeout
	if ( sa.event !== 'dblclick' ) {

		if ( getSearchActions(e, false, true).find(_sa => _sa.event === 'dblclick')) {
			window.mouseupHandlerTimeout = setTimeout(() => {
				console.log('has double-click event also');
				mouseupHandler(e);		
			}, 500);
		} else {
			console.log('no double-click event, trigger immediately');
			mouseupHandler(e);
		}

	//double-clicks are handle immediately
	} else {
		clearTimeout(window.mouseupHandlerTimeout);
		console.log('double-click, trigger immediately')
		mouseupHandler(e);
	}
});

async function mouseupHandler(e) {

	e.stopImmediatePropagation();
	e.preventDefault();

	let tile = e.target.closest('.tile');

	// give sb changes time to update
	await new Promise(r => setTimeout(r, 25));

	window.addEventListener('click', e => e.stopPropagation(), {once:true, capture:true});

	if ( tile.dataset.id && quickMenuObject.lastUsed !== tile.dataset.id ) {
		// // store the last used id
		userOptions.lastUsedId = quickMenuObject.lastUsed = tile.dataset.id || null;
		
		document.dispatchEvent(new CustomEvent('updateLastUsed'));
	}

	quickMenuObject.mouseLastClickTime = Date.now();
	quickMenuObject.searchTerms = sb.value;

	browser.runtime.sendMessage({
		action: "updateQuickMenuObject", 
		quickMenuObject: quickMenuObject
	});

	let node = tile.node;
	let qmo = quickMenuObject;

	let searchPromise = (async () => {

		switch ( node.type ) {
		
			case 'searchEngine':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id,
						selectionText: sb.value,
						quickMenuObject: qmo,
						openMethod: getOpenMethod(e)
					}
				});
				break;

			case 'bookmarklet':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id, // needs work
						selectionText: sb.value,
						quickMenuObject: qmo,
						openMethod: getOpenMethod(e)
					}
				});
				break;

			case 'oneClickSearchEngine':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id, // needs work
						selectionText: sb.value,
						quickMenuObject: qmo,
						openMethod: getOpenMethod(e)
					}
				});
				break;

			case 'siteSearchFolder':

				tile.keepOpen = true;

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
							id: node.id,
							icon: tab.favIconUrl || browser.runtime.getURL('/icons/search.svg')
						});	
					});
					
					qm = await quickMenuElementFromNodeTree(siteSearchNode);

					for ( let _tile of qm.querySelectorAll('.tile') ) {
						if ( _tile.node.title === url.hostname ) {
							_tile.classList.add('selectedFocus');
							_tile.dataset.selectfirst = "true";
							break;
						}
					}

					resizeMenu({openFolder: true});
				}

				return openFolder(e);

				break;

			case 'siteSearch':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id, // needs work
						selectionText: sb.value,
						quickMenuObject: qmo,
						openMethod: getOpenMethod(e),
						domain: tile.node.title
					}
				});

				break;

			case 'bookmark':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id,
						openMethod: getOpenMethod(e),
					}
				});

				break;

			case 'externalProgram':
				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id,
						selectionText: sb.value,
						quickMenuObject: qmo,
						openMethod: getOpenMethod(e),
					}
				});

				return Promise.resolve(true);
				break;

			default:
				return Promise.reject('unknown node type', node.type);
				break;

		}

	})();

	searchPromise.then(() => {

		// check for locked / Keep Menu Open 
		let keepOpen = tile.keepOpen ? tile.keepOpen : false;
		
		if ( !keepMenuOpen(e) && !keepOpen )
			closeMenuRequest(e);
	}, err => { 
		console.log(err)
	});

	return false;

}

document.addEventListener('dragstart', e => {

	if ( !window.tilesDraggable ) return;

	let tile = e.target.closest('.tile') || e.target.closest('group');

	if ( !tile ) return;

	if ( undraggable(tile) ) return;

	if ( qm.contextualLayout ) {
		console.warn('Tiles cannot be rearranged when using contextual layout. Use the Show / Hide tool to switch between normal and contextual.');
		return;
	}

	// required by ff for dragend
	e.dataTransfer.setData("text", "");

	tile.classList.add('drag');

	window.dragNode = tile.node;
	window.dragTile = tile;

	qm.style.overflowY = 'hidden';

	// apply style to inline groups
	if ( tile.nodeName === "GROUP" && tile.classList.contains('inline') ) tile.classList.add('groupMove');

});

document.addEventListener('dragenter', e => {

	let tile = e.target.closest('.tile');

	if ( !tile ) return;

	if ( tile.dataset.type === 'folder' && !undroppable(tile) ) {

		// open folders on dragover - bind to qm instead of tile
		qm.textDragOverFolderTimer = openFolderTimer(tile, dragFolderTimeout);
		return;
	}

	if ( !window.dragNode ) return;
});

document.addEventListener('dragover', e => {

	e.preventDefault();
    e.stopPropagation();

	let tile = e.target.closest('.tile') || e.target.closest('group');

	if ( e.target === document.querySelector('.dummy') )
		tile = e.target.nextSibling;

//	if ( !tile ) { console.log('no tile', e.target); return; }
	if ( !tile ) return;
	if ( !window.dragNode ) return;
	if ( tile.dataset.type === 'tool' ) return;

	if ( tile.node && tile.node.parent && window.dragNode === tile.node.parent ) return;

	if ( undroppable(tile) ) return;

	if ( tile.lastDragOver && Date.now() - tile.lastDragOver < 100 ) return;

	tile.lastDragOver = Date.now();

	let side = getSide(tile, e);

//	if ( tile.dataset.side === side ) return;

	let dummy = makeMarker();

	if ( side === 'before' )
		tile.parentNode.insertBefore(dummy, tile);
	if ( side === 'after' )
		tile.parentNode.insertBefore(dummy, tile.nextSibling);
	if ( side === 'middle' ) {
		document.body.appendChild(dummy);
		dummy.style.display = 'none';
	}

	tile.classList.toggle('wide', tile.classList.contains('block'));

	tile.dataset.side = side;

	tile.classList.add('dragHover');

	if ( !tile.node ) console.log('no node', tile);

	if ( tile.classList.contains("groupFolder") && !tile.classList.contains('groupMove') ) {
		
		let dec = getSideDecimal(tile, e);
		
		let targetGroupDivs = getGroupFolderSiblings(tile);

		if ( isTargetBeforeGroup(tile, dec) ) 
			tile.classList.remove('groupHighlight');
		else if ( isTargetAfterGroup(tile, dec) ) 
			tile.classList.remove('groupHighlight');
		else
			tile.classList.add('groupHighlight');
	}	

});

document.addEventListener('dragleave', e => {

	let tile = e.target.closest('.tile') || e.target.closest('group');

	if ( !tile ) return;

	if ( qm.textDragOverFolderTimer && tile.node && tile.node.type === "folder") {
		clearTimeout(qm.textDragOverFolderTimer);
		qm.textDragOverFolderTimer = null;
	}

	clearDragStyling(tile);
});

document.addEventListener('drop', e => {

	e.preventDefault();

	let tile = e.target.closest('.tile') || e.target.closest('group');

	let dummy = document.querySelector('.dummy');

	if ( e.target === dummy || e.target === qm )
		tile = dummy.nextSibling;

	if ( !tile ) return;
	if ( !window.dragNode ) return;
	if ( window.dragNode === tile.node ) return;
	if ( tile.node && tile.node.parent && window.dragNode === tile.node.parent ) return;

	if ( undroppable(tile) ) return console.log('undroppable');

	let side = getSide(tile, e);

	let old_node_count = findNodes(userOptions.nodeTree, n => true).length;

	// cut the node from the children array
	let slicedNode = nodeCut(window.dragNode);

	let dragTile = document.querySelector('.drag') || window.dragTile;
	let targetNode = tile.node || tile.parentNode.node;

	// special handler for inline groups
	if ( tile.classList.contains("groupFolder") ) {
		
		let dec = getSideDecimal(tile, e);
		
		if ( isTargetBeforeGroup(tile, dec) ) {
			console.log('moving before group');
			nodeInsertBefore(slicedNode, targetNode.parent);
		} else if ( isTargetAfterGroup(tile, dec) ) {
			console.log('moving after group');
			nodeInsertAfter(slicedNode, targetNode.parent);
		} else if ( tile.dataset.type && ['more','less'].includes(tile.dataset.type) ) {
			console.log('drop to more / less tile ... appending tile to group');
			nodeAppendChild(slicedNode, targetNode.parent);			
		} else {
			return;
		}

		console.log('moving', slicedNode.title, 'to', targetNode.parent.title);
		dragSave();
		return;
	}

	if ( side === 'before' ) 
		nodeInsertBefore(slicedNode, tile.node);
	
	if ( side === 'after' )
		nodeInsertAfter(slicedNode, tile.node);
	
	if ( side === 'middle' && tile.node.type === "folder" )
		nodeAppendChild(slicedNode, tile.node);
	
	console.log('moving', slicedNode.title, 'to', slicedNode.parent.title);
	dragSave();

	function dragSave() {

		let new_node_count = findNodes(root, n => true).length;

		// console.log(old_node_count, "->", new_node_count);

		if ( old_node_count === new_node_count ) {
			userOptions.nodeTree = JSON.parse(JSON.stringify(root));
			saveUserOptions();
		} else {
			console.error('a node has been lost. aborting', old_node_count, new_node_count);
		}

		(async () => {
			let orig = userOptions.enableAnimations;
			userOptions.enableAnimations = false;
			qm = await quickMenuElementFromNodeTree(qm.rootNode, false);
			userOptions.enableAnimations = orig;
			setDraggable();
			resizeMenu({tileDrop: true});
		})();
	}

});

document.addEventListener('dragend', e => {
	dragCleanup();
	clearTimeout(qm.textDragOverFolderTimer);
});

dragCleanup = () => {
	// clear group styling
	['groupMove', 'dragHover', 'dragOver', 'drag'].forEach( c => {
		document.querySelectorAll("." + c).forEach( el => el.classList.remove(c));
	})

	// remove indicator
	let dummy = document.querySelector('.dummy');
	if ( dummy ) dummy.parentNode.removeChild(dummy);

	delete window.dragTile;
	delete window.dragNode;
}

undraggable = el => {
	return el.dataset.undraggable === "true";
}

undroppable = el => {
	return el.dataset.undroppable === "true";
}

clearDragStyling = el => {
	el.classList.remove('dragOver', 'before', 'after', 'middle', 'dragHover', 'groupHighlight');
}

setDraggable = e => {
	if ( window.tilesDraggable )
		document.querySelectorAll('.tile:not([data-undraggable])').forEach( el => el.setAttribute('draggable', window.tilesDraggable));
}

makeMarker = () => {
	let dummy = document.querySelector('.dummy') || document.createElement('dummy');
	dummy.className = 'tool dummy';
	dummy.style="--mask-image: url(icons/chevron-down.svg);";
	dummy.classList.toggle('singleColumn', qm.singleColumn);
	return dummy;
}

(() => { // text, image, url drag & drop
	document.addEventListener('dragover', e => {
		if ( window.tilesDraggable && !userOptions.alwaysAllowTileRearranging ) return;

		e.preventDefault();

		let tile = e.target.closest('.tile');

		if ( !tile ) return;

		tile.classList.add("dragHover");

	});

	document.addEventListener('drop', e => {

		if ( window.dragTile ) return;

		if ( window.tilesDraggable && !userOptions.alwaysAllowTileRearranging ) return;

		let tile = e.target.closest('.tile');
		if ( !tile ) return;

		e.preventDefault();

		tile.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
		tile.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
	});
})();

function nodeToTile( node ) {

	let tile = {};

//	if (node.hidden) return;

	let getTitleWithHotkey = n => {
		if ( userOptions.quickMenuShowHotkeysInTitle ) 
			return n.title + (n.hotkey ? ` (${keyTable[n.hotkey]})` : "");
		else
			return n.title;
	}
	
	switch ( node.type ) {

		case "searchEngine":

			let se = userOptions.searchEngines.find(se => se.id === node.id);

			if ( se.description && !node.description ) node.description = se.description;
			
			if (!se) {
				console.log('no search engine found for ' + node.id);
				return;
			}

			// site search picker
			if ( se.template.includes('{selectdomain}') )
				return nodeToTile(Object.assign(node, {type: "siteSearchFolder"}));

			tile = buildSearchIcon(getIconFromNode(node), getTitleWithHotkey(node));
			tile.dataset.title = getTitleWithHotkey(node);
		//	tile.dataset.description = se.description || node.description || "";
				
			tile.dataset.id = node.id;
			tile.dataset.type = 'searchEngine';

			break;
	
		case "bookmarklet":

			tile = buildSearchIcon(getIconFromNode(node), node.title);
			tile.dataset.type = 'bookmarklet';
			tile.dataset.title = node.title;
			tile.dataset.id = node.id;

			break;

		case "oneClickSearchEngine":

			tile = buildSearchIcon(getIconFromNode(node), node.title);
			tile.dataset.type = 'oneClickSearchEngine';
			tile.dataset.id = node.id;
			tile.dataset.title = node.title;

			break;

		case "separator":

			tile = document.createElement('hr');
			tile.dataset.type = 'separator';

			break;
	
		case "folder":

			tile = buildSearchIcon( getIconFromNode(node), node.title);

			tile.dataset.type = 'folder';
			tile.dataset.title = node.title;
			
			// prevent scroll icon
			tile.addEventListener('mousedown', e => {

				tile.parentNode.lastMouseDownTile = tile;
				
				// skip for dnd events
				if ( e.which === 1 ) return;
				e.preventDefault();
				e.stopPropagation();
			});

			tile.addEventListener('mouseup', e => {
				if ( clickChecker(tile) ) openFolder(e);
			});

			tile.addEventListener('openFolder', openFolder);

			addOpenFolderOnHover(tile);
				
			async function openFolder(e) {

				let method = getOpenMethod(e, true);

				if (method === 'noAction') return;

				if (method === 'openFolder' || e.openFolder) { 
				//	if ( !node.children.length ) return;
					qm = await quickMenuElementFromNodeTree(tile.node);
					setDraggable();	
					return resizeMenu({openFolder: true});
				}
				
				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: node.id,
						selectionText: sb.value,
						quickMenuObject: JSON.parse(JSON.stringify(quickMenuObject)),
						openMethod: method
					}
				});
				
				quickMenuObject.lastUsed = node.id
				userOptions.lastUsedId = quickMenuObject.lastUsed;
				document.dispatchEvent(new CustomEvent('updateLastUsed'));

				if ( !keepMenuOpen(e, true)) closeMenuRequest(e);
			}

			break;
			
		case "siteSearchFolder":

			tile = buildSearchIcon(getIconFromNode(node), node.title);
			tile.dataset.type = 'siteSearchFolder';
			tile.dataset.id = node.id || "";	
			tile.dataset.title = node.title;

			tile.dataset.type = 'folder';
			tile.dataset.subtype = 'sitesearch';

			break;

		case "siteSearch":
			tile = buildSearchIcon(getIconFromNode(node), node.title);
			tile.dataset.type = 'siteSearch';
			tile.dataset.title = node.title;
			break;
			
		case "bookmark":
			tile = buildSearchIcon(node.icon, node.title);
			tile.dataset.type = 'bookmark';
			tile.dataset.id = node.id || "";	
			tile.dataset.title = node.title;			
			break;

		case "tool":
			let tool = QMtools.find(t => t.name === node.tool )
			tile = tool.init();
			tile.dataset.type = 'tool';
			tile.dataset.id = node.id;	
			tile.dataset.title = node.title;
			break;

		case "externalProgram":
			tile = buildSearchIcon(getIconFromNode(node), node.title);
			tile.dataset.type = 'externalProgram';	
			tile.dataset.title = node.title;
			tile.dataset.id = node.id;
			break;

		default:
			return null;
	}
	
	tile.node = node;

	if ( userOptions.showDescriptionsInTooltips && node.description )
		tile.title += ' - ' + node.description;

	// build menu with hidden engines for show/hide tool
	if ( node.hidden ) tile.style.display = 'none';
	
	return tile;
}

function makeMoreLessFromTiles( _tiles, limit, noFolder, parentNode, node ) {

	noFolder = noFolder || false;

	if ( !_tiles.length ) return [];

	let hidden_count = _tiles.length - limit;
	if ( hidden_count < 0 ) hidden_count = 0;
	let title = hidden_count + " " + browser.i18n.getMessage("more");

	parentNode = parentNode || qm;
	node = node || parentNode.node || {}
	let classList = _tiles[0].classList;

	if ( !noFolder && node.parent ) {
		let label = nodeToTile( node );
		label.classList.add("groupFolder", "textShadow");
		_tiles.unshift( label );
	}

	// use a referenced id on GROUPs for more() tracking
	if ( !node.id ) {
		let tile = _tiles.find( t => t.node && t.node.parent );
	//	if ( tile ) node.id = tile.node.parent.id;

		if ( tile ) node = tile.node.parent;
	}

	if ( !node.id ) node.id = parentNode.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();

	if ( limit >= _tiles.length ) return _tiles;

	let moreTile = buildSearchIcon(null, browser.i18n.getMessage('more'));
	moreTile.appendChild(makeToolMask({icon: "icons/chevron-down.svg"}));

	moreTile.style.textAlign='center';
	moreTile.dataset.type = "more";
	moreTile.dataset.title = moreTile.title = title;
	moreTile.classList = classList;
	moreTile.classList.add('groupFolder')
	moreTile.node = { parent: node };
	moreTile.dataset.parentid = node.id;
	moreTile.dataset.undraggable = true;
	moreTile.keepOpen = true;
	
	function more() {
		let hiddenEls = parentNode.querySelectorAll('[data-hidden="true"]');
		hiddenEls.forEach( _div => {

			// ignore divs not associated with this more tile
			if ( _div.moreTile !== moreTile ) return;
			
			_div.style.transition = 'none';
			_div.style.opacity = 0;

			_div.dataset.hidden = "false";
			_div.style.display = null;

			_div.style.transition = null;
			_div.offsetWidth;
			_div.style.opacity = null;

		});
		
		moreTile.action = less;
		moreTile.dataset.title = moreTile.title = browser.i18n.getMessage("less");
		moreTile.dataset.type = "less";
		resizeMenu({more: true});

		// use dataset.parentid instead of node.id in case it's been changed
		if ( !moreLessStatus.includes( moreTile.dataset.parentid ) )
			moreLessStatus.push(moreTile.dataset.parentid);
	}
	
	function less() {
		parentNode.querySelectorAll('[data-hidden="false"]').forEach( _div => {

			// ignore divs not associated with this more tile
			if ( _div.moreTile !== moreTile ) return;
			
			_div.dataset.hidden = "true";
			_div.style.display = "none";

			//hideTile(_div);
		});
		
		moreTile.action = more;
		moreTile.dataset.title = moreTile.title = title;
		moreTile.dataset.type = "more";
		
		moreLessStatus = moreLessStatus.filter( id => id !== moreTile.dataset.parentid );
		resizeMenu({more: true, less:true});
	}

	moreTile.more = more;
	moreTile.less = less;
	moreTile.action = more;
	
	moreTile.expandTimerStart = () => { moreTile.expandTimer = setTimeout( moreTile.dataset.type === "more" ? more : less, dragFolderTimeout )};	
	
	moreTile.addEventListener('dragenter', e => {
		moreTile.expandTimerStart();
	
		['dragleave', 'drop', 'dragexit', 'dragend'].forEach( _e => { moreTile.addEventListener(_e, () => clearTimeout(moreTile.expandTimer), {once: true}); } );
	});

	let count = 1;
	_tiles.forEach( ( _tile, index ) => {
		
		if ( _tile.dataset.hidden == "true" || _tile.style.display === 'none' ) return false;

		if ( count > limit ) hideTile(_tiles[index], moreTile);
		
		count++;
	});

	// if ( userOptions.groupLabelMoreTile && node !== qm.rootNode) {
		
	// 	moreTile.classList.remove('tile');
	// 	moreTile.classList.add('groupLabelMoreTile');
		
	// 	['mouseup', 'click'].forEach( _e => {
	// 		moreTile.addEventListener(_e, e => e.stopPropagation() );
	// 	});
		
	// 	if ( !node.groupHideMoreTile ) label.appendChild(moreTile);
		
	// } else {

		if ( !node.groupHideMoreTile ) {

			_tiles.push( moreTile );
			// console.log(node, moreTile);
		}
	//	else console.log('not pushing moreTile', node);
	// }

	return _tiles;
}

function makeGroupFolderFromTile(gf) {

	// ignore non-top tier
//	if ( !gf.node.parent ) return;
	if ( gf.node.parent !== qm.rootNode ) {
		console.log('skipping group', gf.node.parent, qm.rootNode);
		return;
	}

	let children = [...qm.querySelectorAll('.tile')].filter( t => t.node && t.node.parent === gf.node );

	// tile is folder, but no children tiles in qm
	if ( !children.length && gf.node.children.length ) {
		qm.insertBefore(gf, qm.firstChild);
		gf.node.children.forEach( node => {
			let tile = nodeToTile(node);
			tile.classList.add('tile');
			children.push(tile);
		});
	}

	if ( !children.length ) return;

	let g = document.createElement('group');

	if ( gf.node.groupColor ) 
		g.style.setProperty("--group-color", gf.node.groupColor);

	if ( gf.node.groupColorText ) 
		g.style.setProperty("--group-color-text", gf.node.groupColorText);

	g.node = gf.node;

	if ( gf.node.groupFolder && ['inline', 'block'].includes(gf.node.groupFolder) )
		g.classList.add(gf.node.groupFolder);

	if ( g.classList.contains('inline') ) {
		let mlt = makeMoreLessFromTiles(children, gf.node.groupLimit || Number.MAX_SAFE_INTEGER);
		mlt.forEach(c => g.appendChild(c));
	} else {

		let label = document.createElement('label');
	//	label.className = 'textShadow';
		label.innerText = gf.node.title;
		label.style.position = 'relative';
		label.node = gf.node;
		
		if ( g.classList.contains('block')) g.appendChild(label);

		// label.ondblclick = e => {
		// 	e.preventDefault();
		// 	e.stopPropagation();

		// 	g.querySelectorAll('.tile').forEach( t => {
		// 		t.classList.toggle('singleColumn');

		// 		if ( t.classList.contains('singleColumn')) {
		// 			t.style.maxWidth = 'none !important';
		// 			t.style.minWidth = 'none !important';
		// 		}

		// 	});

		// 	runAtTransitionEnd(g, ['height', 'width'], () => resizeMenu({more: true}), 50);
		// 	runAtTransitionEnd(g.querySelector('.tile:not([data-hidden])'), ['height', 'width'], () => resizeMenu({more: true}), 50);
		// }

		let groupQM = document.createElement('div');
		groupQM.className = 'container';
		children.forEach( c => groupQM.appendChild(c));
		g.appendChild(groupQM);

		let footer = document.createElement('label');
		g.appendChild(footer);

		footer.classList.add('footer');

		// footer.draggable = false;

		// footer.addEventListener('mousedown', e => {
		// 	e.preventDefault();
		// 	e.stopPropagation();
		// }, {capture: true})

		// footer.addEventListener('dragstart', e => {
		// 	e.preventDefault();
		// 	e.stopPropagation();
		// 	console.log('dragstart');
		// 	return false;
		// }, {capture: true})
	}

	if ( userOptions.groupFolderRowBreaks && g.classList.contains('inline')) {
		g.classList.add('break');
	}

	return g;
}

function makeContainerMore(el, rows, columns) {
	rows = rows || Number.MAX_SAFE_INTEGER;

	let elementsBeforeWrap = getElementCountBeforeOverflow(el, rows);

	let visibleCount = columns ? rows * columns : elementsBeforeWrap;

	let moreified = makeMoreLessFromTiles([...el.children], visibleCount, true, el);
	el.innerHTML = null;

	if (moreified)
		moreified.forEach(t => el.appendChild(t));
}

function getElementCountBeforeOverflow(el, rows) {

	el.style.transition = 'none';
	el.style.position = 'relative';
	el.style.overflow = 'auto';

	if ( !el.firstChild || el.firstChild.offsetTop == el.lastChild.offsetTop ) return Number.MAX_SAFE_INTEGER;

	let rowCount = 0;

	let wrap = null;

	for ( c of [...el.children]) {
		if ( c.nextSibling && c.offsetTop !== c.nextSibling.offsetTop) rowCount++;

		if ( rowCount === rows ) {
			wrap = c;
			break;
		}
	}

	el.style.position = null;
	el.style.transition = null;
	el.style.overflow = null;

	if ( !wrap ) return Number.MAX_SAFE_INTEGER;

	let preWrap = wrap.previousSibling;

	return [...el.children].indexOf(wrap);
}

function hideTile(el, moreTile) {
	el.style.display = 'none';
	el.dataset.hidden = 'true';

	if ( moreTile) {
		el.moreTile = moreTile;
		el.dataset.morehidden = 'true';
	}
}

function unhideTile(el) {
	el.style.display = null;
	delete el.dataset.hidden;
	delete el.dataset.morehidden;
}

function initOptionsBar() {

	document.querySelector('#folderOptionsButton').onclick = function() {
		let fo = document.querySelector('#folderOptionsDiv');

		fo.style.maxHeight = fo.style.maxHeight ? null : fo.scrollHeight + "px";
		runAtTransitionEnd(fo, "max-height", resizeMenu);
	}
}

function setOptionsBar() {

	let optionsBar = document.querySelector('#optionsBar');

	if ( !optionsBar ) return;

	optionsBar.style.display = null;

	if ( !qm.rootNode.parent ) return;

	let node = findNode(userOptions.nodeTree, n => n.id === qm.rootNode.id );

	// check for generated folders
	if ( !node ) return;

	let form = optionsBar.querySelector('form');

	form.title.value = node.title;

	optionsBar.style.display = 'block';

}

function updateMatchRegexFolder(s) {

	let folder = matchingEnginesToFolder(s || quickMenuObject.searchTerms);

	qm.querySelectorAll(`[data-type="folder"]`).forEach(f => {
		if ( f.node.id == folder.id ) f.node = folder;
	});
}

function setLayoutOrder(arr) {

	if ( !arr ) return;

	if ( typeof arr === 'string')
		arr = arr.split(",").map(id => id.trim());

	arr.forEach(id => {

		let hidden = false;
		if ( id[0] === '!' ) {
			hidden = true;
			id = id.substring(1);
		}

		let el = document.getElementById(id);

		if ( !el ) return console.log('bad id', id);
		
		el.classList.toggle('hide', hidden);
		document.body.appendChild(el);

	});
}
