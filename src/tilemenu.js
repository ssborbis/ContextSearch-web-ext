
function makeQuickMenu(options) {
	
	let type = options.type;
	
	let singleColumn = function() {
		if (type === 'searchbar' && userOptions.searchBarUseOldStyle) return true;
		if (type === 'quickmenu' && userOptions.quickMenuUseOldStyle) return true;
		
		return false;
	}();

	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	// suggestions div for toolbar search
	let suggestions = document.getElementById('suggestions');

	if (suggestions) suggestions.tabIndex = -1;

	var quickMenuElement = document.createElement('div');
	quickMenuElement.tabIndex = -1;
	
	var columns = (singleColumn) ? 1 : ( (options.type === "searchbar") ? userOptions.searchBarColumns : userOptions.quickMenuColumns );

	quickMenuElement.id = 'quickMenuElement';
	
	let sb = document.getElementById('quickmenusearchbar');
	sb.onclick = function(e) {
		e.stopPropagation();
	}
	sb.onmouseup = function(e) {
		e.stopPropagation();
	}
	
//	sb.tabIndex = 0;
	
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

		let se = userOptions.searchEngines.find(se => se.hotkey && se.hotkey === e.which);
		
		if (!se) return;
		
		browser.runtime.sendMessage({
			action: "quickMenuSearch", 
			info: {
				menuItemId: se.id,
				selectionText: sb.value,//quickMenuObject.searchTerms,
				openMethod: userOptions.quickMenuSearchHotkeys
			}
		});
		
		if (addToHistory) addToHistory(sb.value);
		
		if (
			!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
			!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
			!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen") &&
			userOptions.quickMenuCloseOnClick &&
			!quickMenuObject.locked
		) {
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});
		}

	});
	
	// sb.addEventListener('focus', (e) => {
		// console.log('focused on sb');
	// });
	// if (suggestions) {
		// suggestions.addEventListener('focus', (e) => {
			// console.log('focused on suggestions');
		// });
	// }
	// quickMenuElement.addEventListener('focus', (e) => {
		// console.log('focused on qme');
	// });
	
	quickMenuElement.selectFirstTile = function() {
		let firstTile = quickMenuElement.querySelector('div:not([data-hidden])');
		firstTile.classList.add('selectedFocus');
		sb.selectedIndex = Array.prototype.indexOf.call(quickMenuElement.querySelectorAll("div"), firstTile);
	}

	sb.addEventListener('keydown', (e) => {
		
//		console.log('keydown sb');
		
		if ( [ 38, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
		
		let direction = 0;
		
		if (e.keyCode === 40 || ( e.keyCode === 9 && !e.shiftKey) )
			direction = 1;
		else
			direction = -1;

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
			
			let divs = quickMenuElement.querySelectorAll('div:not([data-type="tool"]):not([data-hidden])');
			
			let selectedDiv = ( direction === 1 ) ? divs[0] : divs[divs.length - 1];

			selectedDiv.className = 'selectedFocus';
			sb.selectedIndex = Array.prototype.indexOf.call(quickMenuElement.querySelectorAll('div'), selectedDiv);
		}
	});
	
	if (suggestions) {
		suggestions.addEventListener('keydown', (e) => {
					
			console.log('keydown suggestions');
			
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

			let currentIndex = function() {

				for ( let i=0;i<divs.length;i++ ) {
					if ( divs[i].classList.contains( "selectedFocus" ) ) return i;
				}
				
				return -1;
			}();

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

		if ( [ 37, 38, 39, 40, 9 ].indexOf(e.keyCode) === -1 ) return;
		
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
		let divs = quickMenuElement.querySelectorAll('div');

		// clear current selection
		if (sb.selectedIndex !== undefined)
			divs[sb.selectedIndex].classList.remove('selectedFocus');
		
		if (
			(e.keyCode === 9 && e.shiftKey && sb.selectedIndex === undefined) ||
			(e.keyCode === 38 && sb.selectedIndex === undefined)
		)
			sb.selectedIndex = divs.length -1;
		else if (sb.selectedIndex === undefined)
			sb.selectedIndex = Array.prototype.indexOf( divs, quickMenuElement.querySelector('div[data-id]') );
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
		
		// invert colors for tools
		// if (divs[sb.selectedIndex].dataset.type === "tool") {
			// let img = document.createElement('img');
			// let url = divs[sb.selectedIndex].style.backgroundImage;
			// img.style.filter = 'brightness(0) invert(1)';
			// console.log(url);
			// img.src = url.slice(4, -1).replace(/['"]/g, "");
			// img.style.height = '16px';
			// console.log(img.src);
			// divs[sb.selectedIndex].appendChild(img);
		// }

		
	});

	document.addEventListener('updatesearchterms', (e) => {
		sb.value = quickMenuObject.searchTerms;
	});
	
	if (userOptions.quickMenuSearchBar === 'hidden') {
		sb.parentNode.style.display = 'none';
		sb.parentNode.style.height = '0';
	}
	
	// prevent click events from propagating
	for (let eventType of ['mousedown', 'mouseup', 'click', 'contextmenu']) {
		quickMenuElement.addEventListener(eventType, (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	}
	
	// generic search engine tile
	function buildSearchIcon(icon_url, title) {
		var div = document.createElement('DIV');
		div.style.backgroundImage = 'url(' + ( icon_url || browser.runtime.getURL("/icons/icon48.png") ) + ')';
		div.style.backgroundSize = 16 * userOptions.quickMenuIconScale + "px";
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
			if (
				!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
				!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
				!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen") &&
				userOptions.quickMenuCloseOnClick &&
				!quickMenuObject.locked
			) {
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_quickmenutile"});
			}

		});
		
		// prevent triggering click event accidentally releasing mouse button when menu is opened by HOLD method
		_tile.addEventListener('mousedown', (e) => {
			_tile.parentNode.lastMouseDownTile = _tile;
		});
		
		// stop all other mouse events for this tile from propagating
		['mousedown','mouseup','click','contextmenu'].forEach( eventType => {
			_tile.addEventListener(eventType, (e) => {
				e.preventDefault();
				e.stopPropagation();
				return false;
			});
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
						//	tile_link.style.filter="grayscale(100%)";
							tile_link.style.backgroundColor="#ddd";
							tile_link.disabled = true;
						} else {
							tile_link.style.filter=null;
							tile_link.style.backgroundColor=null;
							tile_link.disabled = false;
						}
					}
					
					// set initial disabled state
					setDisabled();
					
					// when new search terms are set while locked, enable/disable link
					document.addEventListener('updatesearchterms', (e) => {
						setDisabled();
					});
					
					addTileEventHandlers(tile_link, (e) => {
						if (tile_link.disabled) return;
						
						browser.runtime.sendMessage({
							action: "quickMenuSearch", 
							info: {
								menuItemId: 0,
								selectionText: quickMenuObject.searchTerms,
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
					
					tile_lock.locked = false;
					tile_lock.onclick = function(e) {
						
						let qm = document.getElementById('quickMenuIframe');

						switch (this.locked) {
							case false:
								this.style.backgroundColor = '#dee7f0';
								this.style.boxShadow = 'inset 2px 2px 2px #193047';

								this.locked = quickMenuObject.locked = true;
								break;
								
							case true:
								this.style.backgroundColor = null;
								this.style.boxShadow = null;

								this.locked = quickMenuObject.locked = false;
								break;
						}
						
						// update qmo for both iframe and quickmenucontainer methods
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
		
		toolsArray.forEach( tool => { tool.dataset.type = 'tool' } );

		return toolsArray;
	}
	
	function buildQuickMenuElement(options) {

		function buildMoreTile() {
			let moreTile = buildSearchIcon(browser.runtime.getURL('/icons/add.png'), browser.i18n.getMessage('more') || 'more');
					
			if (singleColumn) {
				moreTile.className = "singleColumn";
				moreTile.innerHTML = null; // added to clear monograms from folder icons
				moreTile.style.textAlign='center';
			
				let span = document.createElement('span');
				span.innerText = moreTile.title;
				span.style.marginLeft = '24px';
			
				moreTile.appendChild(span); 
			}

			moreTile.dataset.type = "tool";

			moreTile.addEventListener('mouseup', (e) => {
				
				moreTile.parentNode.removeChild(moreTile);
				
				let qme = document.getElementById('quickMenuElement');
				
				//for (let div of qme.querySelectorAll('[data-hidden="true"]')) {
				qme.querySelectorAll('[data-hidden="true"]').forEach( div => {
					div.style.display = null;
					delete div.dataset.hidden;
				});
				
				// if tools are on the bottom, move them
				if (userOptions.quickMenuToolsPosition === 'bottom') {
					qme.querySelectorAll('[data-type="tool"]').forEach( div => { qme.appendChild(div) } );
				}
				
				// rebuild breaks
				qme.querySelectorAll('br').forEach( br => { qme.removeChild(br) } );
				let divs = qme.querySelectorAll('div');
				for (i=0;i<divs.length;i++) {
					if ( (i+1) % columns === 0 )
						qme.insertBefore(document.createElement('br'), divs[i].nextSibling);
				}

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: window.getComputedStyle(qme,null).width,
						height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(document.getElementById('quickMenuSearchBarContainer'), null).height) + 'px'
					},
					resizeOnly: true
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
		quickMenuElement.style.transition = null;
	
		// remove separators if using grid
		if (!singleColumn) {
			tileArray = tileArray.filter( tile => {	return tile.dataset.type !== 'separator' } );
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
		if ( type === "searchbar" && userOptions.quickMenuColumns === userOptions.searchBarColumns && userOptions.quickMenuToolsPosition === "top" && !singleColumn && !options.parentId ) {

			userOptions.quickMenuTools.forEach( tool => {
				if ( tool.disabled ) return;
				let _tile = document.createElement('div');
				_tile.dataset.hidden = "true";
				tileArray.unshift(_tile);
			});
		}

		// make rows / columns
		for (let i=0;i<tileArray.length;i++) {
			let tile = tileArray[i];

			quickMenuElement.appendChild(tile);

			if (singleColumn) {
				tile.className = "singleColumn";
				tile.innerHTML = null; // added to clear monograms from folder icons
				
				let span = document.createElement('span');
				span.innerText = tile.title;
				span.style.marginLeft = '24px';
				
				if (tile.dataset.type === 'separator') {
					tile.style.height = "2px";
					tile.style.maxHeight = "2px";
					tile.style.margin = "4px 0";
					tile.style.overflow = "hidden";
					tile.style.backgroundColor = "#ddd";
					tile.style.border = "none";
				}
				
				tile.appendChild(span); 
			}
			
			quickMenuElement.appendChild(tile);

			// break row
			if ( (i + 1) % columns === 0) {
				let br = document.createElement('br');
				tile.parentNode.insertBefore(br, tile.nextSibling);
			}

		}

		// check if any search engines exist and link to Options if none
		if (userOptions.searchEngines.length === 0 || typeof userOptions.searchEngines[0].icon_base64String === 'undefined' ) {
			var div = document.createElement('div');
			div.style='width:auto;font-size:8pt;text-align:center;line-height:1;padding:10px;height:auto';
			div.innerText = browser.i18n.getMessage("WhereAreMyEngines");
			div.onclick = function() {
				browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=searchengines"});
			}	
			quickMenuElement.appendChild(div);
		}

		// slide-in animation
		quickMenuElement.style.left = quickMenuElement.getBoundingClientRect().width * ( (options.reverse) ? -1 : 1 ) + "px";
		void( quickMenuElement.offsetHeight );
		quickMenuElement.style.transition = "left .15s ease-in-out";
		quickMenuElement.style.visibility = null;
		quickMenuElement.style.left = '0px';

		return quickMenuElement;
	}

	function quickMenuElementFromNodeTree( rootNode, reverse ) {

		reverse = reverse || false; // for slide-in animation direction
		
		let nodes = rootNode.children;
		let tileArray = [];
		
		if (rootNode.parent) { // if parentId was sent, assume subfolder and add 'back' button
			
			let tile = buildSearchIcon(browser.runtime.getURL('/icons/back.png'), browser.i18n.getMessage('back') || 'back');
			
			tile.dataset.type = "tool";
			tile.addEventListener('mouseup', (e) => {

				// back button rebuilds the menu using the parent folder
				let qme = quickMenuElementFromNodeTree(rootNode.parent, true);

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: window.getComputedStyle(qme,null).width,
						height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(document.getElementById('quickMenuSearchBarContainer'), null).height) + 'px'
					},
					resizeOnly: true
				});
				
				document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));

			});
			
			delete sb.selectedIndex;
			tileArray.push(tile);
		}
		
		let overLimit = false;
		
		for (let i=0;i<nodes.length;i++) {
			
			let tile;

			let node = nodes[i];
			
			if (node.hidden) continue;

			if (node.type === "searchEngine") {

				let se = userOptions.searchEngines.find(se => se.id === node.id);
				
				if (!se) {
					console.log('no search engine found for ' + node.id);
					continue;
				}

				tile = buildSearchIcon(se.icon_base64String || browser.runtime.getURL('/icons/search.png'), se.title);
				
				addTileEventHandlers(tile, (e) => {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId: node.id,
							selectionText: sb.value,//quickMenuObject.searchTerms,
							openMethod: getOpenMethod(e)
						}
					});
					
					if (addToHistory) addToHistory(sb.value);
				});
				
				tile.dataset.id = node.id;
				tile.dataset.type = 'searchEngine';

				tileArray.push(tile);

			}
			
			if ( node.type === "bookmarklet" ) {

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

				tileArray.push(tile);

			}
			
			if ( node.type === "separator" ) {
				tile = document.createElement('hr');
				tile.dataset.type = 'separator';
				tileArray.push(tile);
			}
			
			if (node.type === "folder") {
				tile = buildSearchIcon( (singleColumn) ? "/icons/folder3.png": "/icons/transparent.gif", node.title);
				
				// if ( singleColumn )
					// tile.style.backgroundColor = '';

				let span = document.createElement('span');
				span.className = "folderLabel";
				span.innerText = node.title;

				tile.dataset.type = 'folder';
				tile.appendChild(span);
				
				let corner = document.createElement('span');
				corner.className = 'folderTileCorner';
				tile.appendChild(corner);
				
				tile.addEventListener('mouseup', (e) => {
					let method = getOpenMethod(e, true);

					if (method === 'noAction') return;

					if (method === 'openFolder') { 
						let qme = quickMenuElementFromNodeTree(node);
						
						browser.runtime.sendMessage({
							action: "quickMenuIframeLoaded", 
							size: {
								width: window.getComputedStyle(qme,null).width,
								height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(document.getElementById('quickMenuSearchBarContainer'), null).height) + 'px'
							},
							resizeOnly: true
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
									selectionText: sb.value,//quickMenuObject.searchTerms,
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
				
				tileArray.push(tile);

			}
			
			if (overLimit) tile.style.display = 'none';

		}
		
		// do not display tools if in a subfolder
		let toolsArray = rootNode.parent ? [] : createToolsArray();
		
		return buildQuickMenuElement({tileArray:tileArray, toolsArray:toolsArray, reverse: reverse, parentId: rootNode.parent});
	}

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));
	
	var setParent = function(o){
		if(o.children != undefined){
			for(n in o.children) {
				
				// build the JSON.stringify funciton, omitting parent
			  o.children[n].toJSON = function() {
				  return {type: this.type, title: this.title, index: this.index, id: this.id, children: this.children, url: this.url}
			  }
			  o.children[n].parent = o;
			  setParent(o.children[n]);
			}
		}
	}
	
	setParent(root);

	return Promise.resolve(quickMenuElementFromNodeTree(root));
	
}
