var styleEl = document.createElement('style');

// Append <style> element to <head>
document.head.appendChild(styleEl);

function makeQuickMenu(options) {
	
	if ( userOptions.userStylesEnabled ) styleEl.innerText = userOptions.userStyles;

	let type = options.type;
	let mode = options.mode;

	let singleColumn = ( 
		(type === 'searchbar' && userOptions.searchBarUseOldStyle) ||
		(type === 'quickmenu' && userOptions.quickMenuUseOldStyle) ||
		(type === 'sidebar' && userOptions.sideBar.singleColumn)
	) ? true : false;
	
	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	// suggestions div for toolbar search
	let suggestions = document.getElementById('suggestions');

	if (suggestions) suggestions.tabIndex = -1;

	var quickMenuElement = document.getElementById('quickMenuElement') || document.createElement('div');
	quickMenuElement.id = 'quickMenuElement';
	quickMenuElement.tabIndex = -1;
	
	quickMenuElement.dataset.menu = type;
	document.body.dataset.menu = type;
	
	var columns = (() => {
		if (singleColumn) return 1;
		if (type === 'searchbar') return userOptions.searchBarColumns;
		if (type === 'sidebar') return userOptions.sideBar.columns;
		if (type === 'quickmenu') return userOptions.quickMenuColumns;
	})();

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
	
	// enter key invokes search
	document.addEventListener('keydown', (e) => {
		if (e.keyCode === 13) {

			let div = quickMenuElement.querySelector('div.selectedFocus') || quickMenuElement.querySelector('div[data-id]');
			
			if (!div) return;
			
			div.parentNode.lastMouseDownTile = div;
			div.dispatchEvent(new MouseEvent('mouseup'));
		}	
	});

	// tab and arrow keys move selected search engine
	sb.addEventListener('focus', () => {
		
		let div = quickMenuElement.querySelector('.selectedFocus');
		if (div) div.classList.remove('selectedFocus');
		
		delete sb.selectedIndex;
		
		div = quickMenuElement.querySelector('div[data-id]');
		if (div) div.classList.add('selectedNoFocus');

	});
	
	sb.addEventListener('blur', () => {
		let div = quickMenuElement.querySelector('div[data-id]');
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
	
	quickMenuElement.selectFirstTile = function() {
		let firstTile = quickMenuElement.querySelector('.tile:not([data-hidden])');
		firstTile.classList.add('selectedFocus');
		sb.selectedIndex = [].indexOf.call(quickMenuElement.querySelectorAll(".tile"), firstTile);
	}

	sb.addEventListener('keydown', (e) => {

		if ( [ 38, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
		
		let direction = ( e.keyCode === 40 || ( e.keyCode === 9 && !e.shiftKey) ) ? 1 : -1;

		sb.selectionEnd = sb.selectionStart;
		
		// move focus to suggestions 
		if ( direction === 1 && suggestions ) {

			let rows = suggestions.getElementsByTagName('div');
			
			if ( rows.length > 0) {

				rows.item(0).click();
				
				e.preventDefault();
				suggestions.focus();

			} else {
				e.preventDefault();
				quickMenuElement.focus();
				quickMenuElement.selectFirstTile();
			}
			
			return;
		} else {
			e.preventDefault();
			quickMenuElement.focus();
			
			let divs = quickMenuElement.querySelectorAll('.tile:not([data-type="tool"]):not([data-hidden])');
			
			let selectedDiv = ( direction === 1 ) ? divs[0] : divs[divs.length - 1];

			selectedDiv.classList.add('selectedFocus');
			sb.selectedIndex = [].indexOf.call(quickMenuElement.querySelectorAll('.tile'), selectedDiv);
		}
	});
	
	if (suggestions) {
		suggestions.addEventListener('keydown', (e) => {

			if ( [ 38, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
			
			// prevent default action (scroll)
			e.preventDefault();
			
			if (e.keyCode === 9 && !e.shiftKey) {
				quickMenuElement.focus();
				quickMenuElement.selectFirstTile();
				return;
			}
	
			let direction = (e.keyCode === 40) ? 1 : -1;
			
			let divs = suggestions.getElementsByTagName('div');

			let currentIndex = [].findIndex.call(divs, div => div.classList.contains( "selectedFocus" ));

			if ( currentIndex !== -1 ) {
				divs[currentIndex].classList.remove("selectedFocus");
				
				let selectedDiv = null;
				
				if ( currentIndex + direction > divs.length -1 ) {
					quickMenuElement.focus();
					quickMenuElement.selectFirstTile();
					return;
				} else if ( currentIndex + direction < 0 ) {
					sb.focus();
					return;
				}
				else
					selectedDiv = divs[currentIndex + direction];
					
				selectedDiv.click();
				selectedDiv.scrollIntoView(); 
			}

		});
	}
	
	quickMenuElement.addEventListener('keydown', (e) => {

		if ( ! [ 37, 38, 39, 40, 9 ].includes(e.keyCode) ) return;
		
		e.preventDefault();

		let direction = 0;
		if (e.keyCode === 9 && !e.shiftKey)
			direction = 1;
		else if (e.keyCode === 9 && e.shiftKey)
			direction = -1;
		else if (e.keyCode === 40)
			direction = columns;
		else if (e.keyCode === 38)
			direction = -columns;
		else if (e.keyCode === 39)
			direction = 1; 
		else if (e.keyCode === 37)
			direction = -1;

		// get all tiles
		let divs = quickMenuElement.querySelectorAll('.tile');

		// clear current selection
		if (sb.selectedIndex !== undefined)
			divs[sb.selectedIndex].classList.remove('selectedFocus');

		if (
			(e.keyCode === 9 && e.shiftKey && sb.selectedIndex === undefined) ||
			(e.keyCode === 38 && sb.selectedIndex === undefined)
		)
			sb.selectedIndex = divs.length -1;
		else if (sb.selectedIndex === undefined)
			sb.selectedIndex = [].indexOf.call( divs, quickMenuElement.querySelector('div[data-id]') );
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
				quickMenuElement.dispatchEvent(new e.constructor(e.type, e));
				return;
			}
		}

		divs[sb.selectedIndex].classList.add('selectedFocus');

	});

	document.addEventListener('updatesearchterms', (e) => {
		sb.value = quickMenuObject.searchTerms;
	});
	
	if ( type === 'quickmenu' && userOptions.quickMenuSearchBar === 'hidden') {
		sb.parentNode.style.display = 'none';
		sb.parentNode.style.height = '0';
	}
	
	// prevent click events from propagating
	[/*'mousedown',*/ 'mouseup', 'click', 'contextmenu'].forEach( eventType => {
		quickMenuElement.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	});
	
	// generic search engine tile
	function buildSearchIcon(icon_url, title) {
		var div = document.createElement('DIV');
		
		if ( icon_url )	div.style.backgroundImage = 'url("' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + '")';
		div.style.setProperty('--tile-background-size', 16 * userOptions.quickMenuIconScale + "px");
		div.title = title;
		return div;
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

		return openMethod
	}
	
	function keepMenuOpen(e) {
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
	
	// method for assigning tile click handler
	function addTileEventHandlers(_tile, handler) {

		// all click events are attached to mouseup
		_tile.addEventListener('mouseup', (e) => {

			// check if this tile was target of the latest mousedown event
			if ( !userOptions.quickMenuSearchOnMouseUp && !_tile.isSameNode(_tile.parentNode.lastMouseDownTile)) return;

			// prevents unwanted propagation from triggering a parentWindow.click event call to closequickmenu
			quickMenuObject.mouseLastClickTime = Date.now();
			
			if (type === 'quickmenu') {
				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
			}

			// custom tile methods
			handler(e);
			
			// check for locked / Keep Menu Open 
			if ( !keepMenuOpen(e) )
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

	function createToolsArray() {
	
		let toolsArray = [];

		// iterate over tools
		userOptions.quickMenuTools.forEach( tool => {

			// skip disabled tools
			if (tool.disabled) return;
			
			switch (tool.name) {
				
				case "copy": // clipboard
					let tile_copy = buildSearchIcon(browser.runtime.getURL("/icons/clipboard.png"), browser.i18n.getMessage("tools_Copy"));
					
					addTileEventHandlers(tile_copy, (e) => {

						let input = document.createElement('input');
						input.type = "text";
						input.value = sb.value;
						document.body.appendChild(input);

						input.select();
						
						if ( !document.queryCommandSupported('copy') ) {
							console.log('copy not supported');
							return;
						}

						document.execCommand("copy");
						
						// chrome requires execCommand be run from background
						browser.runtime.sendMessage({action: 'copy', msg: sb.value});
					});
					
					toolsArray.push(tile_copy);
					break;
				
				case "link": // open as link
					let tile_link = buildSearchIcon(browser.runtime.getURL("/icons/link.png"), browser.i18n.getMessage("tools_OpenAsLink"));

					// enable/disable link button on very basic 'is it a link' rules
					function setDisabled() {
						if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
							tile_link.dataset.disabled = true;
						} else {
							tile_link.dataset.disabled = false;
						}
					}
					
					// set initial disabled state
					setDisabled();
					
					// when new search terms are set while locked, enable/disable link
					document.addEventListener('updatesearchterms', (e) => {
						setDisabled();
					});
					
					addTileEventHandlers(tile_link, (e) => {

						if (tile_link.dataset.disabled === "true") return;

						browser.runtime.sendMessage({
							action: "quickMenuSearch", 
							info: {
								menuItemId: "openAsLink",
								selectionText: sb.value,
								openMethod: getOpenMethod(e),
								openUrl: true
							}
						});
					});
					
					toolsArray.push(tile_link);
					break;
					
				case "close": // simply close the quick menu
					let tile_close = buildSearchIcon(browser.runtime.getURL("/icons/close.png"), browser.i18n.getMessage("tools_Close"));

					tile_close.onclick = function(e) {
						browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
					}
					
					toolsArray.push(tile_close);
					break;
				
				case "disable": // close the quick menu and disable for this page / session
					let tile_disable = buildSearchIcon(browser.runtime.getURL("/icons/power.png"), browser.i18n.getMessage("tools_Disable"));
					tile_disable.onclick = function(e) {
						
						userOptions.quickMenu = false;
						quickMenuObject.disabled = true;
						
						if (document.title === "QuickMenu") {
							browser.runtime.sendMessage({
								action: "updateQuickMenuObject", 
								quickMenuObject: quickMenuObject
							});
						}
						
						browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});
					}

					toolsArray.push(tile_disable);
					break;
					
				case "lock": // keep quick menu open after clicking search / scrolling / window click
					let tile_lock = buildSearchIcon(browser.runtime.getURL("/icons/lock.png"), browser.i18n.getMessage("tools_Lock"));
					
					tile_lock.dataset.locked = false;
					tile_lock.onclick = function(e) {

						if ( this.dataset.locked === "true" )
							this.dataset.locked = quickMenuObject.locked = false;
						else
							this.dataset.locked = quickMenuObject.locked = true;

						// lock styles methods moved to onMessage listener
						browser.runtime.sendMessage({
							action: "updateQuickMenuObject", 
							quickMenuObject: quickMenuObject,
							toggleLock: true
						});
					}

					toolsArray.push(tile_lock);
					break;
			}
		});
		
		toolsArray.forEach( tool => tool.dataset.type = 'tool' );

		return toolsArray;
	}
	
	function insertBreaks() {
		
		quickMenuElement.querySelectorAll('br').forEach( br => {
			quickMenuElement.removeChild(br);
		});
		quickMenuElement.querySelectorAll('.tile:nth-of-type(' + columns + 'n)').forEach( tile => {
			tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);
		});
	}
	
	function buildQuickMenuElement(options) {

		function buildMoreTile() {
			let moreTile = buildSearchIcon(browser.runtime.getURL('/icons/add.png'), browser.i18n.getMessage('more') || 'more');

			moreTile.style.textAlign='center';
			moreTile.dataset.type = "tool";

			moreTile.addEventListener('mouseup', (e) => {
				
				moreTile.parentNode.removeChild(moreTile);

				quickMenuElement.querySelectorAll('[data-hidden="true"]').forEach( div => {
					div.style.display = null;
					delete div.dataset.hidden;
				});
				
				// if tools are on the bottom, move them
				if (userOptions.quickMenuToolsPosition === 'bottom') {
					quickMenuElement.querySelectorAll('[data-type="tool"]').forEach( div => { quickMenuElement.appendChild(div) } );
				}
				
				// rebuild breaks
				insertBreaks();

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: quickMenuElement.getBoundingClientRect().width,
						height: quickMenuElement.getBoundingClientRect().height + sbc.getBoundingClientRect().height + 'px'
					},
					resizeOnly: true,
					tileSize: {width: quickMenuElement.firstChild.offsetWidth, height: quickMenuElement.firstChild.offsetHeight},
					tileCount: quickMenuElement.querySelectorAll('.tile:not([data-hidden])').length
				});

			});
			
			return moreTile;
		}
		
		let tileArray = options.tileArray;
		let toolsArray = options.toolsArray;

		quickMenuElement.innerHTML = null;

		// initialize slide-in animation
		quickMenuElement.style.position = 'relative';
		quickMenuElement.style.visibility = 'hidden';
		quickMenuElement.style.transition = 'none';
	
		// remove separators if using grid
		if (!singleColumn) {
			tileArray = tileArray.filter( tile => tile.dataset.type !== 'separator' );
		}
	
		// set the number of tiles to show
		let visibleTileCountMax = singleColumn ? userOptions.quickMenuRows : userOptions.quickMenuRows * userOptions.quickMenuColumns;

		// set tools position
		if (userOptions.quickMenuToolsPosition === 'top' && type === 'quickmenu')
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
		if ( ['searchbar','sidebar'].includes(type) && userOptions.quickMenuColumns === userOptions.searchBarColumns && userOptions.quickMenuToolsPosition === "top" && !singleColumn && !options.parentId && toolsArray.length !== columns ) {
			toolsArray.forEach( tool => {
				tool.dataset.disabled = true;
				tool.dataset.hidden = true;
				tileArray.unshift(tool);
			});
		}

		// add empty cells for resizing ( needs work )
		if ( mode === "resize" ) {
			let resizeMaxTiles = ( singleColumn ) ? userOptions.quickMenuRows : userOptions.quickMenuRows * userOptions.quickMenuColumns;
			for ( let i=tileArray.length; i<resizeMaxTiles;i++) {
				let tile = document.createElement('div');
				tile.dataset.type = 'empty';
				tileArray.push(tile);
			}
		}

		// make rows / columns
		tileArray.forEach( tile => {
			
			tile.className = 'tile';
			tile.dataset.title = tile.title;

			if (singleColumn) tile.classList.add("singleColumn");
			
			quickMenuElement.appendChild(tile);
		});
		
		insertBreaks();

		// check if any search engines exist and link to Options if none
		if (userOptions.nodeTree.children.length === 0 && userOptions.searchEngines.length === 0 ) {
			var div = document.createElement('div');
			div.style='width:auto;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
			div.innerText = browser.i18n.getMessage("WhereAreMyEngines");
			div.onclick = function() {
				browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=enginesTab"});
			}	
			quickMenuElement.appendChild(div);
		}

		// set min-width to prevent menu shrinking with smaller folders
		quickMenuElement.style.minWidth = columns * quickMenuElement.querySelector('.tile').getBoundingClientRect().width + "px";
		
		// slide-in animation
		if ( !userOptions.enableAnimations ) quickMenuElement.style.setProperty('--user-transition', 'none');
		quickMenuElement.style.left = quickMenuElement.getBoundingClientRect().width * ( (options.reverse) ? -1 : 1 ) + "px";
		void( quickMenuElement.offsetHeight );
		quickMenuElement.style.transition = null;
		quickMenuElement.style.visibility = null;
		quickMenuElement.style.left = '0px';

		/* dnd */
		let tileDivs = quickMenuElement.querySelectorAll('.tile:not([data-type="tool"]):not([data-type="empty"])');
		tileDivs.forEach( div => {
			
			function getSide(t, e) {
				let rect = t.getBoundingClientRect();
				
				if ( t.node.type === 'folder' ) {
					if ( singleColumn ) {
						if ( e.y - rect.y < .3 * rect.height ) return "before";
						else if ( e.y - rect.y > .7 * rect.height ) return "after";
						else return "middle";
					} else {
						if ( e.x - rect.x < .3 * rect.width ) return "before";
						else if ( e.x - rect.x > .7 * rect.width ) return "after";
						else return "middle";
					}
				} else {
					if ( singleColumn ) 
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
				
			//	e.preventDefault();
				e.target.dispatchEvent(new MouseEvent('mouseenter'));
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;

				targetDiv.style.transition = 'none';
				
				let dragDiv = document.getElementById('dragDiv');
				
				if ( !dragDiv && targetDiv.dataset.type === 'folder' ) {

					targetDiv.textDragOverFolderTimer = setTimeout(() => {
						let _e = new MouseEvent('mouseup');
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
					if ( singleColumn ) arrow.className = 'singleColumn';
					arrow.id = 'arrow';
					arrow.style.top = targetDiv.getBoundingClientRect().top + "px";
					arrow.style.display = null;
				}
			});
			div.addEventListener('dragleave', (e) => {
			//	e.preventDefault();
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
				dragDiv.style.opacity = null;
				dragDiv.id = "";
				
				let targetDiv = getTargetElement(e.target);
				if ( !targetDiv ) return;
				targetDiv.classList.remove('dragHover');

				let arrow = document.getElementById('arrow');
				if ( arrow ) arrow.style.display = 'none';
				
			});
			div.addEventListener('drop', (e) => {

				// look for text dnd
				if ( e.dataTransfer.getData("text") ) {
					e.preventDefault();
					sb.value = e.dataTransfer.getData("text");
					div.parentNode.lastMouseDownTile = div;
					div.dispatchEvent(new MouseEvent('mouseup'));
					return;
				}

				let dragDiv = document.getElementById('dragDiv');

				let targetDiv = getTargetElement(e.target);
				targetDiv.classList.remove('dragHover');

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
				insertBreaks();
				
			});
			
		});
		
		/* end dnd */

		return quickMenuElement;
	}

	function quickMenuElementFromNodeTree( rootNode, reverse ) {

		reverse = reverse || false; // for slide-in animation direction
		
		let nodes = rootNode.children;
		let tileArray = [];
		
		if (rootNode.parent) { // if parentId was sent, assume subfolder and add 'back' button
			
			let tile = buildSearchIcon(browser.runtime.getURL('/icons/back.png'), browser.i18n.getMessage('back') || 'back');
			
			tile.dataset.type = "tool";
			tile.node = rootNode.parent;
			
			tile.addEventListener('mouseup', (e) => {

				// back button rebuilds the menu using the parent folder
				let quickMenuElement = quickMenuElementFromNodeTree(rootNode.parent, true);

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: quickMenuElement.getBoundingClientRect().width,
						height: quickMenuElement.getBoundingClientRect().height + sbc.getBoundingClientRect().height + 'px'
					},
					resizeOnly: true,
					tileSize: {width: quickMenuElement.firstChild.offsetWidth, height: quickMenuElement.firstChild.offsetHeight},
					tileCount: quickMenuElement.querySelectorAll('.tile:not([data-hidden])').length
				});
				
				document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

			});
			
			tile.addEventListener('dragenter', (e) => {
				// ignore tile dnd
				if ( document.getElementById('dragDiv') ) return;
				
				// start hover timer
				tile.textDragOverFolderTimer = setTimeout(() => {
					let _e = new MouseEvent('mouseup');
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
			
			let tile;

			if (node.hidden) return;
			
			switch ( node.type ) {

				case "searchEngine":

					let se = userOptions.searchEngines.find(se => se.id === node.id);
					
					if (!se) {
						console.log('no search engine found for ' + node.id);
						return;
					}

					tile = buildSearchIcon(se.icon_base64String || browser.runtime.getURL('/icons/search.png'), se.title);
					
					// site search picker
					if ( se.template.indexOf('{selectdomain}') !== -1 ) {
						tile.dataset.id = node.id;
						tile.dataset.type = 'folder';
						tile.dataset.subtype = 'sitesearch';
						
						tile.addEventListener('mouseup', () => {

							browser.runtime.sendMessage({action: 'getCurrentTabInfo'}).then( tab => {

								let siteSearchNode = {
									type:"folder",
									parent:node.parent,
									children:[],
									id:node.id
								}
								
								let url = new URL(tab.url);								
								let pathParts = url.pathname.split('/');
								
								if (pathParts[pathParts.length - 1].indexOf('.')) pathParts.pop();
	
								for ( let i=0;i<pathParts.length;i++ ) {
									siteSearchNode.children.push({
										type: "siteSearch",
										title: url.hostname + pathParts.slice(0,i+1).join('/'),
										parent:node,
										icon: tab.favIconUrl || browser.runtime.getURL('/icons/search.png')
									});
									
								}

								quickMenuElement = quickMenuElementFromNodeTree(siteSearchNode);
								
								quickMenuElement.querySelectorAll('br').forEach( br => br.parentNode.removeChild(br));
								quickMenuElement.querySelectorAll('.tile').forEach( _tile => {
									_tile.classList.add('singleColumn');
									_tile.style.width = 'auto';
									_tile.style.paddingRight = '16px';
									quickMenuElement.insertBefore(document.createElement('br'), _tile.nextSibling);
								});
		
								browser.runtime.sendMessage({
									action: "quickMenuIframeLoaded", 
									size: {
										width: quickMenuElement.getBoundingClientRect().width,
										height: quickMenuElement.getBoundingClientRect().height + sbc.getBoundingClientRect().height + 'px'
									},
									resizeOnly: true,
									tileSize: {width: quickMenuElement.firstChild.offsetWidth, height: quickMenuElement.firstChild.offsetHeight},
									tileCount: siteSearchNode.children.length
								});
								
								document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
							});
						});
						
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

					tile = buildSearchIcon(browser.runtime.getURL('/icons/code.png'), node.title);
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
					tile = buildSearchIcon( (singleColumn) ? "/icons/folder3.png": null, node.title);

					tile.dataset.type = 'folder';
					
					// prevent scroll icon
					tile.addEventListener('mousedown', (e) => {
						
						// skip for dnd events
						if ( e.which === 1 ) return;
						e.preventDefault();
						e.stopPropagation();
					});

					tile.addEventListener('mouseup', (e) => {
						let method = getOpenMethod(e, true);

						if (method === 'noAction') return;

						if (method === 'openFolder' || e.openFolder) { 
							let quickMenuElement = quickMenuElementFromNodeTree(node);
							
							browser.runtime.sendMessage({
								action: "quickMenuIframeLoaded", 
								size: {
									width: quickMenuElement.getBoundingClientRect().width,
									height: quickMenuElement.getBoundingClientRect().height + sbc.getBoundingClientRect().height + 'px'
								},
								resizeOnly: true,
								tileSize: {width: quickMenuElement.firstChild.offsetWidth, height: quickMenuElement.firstChild.offsetHeight},
								tileCount: quickMenuElement.querySelectorAll('.tile:not([data-hidden])').length
							});

							document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

							return;
						}

						let messages = [];

						for (let _node of node.children) {

							if (_node.type === 'searchEngine') {
								messages.push({
									action: "quickMenuSearch", 
									info: {
										menuItemId: _node.id,
										selectionText: sb.value,
									//	when opening method is a new window, only do so on first engine, then open in background
										openMethod: (messages.length === 0 ) ? method : "openBackgroundTab",
										folder: true
									}
								});
							}	
						}

						function loop(message) {
							browser.runtime.sendMessage(message).then( (result) => {
								loop(messages.shift());
							});
						}
						
						loop(messages.shift());

					});
					
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
			}
			
			tile.node = node;
			tileArray.push(tile);

		});

		// do not display tools if in a subfolder
		let toolsArray = rootNode.parent ? [] : createToolsArray();

		return buildQuickMenuElement({tileArray:tileArray, toolsArray:toolsArray, reverse: reverse, parentId: rootNode.parent});
	}

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	setParents(root);

	return Promise.resolve(quickMenuElementFromNodeTree(root));
	
}
