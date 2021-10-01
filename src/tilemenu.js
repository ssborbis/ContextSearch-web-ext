// unique object to reference globally
var quickMenuObject = { 
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

var dragFolderTimeout = 500

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

//#Source https://bit.ly/2neWfJ2 
const every_nth = (arr, nth) => arr.filter((e, i) => i % nth === nth - 1);

var moreLessStatus = [];

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

function saveUserOptions() {
	return browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
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

	var borderLeft = parseFloat(style.borderLeftWidth) || 0;
	var borderRight = parseFloat(style.borderRightWidth) || 0;
	var borderTop = parseFloat(style.borderTopWidth) || 0;
	var borderBottom = parseFloat(style.borderBottomWidth) || 0;

	let fullWidth = rect.width + marginLeft + marginRight - ( paddingLeft + paddingRight ) + borderLeft + borderRight;
	let fullHeight = rect.height + marginTop + marginBottom - ( paddingTop + paddingBottom ) + borderTop + borderBottom;

	return {width: fullWidth, height: fullHeight, rectWidth: rect.width, rectHeight: rect.height, noBorderWidth: fullWidth - borderLeft - borderRight };
}

// generic search engine tile
function buildSearchIcon(icon_url, title) {
	var div = document.createElement('DIV');

	if ( icon_url )	div.style.backgroundImage = 'url("' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + '")';
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
		
		resizeMenu({toggleSingleColumn: true});
	}
	
	qm.addTitleBarTextHandler = div => {
		
		['mouseenter','dragenter'].forEach( ev => {
			div.addEventListener(ev, () => tb.innerText = div.title || div.dataset.title)
		});
		
		div.addEventListener('mouseleave', () => tb.innerText = '');
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
		let firstTile = qm.querySelector('.tile:not([data-hidden])');
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
		sb.value = quickMenuObject.searchTerms.replace(/[\r|\n]+/g, " ");
	});

	// prevent click events from propagating
	[/*'mousedown',*/ 'mouseup', 'click', 'contextmenu'].forEach( eventType => {

		qm.addEventListener(eventType, e => {

			if ( e.target.closest('.tile')) return;
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

				sb.value = text;
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

		let tiles = qm.querySelectorAll('.tile:not([data-hidden="true"])');

		let br = () => document.createElement('br');

		let count = 1;
		tiles.forEach( t => {
			let closestBlock = t.closest('GROUP.block');

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
		})

		// remove doubles
		qm.querySelectorAll('br').forEach( br => {
			if (br.previousSibling && br.previousSibling.nodeName === 'BR')
				br.parentNode.removeChild(br);
		});
		// qm.querySelectorAll('br').forEach( lc => {
		// 	console.log('break after', lc.previousSibling);
		// })

		// qm.querySelectorAll('GROUP.block .container:last-child').forEach( lc => {
		// 	console.log(lc.nodeName);
		// })

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
		//if (!_singleColumn) tileArray = tileArray.filter( tile => tile.dataset.type !== 'separator' );
	
		qm.singleColumn = _singleColumn;
			
		// make rows / columns
		tileArray.forEach( tile => {
			
			tile.classList.add('tile');

			if (_singleColumn) tile.classList.add("singleColumn");
			
			if ( !_singleColumn && tile.node && tile.node.type === 'folder' && tile.dataset.type === 'folder' ) {
				
				if ( tile.node.icon )
					tile.dataset.hasicon = 'true'; // removes pseudo element label set by content:attr(data-title) in quickmenu.css 
				else
					tile.style.backgroundImage = 'url(' + browser.runtime.getURL('icons/transparent.gif') + ')';
			}

			qm.appendChild(tile);
		});

		qm.getTileSize = () => { 

			let div = document.createElement('div');
			div.className = "tile";
			
			if ( qm.singleColumn ) div.classList.add('singleColumn');
			qm.appendChild(div);

			let size = getFullElementSize(div);
			
			qm.removeChild(div);

			return size;
		};
		
		qm.setDisplay = () => {
			qm.querySelectorAll('.tile').forEach( _tile => {
				if (qm.singleColumn || qm.rootNode.displayType === "text" ) _tile.classList.add("singleColumn");
				else _tile.classList.remove("singleColumn");
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

		/* dnd */
		let tileDivs = qm.querySelectorAll('.tile:not([data-type="tool"])');
		tileDivs.forEach( div => {

			div.setAttribute('draggable', window.tilesDraggable);
	
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

			// div.addEventListener('dragstart', e => {

			// 	if ( !window.tilesDraggable ) return false;

			// 	e.dataTransfer.setData("text", "");
			// 	let img = new Image();
			// 	img.src = browser.runtime.getURL('icons/transparent.gif');
			// 	e.dataTransfer.setDragImage(img, 0, 0);
			// 	div.id = 'dragDiv';
			// 	div.style.opacity = .5;
			// });
			// div.addEventListener('dragover', e => {
			// 	e.preventDefault();
				
			// 	let targetDiv = getTargetElement(e.target);
			// 	if ( !targetDiv || isTool(e) ) return;
			// 	let dragDiv = document.getElementById('dragDiv');

			// 	if ( targetDiv === dragDiv ) return;

			// 	targetDiv.classList.add('dragHover');

			// 	// if moving tiles, show arrow
			// 	if ( dragDiv ) {
					
			// 		let side = getSide(targetDiv, e);
			// 		targetDiv.dataset.side = side;
					
			// 		let arrow = document.getElementById('arrow');
			// 		arrow.style.display = null;
					
			// 		let rect = targetDiv.getBoundingClientRect();
			// 		arrow.style.setProperty('--target-left', rect.left + "px");
			// 		arrow.style.setProperty('--target-top', rect.top + "px");
			// 		arrow.style.setProperty('--target-width', rect.width + "px");
			// 		arrow.style.setProperty('--target-height', rect.height + "px");
			// 		arrow.dataset.side = side;
					
			// 		if ( targetDiv.classList.contains("groupFolder") && !targetDiv.classList.contains('groupMove') ) {
						
			// 			let dec = getSideDecimal(targetDiv, e);
						
			// 			let targetGroupDivs = getGroupFolderSiblings(targetDiv);

			// 			if ( isTargetBeforeGroup(targetDiv, dec) ) 
			// 				targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
			// 			else if ( isTargetAfterGroup(targetDiv, dec) ) 
			// 				targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
			// 			else
			// 				targetGroupDivs.forEach( el => el.classList.add("groupHighlight") );
			// 		}
			// 	}
			// });
			// div.addEventListener('dragenter', e => {

			// 	let targetDiv = getTargetElement(e.target);
			// 	if ( !targetDiv || isTool(e) ) return;

			// 	targetDiv.style.transition = 'none';
				
			// 	let dragDiv = document.getElementById('dragDiv');
				
			// 	if ( !dragDiv && targetDiv.dataset.type === 'folder' ) {

			// 		// open folders on dragover
			// 		targetDiv.textDragOverFolderTimer = openFolderTimer(targetDiv, dragFolderTimeout);
			// 		return;
			// 	}
				
			// 	// if moving tiles, show indicator
			// 	if ( dragDiv ) {
			// 		let arrow = document.getElementById('arrow');
						
			// 		if ( !arrow ) {
			// 			arrow = document.createElement('div');
			// 			document.body.appendChild(arrow);
			// 		}
			// 		arrow.className = ( qm.singleColumn ) ? 'singleColumn' : null;
					
			// 		arrow.id = 'arrow';
			// 		arrow.style.top = targetDiv.getBoundingClientRect().top + "px";
			// 		arrow.style.display = null;
			// 	}
			// });
			// div.addEventListener('dragleave', e => {
			// 	let targetDiv = getTargetElement(e.target);
			// 	if ( !targetDiv || isTool(e) ) return;

			// 	targetDiv.classList.remove('dragHover');
			// 	targetDiv.style.transition = null;
				
			// 	delete targetDiv.dataset.side;
				
			// 	if ( targetDiv.textDragOverFolderTimer )
			// 		clearTimeout(targetDiv.textDragOverFolderTimer);
				
			// 	let arrow = document.getElementById('arrow');
			// 	if ( arrow ) arrow.style.display = 'none';
				
			// 	getGroupFolderSiblings(targetDiv).forEach( el => el.classList.remove('groupHighlight') );
			// });
			// div.addEventListener('dragend', async e => {
				
			// 	if ( isTool(e) ) return;

			// 	let dragDiv = document.getElementById('dragDiv');
				
			// 	if ( dragDiv ) {
			// 		dragDiv.style.opacity = null;
			// 		dragDiv.id = "";
			// 	}

			// 	let targetDiv = getTargetElement(e.target);
			// 	if ( targetDiv ) targetDiv.classList.remove('dragHover');

			// 	let arrow = document.getElementById('arrow');
			// 	if ( arrow ) arrow.style.display = 'none';

			// 	// store scroll position
			// 	let scrollPos = qm.scrollTop;
				
			// 	let animation = userOptions.enableAnimations;
			// 	userOptions.enableAnimations = false;
			// 	qm = await quickMenuElementFromNodeTree(qm.rootNode);
			// 	userOptions.enableAnimations = animation;

			// 	qm.expandMoreTiles();
				
			// 	qm.scrollTop = scrollPos;

			// 	resizeMenu({tileDrop: true});
				
			// });
			
		// 	div.addEventListener('drop', e => {
		// 		e.preventDefault();
				
		// 		if ( isTool(e) ) return;
				
		// 	//	console.log(e.dataTransfer, e.dataTransfer.getData("text/html"), e.dataTransfer.getData("text/x-moz-place"), e.dataTransfer.getData("text/x-moz-url"));
			
		// 		// console.log(e, e.dataTransfer);
		// 		// console.log(e.dataTransfer.getData("text"));
				
		// 		let targetDiv = getTargetElement(e.target);
		// 		targetDiv.classList.remove('dragHover');

		// 		// look for text dnd
		// 		if ( e.dataTransfer.getData("text") && !e.dataTransfer.getData("text/x-moz-place") ) {
		// 			e.preventDefault();
		// 			sb.value = e.dataTransfer.getData("text");
		// 			div.parentNode.lastMouseDownTile = div;
		// 			div.dispatchEvent(new MouseEvent('mouseup'));
		// 			return;
		// 		}

		// 		let dragDiv = document.getElementById('dragDiv');

		// 		// firefox DnD for bookmarks
		// 		if ( e.dataTransfer.getData("text/x-moz-place") ) {
		// 			let _bm = JSON.parse(e.dataTransfer.getData("text/x-moz-place"));
					
		// 			if ( !_bm.uri ) return; // ignore folders

		// 			dragDiv = nodeToTile({
		// 				title: _bm.title,
		// 				type: "bookmark",
		// 				uri: _bm.uri,
		// 				id: _bm.itemGuid,
		// 				parent: targetDiv.node.parent,
		// 				toJSON: targetDiv.node.toJSON,
		// 				icon: browser.runtime.getURL('icons/search.svg')
		// 			});

		// 			dragDiv.className = "tile";
		// 			targetDiv.parentNode.appendChild(dragDiv);
		// 			targetDiv.node.parent.children.push(dragDiv.node);

		// 			try {
		// 				let _url = new URL(_bm.uri);
		// 				let img = new Image();

		// 				img.onload = () => {
		// 					dragDiv.node.icon = imageToBase64(img, userOptions.cacheIconsMaxSize);
		// 					dragDiv.style.backgroundImage = `url(${dragDiv.node.icon})`;
							
		// 					setTimeout(() => {
		// 						userOptions.nodeTree = JSON.parse(JSON.stringify(root));
		// 						saveUserOptions();
		// 					}, 500);
							
		// 				}
		// 				img.src = 'https://s2.googleusercontent.com/s2/favicons?domain_url=' + _url.hostname;
		// 			} catch (error) {
		// 				console.log(error);
		// 			}
		// 		}	

		// 		if (!targetDiv) return;
		// 		if (!dragDiv || !dragDiv.node) return;
		// 		if (targetDiv === dragDiv) return;
		// 		if ( dragDiv.groupMove && targetDiv.node.parent === dragDiv.node.parent ) {
		// 			console.error('cannot group move within parent');
		// 			return;
		// 		}
				
		// 		let dragNode = ( dragDiv.groupMove) ? dragDiv.node.parent : dragDiv.node;
		// 		let targetNode = targetDiv.node;

		// 		// cut the node from the children array
		// 		let slicedNode = nodeCut(dragNode);

		// 		let side = getSide(targetDiv, e);
	
		// 		if ( targetDiv.classList.contains("groupFolder") ) {
					
		// 			let dec = getSideDecimal(targetDiv, e);
					
		// 			if ( isTargetBeforeGroup(targetDiv, dec) ) {
		// 				console.log('moving before group');
		// 				nodeInsertBefore(slicedNode, targetNode.parent);
		// 				_save();
		// 				return;
		// 			} else if ( isTargetAfterGroup(targetDiv, dec) ) {
		// 				console.log('moving after group');
		// 				nodeInsertAfter(slicedNode, targetNode.parent);
		// 				_save();
		// 				return;
		// 			}
					
		// 			if ( targetDiv.dataset.type && ['more','less'].includes(targetDiv.dataset.type) ) {
		// 				console.log('drop to more / less tile ... appending tile to group');
		// 				nodeAppendChild(slicedNode, targetNode.parent);	
		// 				_save();
		// 				return;
		// 			}
		// 		}

		// 		if ( side === "before" ) nodeInsertBefore(slicedNode, targetNode);
		// 		else if ( side === "after" ) nodeInsertAfter(slicedNode, targetNode);
		// 		else nodeAppendChild(slicedNode, targetNode);
				
		// 		_save();
				
		// 		function _save() {
		// 			// save the tree
		// 			userOptions.nodeTree = JSON.parse(JSON.stringify(root));
		// 			saveUserOptions();
		// 		}
		// 	});
			
		});
		
		/* end dnd */

		
		(() => { // addRecentlyUsedFolder()
			if ( !qm.rootNode.parent && userOptions.quickMenuShowRecentlyUsed ) {
				let recentFolder = nodeToTile(recentlyUsedListToFolder());
				recentFolder.classList.add('tile');
				recentFolder.dataset.hasicon = 'true';
				tileArray.unshift(recentFolder);
				qm.insertBefore(recentFolder, qm.firstChild);
			}
		})();

		qm.setDisplay();

		(() => { //formatGroupFolders()

			let groupFolders = tileArray.filter( t => t.node && t.node.groupFolder && t.dataset.type !== 'tool' && t.node.parent === qm.rootNode );

			groupFolders.forEach( gf => {

				let g = makeGroupFolderFromTile(gf);
				if ( !g ) return;

				qm.insertBefore(g, gf);
				if ( gf.parentNode && g.classList.contains('block') ) gf.parentNode.removeChild(gf);
				else {
					gf.style.backgroundColor = gf.node.groupColor ? 'var(--group-color)' : null;
					g.insertBefore(gf, g.querySelector('.tile') || g.lastChild);
				}

				let footer = g.querySelector('.footer');

				// display groups limited to a row count and change more tile style
				if ( gf.node.groupFolder === "block") {
					makeContainerMore(g.querySelector('.container'), gf.node.groupLimit, qm.columns);
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
			let moreTiles = [...qm.querySelectorAll('[data-type="more"]')];

			moreLessStatus.forEach( id => {
				let moreTile = moreTiles.find( div => div.dataset.parentid === id );
				
				if ( moreTile ) moreTile.dispatchEvent(new MouseEvent("mouseup"));
			});
		}
		
		qm.expandMoreTiles();

		toolsHandler();

		return qm;
	}

	async function quickMenuElementFromNodeTree( rootNode, reverse ) {

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

			tile.dataset.type = "tool";
			tile.node = rootNode.parent;
	
			tile.addEventListener('mouseup', _back);
			tile.addEventListener('openFolder', _back);

			addOpenFolderOnHover(tile);
			
			qm.back = _back;
			
			async function _back(e) {

				// back button rebuilds the menu using the parent folder ( or parent->parent for groupFolders )
				qm = await quickMenuElementFromNodeTree(( rootNode.parent.groupFolder ) ? rootNode.parent.parent : rootNode.parent, true);

				resizeMenu({openFolder: true});
			}
			
			tile.addEventListener('dragenter', e => {
				// ignore tile dnd
				if ( document.getElementById('dragDiv') ) return;
				
				// start hover timer
				tile.textDragOverFolderTimer = openFolderTimer(tile, dragFolderTimeout);;
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
				
				let slicedNode = nodeCut(dragNode);
				
				slicedNode.parent = targetNode;
					
				// add to target children
				targetNode.children.push(slicedNode);
				
				// save the tree
				userOptions.nodeTree = JSON.parse(JSON.stringify(root));
				
				saveUserOptions();
				
				// rebuild menu
				let animation = userOptions.enableAnimations;
				userOptions.enableAnimations = false;
				qm = await quickMenuElementFromNodeTree(rootNode);
				userOptions.enableAnimations = animation;
				resizeMenu();				
			});
			
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
						
			if ( node.groupFolder && !node.parent.parent) { // only top-level folders
			
				let groupTiles = makeGroupTilesFromNode( node );

				tileArray = tileArray.concat(groupTiles);
			}

		});

		qm.makeMoreLessFromTiles = makeMoreLessFromTiles;

		return buildQuickMenuElement({tileArray:tileArray, reverse: reverse, parentId: rootNode.parent, forceSingleColumn: rootNode.forceSingleColumn, node: rootNode});
	}
	
	window.quickMenuElementFromNodeTree = quickMenuElementFromNodeTree;

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
				
			saveDebounce = setTimeout(() => {
				saveUserOptions();
				saveDebounce = null;
				console.log('executing save');
			}, 200);	
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
	
	// sb.addEventListener('keydown', (e) => {
	// 	if (e.key === "Enter" && userOptions.searchBarCloseAfterSearch) {
	// 		setTimeout(window.close, 100);
	// 	}
	// });
	
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

function getPreviousSiblingOfType(el) {
	let s = el.previousSibling;
	while( s && s.nodeName !== el.nodeName ) s = s.previousSibling;
	return s;
}

function getNextSiblingOfType(el) {
	let s = el.nextSibling;
	while( s && s.nodeName !== el.nodeName ) s = s.nextSibling;
	return s;
}

function isTargetBeforeGroup(el, dec) {
	let sibling = getPreviousSiblingOfType(el);
	return ( dec < .2 && ( !sibling || sibling.node.parent !== el.node.parent ));
}

function isTargetAfterGroup(el, dec) {
	let sibling = getNextSiblingOfType(el);
	return ( dec > .8 && ( !sibling || sibling.node.parent !== el.node.parent ));
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
			openMethod: userOptions.quickMenuSearchHotkeys
		}
	}).then(() => {
		if ( !keepMenuOpen(e) )
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});

		if (type === 'searchbar' && userOptions.searchBarCloseAfterSearch) window.close();
	});

}

getAllOtherHeights = () => {
	return getFullElementSize(sbc).height + getFullElementSize(tb).height + getFullElementSize(mb).height + getFullElementSize(toolBar).height + getFullElementSize(aeb).height;
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
	let tile = e.target.closest('.tile');

	if ( !tile ) return;

	if ( !tile.node && !tile.action ) {
		console.log('no node or action', tile);
		return;
	}

	if ( window.tilesDraggable ) return;

	// if (tile.node.type && !['searchEngine', 'bookmarklet', 'oneClickSearchEngine', 'siteSearch', 'siteSearchFolder'].includes(tile.node.type)) return;

	tile.parentNode.lastMouseDownTile = tile;

	e.preventDefault();
});

// tools
document.addEventListener('mouseup', e => {

	if ( !e.target.closest ) return;

	let tile = e.target.closest('.tile');

	if ( !tile || !tile.action ) return;

	if ( tile.disabled ) return false;

	if ( window.tilesDraggable && !tile.dataset.type === "tool" && !tile.dataset.name === "edit") return false;

	if ( mouseClickBack(e) ) return;

//	if ( !clickChecker(tile) ) return;

	e.stopImmediatePropagation();
	e.preventDefault();

	tile.action(e);

	if ( !keepMenuOpen(e) && !tile.keepOpen )
		closeMenuRequest(e);
});

document.addEventListener('mouseup', e => {

	console.log(e);

	// docking drag throws error on HTMLDocument element
	if ( !e.target.closest) return;

	let tile = e.target.closest('.tile');

	if ( !tile || !tile.node ) return;

	if (tile.node && tile.node.type && !['searchEngine', 'bookmarklet', 'oneClickSearchEngine', 'siteSearch', 'siteSearchFolder'].includes(tile.node.type)) return;

	if ( tile.disabled ) return false;

	if ( window.tilesDraggable ) return false;

	if ( mouseClickBack(e) ) return;

	if ( !clickChecker(tile) ) return;

	e.stopImmediatePropagation();
	e.preventDefault();

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

	let searchPromise = (() => {

		switch ( node.type ) {
		
			case 'searchEngine':
				return browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.node.id,
						selectionText: sb.value,
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

			default:
				return Promise.reject();
				break;

		}
	})();

	searchPromise.then(() => {
		// check for locked / Keep Menu Open 
		if ( !keepMenuOpen(e) && !tile.keepOpen )
			closeMenuRequest(e);
	}, () => {});

	return false;

});

document.addEventListener('dragstart', e => {

	let tile = e.target.closest('.tile');

	if ( !tile ) return;

	if ( !window.tilesDraggable ) return;

	e.dataTransfer.setData("id", tile.node.id);
	tile.classList.add('drag');

	qm.style.overflowY = 'hidden';

	let dummy = document.createElement('div');
	dummy.className = 'tile dummy';
	document.body.appendChild(dummy);

});

document.addEventListener('dragend', e => {

	e.preventDefault();

	let dummy = document.querySelector('.dummy');
	if ( dummy ) dummy.parentNode.removeChild(dummy);

	let tile = e.target.closest('.tile');

	if ( !tile ) return;

	let dragTile = document.querySelector('.drag');

	if ( !dragTile ) return;

});

document.addEventListener('dragenter', e => {

	let tile = e.target.closest('.tile');
	let dragTile = document.querySelector('.drag');

	if ( !tile ) return;

	if ( !dragTile && tile.dataset.type === 'folder' ) {

		// open folders on dragover
		tile.textDragOverFolderTimer = openFolderTimer(tile, dragFolderTimeout);
		return;
	}

	if ( !dragTile ) return;

	let side = getSide(tile, e);

});

document.addEventListener('dragover', e => {

	let tile = e.target.closest('.tile');
	let dragTile = document.querySelector('.drag');

	if ( !tile ) return;
	if ( !dragTile ) return;

	e.preventDefault();

	if ( tile.lastDragOver && Date.now() - tile.lastDragOver < 100 ) return;

	tile.lastDragOver = Date.now();

	let side = getSide(tile, e);

	let dummy = document.querySelector('.dummy');

	if ( side === 'before' )
		tile.parentNode.insertBefore(dummy, tile);
	if ( side === 'after' )
		tile.parentNode.insertBefore(dummy, tile.nextSibling);
	if ( side === 'middle' )
		document.body.appendChild(dummy);

	tile.dataset.side = side;

	tile.classList.add('dragHover');

	// if ( tile.classList.contains("groupFolder") && !tile.classList.contains('groupMove') ) {
		
	// 	let dec = getSideDecimal(tile, e);
		
	// 	let targetGroupDivs = getGroupFolderSiblings(tile);

	// 	if ( isTargetBeforeGroup(tile, dec) ) 
	// 		targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
	// 	else if ( isTargetAfterGroup(tile, dec) ) 
	// 		targetGroupDivs.forEach( el => el.classList.remove("groupHighlight") );
	// 	else
	// 		targetGroupDivs.forEach( el => el.classList.add("groupHighlight") );
	// }	
});

document.addEventListener('drop', e => {

	let tile = e.target.closest('.tile');
	let dragTile = document.querySelector('.drag');

	if ( !tile ) return;
	if ( !dragTile ) return;

	e.preventDefault();

	let side = getSide(tile, e);

	if ( side === 'before' )
		tile.parentNode.insertBefore(dragTile, tile);
	if ( side === 'after' )
		tile.parentNode.insertBefore(dragTile, tile.nextSibling);

	dragTile.classList.remove('drag');

	let dummy = document.querySelector('.dummy');
	if ( dummy ) dummy.parentNode.removeChild(dummy);

	// if ( side === 'middle' )
	// 	document.body.appendChild(dummy);

});

clearDragStyling = el => {
	let t = document.querySelector('.dragOver');
	if ( t ) t.classList.remove('dragOver', 'before', 'after', 'middle');
}


// document.addEventListener('dragleave', e => {

// 	let tile = e.target.closest('.tile');

// 	if ( !tile ) return;

// 	if ( tile.textDragOverFolderTimer )
// 		clearTimeout(tile.textDragOverFolderTimer);
// });

function nodeToTile( node ) {

	let tile = {};

	if (node.hidden) return;

	let getTitleWithHotkey = n => {
		if ( userOptions.quickMenuShowHotkeysInTitle ) 
			return n.title + (n.hotkey ? ` (${keyTable[n.hotkey]})` : "");
		else
			return n.title;
	}
	
	switch ( node.type ) {

		case "searchEngine":

			let se = userOptions.searchEngines.find(se => se.id === node.id);
			
			if (!se) {
				console.log('no search engine found for ' + node.id);
				return;
			}

			// site search picker
			if ( se.template.includes('{selectdomain}') )
				return nodeToTile(Object.assign(node, {type: "siteSearchFolder"}));

			tile = buildSearchIcon(getIconFromNode(node), getTitleWithHotkey(node));
			tile.dataset.title = getTitleWithHotkey(node);
				
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
	}
	
	tile.node = node;
	
	return tile;
}

function makeMoreLessFromTiles( _tiles, limit, noFolder, parentNode ) {

	noFolder = noFolder || false;

	if ( !_tiles.length ) return;

	let title = (_tiles.length - limit) + " " + browser.i18n.getMessage("more");

	_tiles.forEach( t => {
		// skip assigning group color to root / no group color folders
		if ( t.node && t.node.parent && t.node.parent.groupColor )
			t.style.backgroundColor = 'var(--group-color)';
	});

	parentNode = parentNode || qm;
	let node = parentNode.node || {}
	let classList = _tiles[0].classList;

	if ( !noFolder && node.parent ) {
		let label = nodeToTile( node );
		label.classList.add("groupFolder", "textShadow");
		_tiles.unshift( label );
	}

	if ( !node.id ) node.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();

	if ( !limit || limit >= _tiles.length ) return _tiles;

	let moreTile = buildSearchIcon(null, browser.i18n.getMessage('more'));
	moreTile.appendChild(makeToolMask({icon: "icons/chevron-down.svg"}));

	moreTile.style.textAlign='center';
	moreTile.dataset.type = "more";
	moreTile.dataset.title = moreTile.title = title;
	moreTile.classList = classList;
	moreTile.classList.add('groupFolder')
	moreTile.node = { parent: node };
	moreTile.dataset.parentid = node.id;
	
	moreTile.ondragstart = moreTile.ondragover = moreTile.ondragenter = moreTile.ondragend = moreTile.ondragleave = () => { return false; }
	moreTile.setAttribute('draggable', false);
	
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
		
		moreTile.onmouseup = less;	
		moreTile.dataset.title = moreTile.title = browser.i18n.getMessage("less");
		moreTile.dataset.type = "less";
		resizeMenu({more: true});

		if ( !moreLessStatus.includes( node.id ) )
			moreLessStatus.push(node.id);
	}
	
	function less() {
		parentNode.querySelectorAll('[data-hidden="false"]').forEach( _div => {

			// ignore divs not associated with this more tile
			if ( _div.moreTile !== moreTile ) return;
			
			_div.dataset.hidden = "true";
			_div.style.display = "none";
		});
		
		moreTile.onmouseup = more;
		moreTile.dataset.title = moreTile.title = title;
		moreTile.dataset.type = "more";
		
		moreLessStatus = moreLessStatus.filter( id => id !== moreTile.dataset.parentid );
		resizeMenu({more: true, less:true});
	}

	moreTile.more = more;
	moreTile.less = less;

	moreTile.onmouseup = more;
	
	moreTile.expandTimerStart = () => { moreTile.expandTimer = setTimeout( moreTile.dataset.type === "more" ? more : less, dragFolderTimeout )};	
	
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
			_tiles[index].dataset.morehidden = true;
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
		else console.log('not pushing moreTile', node);
	}

	return _tiles;
}

function makeGroupFolderFromTile(gf) {

	// ignore non-top tier
	if ( !gf.node.parent ) return;

	let children = [...qm.querySelectorAll('.tile')].filter( t => t.node && t.node.parent === gf.node );

	// tile is folder, but no children tiles in qm
	if ( !children.length && gf.node.children.length ) {
		qm.insertBefore(gf, qm.firstChild);
		gf.node.children.forEach( node => {
			let tile = nodeToTile(node);
			tile.classList.add('tile');
			children.push(tile);
		//	qm.appendChild(tile);
		});
	}

	if ( !children.length ) return;

	let g = document.createElement('group');

	if ( gf.node.groupColor ) 
		g.style.setProperty("--group-color", gf.node.groupColor);

//	g.style.display = Math.random() > .5 ? 'block' : 'inline';

	if ( gf.node.groupFolder && ['inline', 'block'].includes(gf.node.groupFolder) )
		g.classList.add(gf.node.groupFolder);

	if ( g.classList.contains('inline') ) {
		let mlt = makeMoreLessFromTiles(children, gf.node.groupLimit);
		mlt.forEach(c => g.appendChild(c));

	} else {

		let label = document.createElement('label');
	//	label.className = 'textShadow';
		label.innerText = gf.node.title;
		label.style.position = 'relative';
		label.node = gf.node;
		
		if ( g.classList.contains('block')) g.appendChild(label);

		label.ondblclick = e => {
			return false;

			e.preventDefault();
			e.stopPropagation();

			g.querySelectorAll('.tile').forEach( t => {
				t.classList.toggle('singleColumn');

				if ( t.classList.contains('singleColumn')) {
					t.style.maxWidth = 'none !important';
					t.style.minWidth = 'none !important';
				}

			});

			runAtTransitionEnd(g, ['height', 'width'], () => resizeMenu({more: true}), 50);
			runAtTransitionEnd(g.querySelector('.tile:not([data-hidden])'), ['height', 'width'], () => resizeMenu({more: true}), 50);
		}

		let groupQM = document.createElement('div');
		groupQM.className = 'container';
		children.forEach( c => groupQM.appendChild(c));
		g.appendChild(groupQM);

		// children.forEach( c => g.appendChild(c));

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

	return g;
}

function makeContainerMore(el, rows, columns) {
	rows = rows || Math.MAX_SAFE_INTEGER;
	let visibleCount = columns ? rows * columns : getElementCountBeforeOverflow(el, rows);

	let moreified = makeMoreLessFromTiles([...el.children], visibleCount, true, el);
	el.innerHTML = null;

	if (moreified)
		moreified.forEach(t => el.appendChild(t));
}

function getElementCountBeforeOverflow(el, rows) {

	el.style.transition = 'none';
	el.style.position = 'relative';
	el.style.overflow = 'auto';

	if ( !el.firstChild || el.firstChild.offsetTop == el.lastChild.offsetTop ) return 0;

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

	if ( !wrap ) return 0;

	let preWrap = wrap.previousSibling;

	return [...el.children].indexOf(wrap);
}

function recentlyUsedListToFolder() {
	let folder = {
		type: "folder",
		id: "___recent___",
		title: browser.i18n.getMessage('Recent'),
		children: [],
		parent: qm.rootNode,
		icon: browser.runtime.getURL('icons/history.svg')
	}

	userOptions.recentlyUsedList.forEach( (id,index) => {
		if ( index > userOptions.recentlyUsedListLength -1 ) return;
		let lse = findNode(userOptions.nodeTree, node => node.id === id);

		// filter missing nodes
		if ( lse ) folder.children.push(Object.assign({}, lse));
	});

	return folder;
}

(() => {

	function convertSearchActions() {

		const sa = {
			event:"mouseup",
			button:0,
			altKey:false,
			ctrlKey:false,
			metaKey:false,
			shiftKey:false,
			action: ""
		}

		// contextMenuClick: "openNewTab",
		// contextMenuMiddleClick: "openBackgroundTab",
		// contextMenuRightClick: "openCurrentTab",
		// contextMenuShift: "openNewWindow",
		// contextMenuCtrl: "openBackgroundTab",

		return [
			Object.assign({...sa}, {button: 0, action: userOptions.quickMenuLeftClick}),
			Object.assign({...sa}, {button: 2, action: userOptions.quickMenuRightClick}),
			Object.assign({...sa}, {button: 1, action: userOptions.quickMenuMiddleClick}),

			Object.assign({...sa}, {button: 0, altKey: true, action: userOptions.quickMenuAlt}),
			Object.assign({...sa}, {button: 0, shiftKey: true, action: userOptions.quickMenuShift}),
			Object.assign({...sa}, {button: 0, ctrlKey: true, action: userOptions.quickMenuCtrl}),

			Object.assign({...sa}, {event: "dblclick", button: 2, action: "doubleClickSearchAction"})
		];

		// quickMenuFolderLeftClick: "openFolder",
		// quickMenuFolderRightClick: "noAction",
		// quickMenuFolderMiddleClick: "openBackgroundTab",
		// quickMenuFolderShift: "openNewWindow",
		// quickMenuFolderCtrl: "noAction",
		// quickMenuFolderAlt: "noAction"
	}

	setTimeout(() => {
		var searchActions = convertSearchActions();

		searchActions.forEach( g => {
			document.addEventListener(g.event, e => {

				if ( !isSearchAction(g,e) ) return;

				console.log(g.action);
			})
		})

		document.addEventListener('contextmenu', e => {

			if ( window.contextMenuTimer ) {
				e.preventDefault();
				return document.dispatchEvent(new MouseEvent('dblclick', e));	
			}

			window.contextMenuTimer = setTimeout(() => {
				clearTimeout(window.contextMenuTimer);
				delete window.contextMenuTimer;
			}, 250);
		});

		// trigger dblclick event for other buttons
		let dblClickHandler = e => {
			if ( e.detail === 2 && e.button !== 0 ) {
				console.log(e);
				document.dispatchEvent(new MouseEvent('dblclick', e));
			}
		}
		document.addEventListener('mousedown', dblClickHandler);

		function isSearchAction(g, e) {

			return (
				e.altKey === g.altKey &&
				e.ctrlKey === g.ctrlKey &&
				e.shiftKey === g.shiftKey &&
				e.metaKey === g.metaKey &&

				g.button === e.button &&
				g.key === e.key
			)
		}
	}, 1000)

});

