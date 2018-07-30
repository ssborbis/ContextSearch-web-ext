window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

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

function preventContextMenuHandler(evv) {
	evv.preventDefault();
}

function scrollEventListener(ev) {
	if (window.scrollThrottler) return false;
	window.scrollThrottler = true;
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: ev.type});
	setTimeout(() => {
		window.scrollThrottler = false;
	},250);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

function openQuickMenu(ev) {
	
	ev = ev || new Event('click');
		
	// links need to be blurred before focus can be applied to search bar (why?)
	if (userOptions.quickMenuSearchBarFocus /* && ev.target.nodeName === 'A' */) {
		
		// restore selection to text boxes
		if (ev.target.selectionStart) { // is a text box
			document.addEventListener('closequickmenu', (e) => {
				ev.target.focus();
			}, {once: true});
		}
		
		ev.target.blur();
	}
	browser.runtime.sendMessage({
		action: "openQuickMenu", 
		screenCoords: {
			x: quickMenuObject.screenCoords.x, 
			y: quickMenuObject.screenCoords.y}, 
		searchTerms: getSelectedText(ev.target).trim(),
		quickMenuObject: quickMenuObject
	});
}

function closeQuickMenu(eventType) {
	
	eventType = eventType || null;
		
	if (
		(eventType === 'wheel' || eventType === 'scroll') && 
		(!userOptions.quickMenuCloseOnScroll || quickMenuObject.locked)
	) return false;
	
	if (
		eventType === 'click_window' && 
		quickMenuObject.locked
	) return false;
	
	var quickMenuElement = document.getElementById('quickMenuIframe');
	if (quickMenuElement !== null) {
		quickMenuElement.style.opacity=0;
		setTimeout(()=> {
			if (quickMenuElement !== null && quickMenuElement.parentNode !== null) {
				quickMenuElement.parentNode.removeChild(quickMenuElement);
				document.dispatchEvent(new CustomEvent('closequickmenu'));
			}
		},100);
	}
}

function getOffsets() {
	let xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);	
	let yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);
	
	return {x: xOffset, y: yOffset};
}

function scaleAndPositionQuickMenu(size, resizeOnly) {
	let qmc = document.getElementById('quickMenuIframe');
	if (!qmc) return;
	
	resizeOnly = resizeOnly || false;
	
	size = size || {
		width: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("width"), 
		height: qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("height")
	};

	// scale quickmenu
	userOptions.quickMenuScaleOnZoom = userOptions.quickMenuScaleOnZoom || true;

	let new_scale = (userOptions.quickMenuScaleOnZoom) ? (userOptions.quickMenuScale / window.devicePixelRatio) : userOptions.quickMenuScale;
	
	qmc.style.transformOrigin = "top left";
	qmc.style.transform = "scale(" + new_scale + ")";
	
	qmc.style.width = parseFloat(size.width) + "px";
	qmc.style.height = parseFloat(size.height) + "px";
	
	if (! resizeOnly) { // skip positioning if this is a resize only
		for (let position of userOptions.quickMenuPosition.split(" ")) {
			switch (position) {
				case "left":
					qmc.style.left = parseFloat(qmc.style.left) - parseFloat(qmc.style.width) * userOptions.quickMenuScale / window.devicePixelRatio + "px";
					break;
				case "right":
					break;
				case "center":
					qmc.style.left = parseFloat(qmc.style.left) - parseFloat(qmc.style.width) / 2.0 * userOptions.quickMenuScale / window.devicePixelRatio + "px";
					break;
				case "top":
					qmc.style.top = parseFloat(qmc.style.top) - parseFloat(qmc.style.height) * userOptions.quickMenuScale / window.devicePixelRatio + "px";
					break;
				case "bottom":
					break;
			}
		}
	}
	repositionOffscreenElement( qmc );
	qmc.style.opacity = 1;
}

function repositionOffscreenElement( element ) {
	
	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	let rect = element.getBoundingClientRect();

	if (rect.y < 0) 
		element.style.top = (parseFloat(element.style.top) - rect.y) + "px";
	
	if (rect.y + rect.height > window.innerHeight) 
		element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	if (rect.x < 0) 
		element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	if (rect.x + rect.width > window.innerWidth) 
		element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

}

// build the floating container for the quickmenu
function makeQuickMenuContainer(coords) {
	
	let qmc = document.getElementById('quickMenuIframe');
		
	if (qmc) qmc.parentNode.removeChild(qmc);
	
	qmc = document.createElement('iframe');

	qmc.id = "quickMenuIframe";

	qmc.style.top = coords.y + getOffsets().y - 2 + (userOptions.quickMenuOffset.y / window.devicePixelRatio) + "px";
	qmc.style.left = coords.x + getOffsets().x - 2 + (userOptions.quickMenuOffset.x / window.devicePixelRatio) + "px";
	
	document.body.appendChild(qmc);
	
	qmc.src = browser.runtime.getURL('quickmenu.html');
	
	// Check if quickmenu fails to display
	setTimeout(() => {
		if (!qmc || qmc.ownerDocument.defaultView.getComputedStyle(qmc, null).getPropertyValue("display") === 'none') {
			console.log('iframe quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'});
		}
	},1000);

}

function makeQuickMenu() {
	
	// unlock the menu in case it was opened while another quickmenu was open and locked
	quickMenuObject.locked = false;

	var quickMenuElement = document.createElement('div');
	
	var columns = (userOptions.quickMenuUseOldStyle) ? 1 : userOptions.quickMenuColumns;

	quickMenuElement.id = 'quickMenuElement';
	
	let sb = document.getElementById('quickmenusearchbar');
	sb.onclick = function(e) {
		e.stopPropagation();
	}
	sb.onmouseup = function(e) {
		e.stopPropagation();
	}
	
	function getFirstSearchEngineTileIndex(divs) {
		divs = divs || quickMenuElement.querySelectorAll('div');
		let default_engine_index = 0;
		for (let i=0;i<divs.length;i++) {
			if (divs[i].dataset.index === undefined)
				default_engine_index++;
			else
				break;
		}
		
		return default_engine_index;
	}
	document.onkeydown = function(e) {
		if (e.keyCode === 13) {
			
			let divs = quickMenuElement.querySelectorAll('div');
			
			if (sb.selectedIndex === undefined)
				sb.selectedIndex = getFirstSearchEngineTileIndex(divs);
			
			let div = divs[sb.selectedIndex];
			
			if (divs[sb.selectedIndex].dataset.index !== undefined) {
				div.dispatchEvent(new Event('mouseup'));
			}
			else
				div.click();

		}
	}

	// tab and arrow keys move selected search engine
	sb.addEventListener('focus', () => {
		
		let div = quickMenuElement.querySelector('.selectedFocus');
		if (div) div.classList.remove('selectedFocus');
		
		delete sb.selectedIndex;
		
		let divs = quickMenuElement.querySelectorAll('div[data-index]');
		divs[0].classList.add('selectedNoFocus');

	});
	
	sb.addEventListener('blur', () => {
		let divs = quickMenuElement.querySelectorAll('div[data-index]');
		divs[0].classList.remove('selectedNoFocus');
	});
	
	// hotkey listener
	document.addEventListener('keydown', (e) => {
		
		if (!userOptions.quickMenuSearchHotkeys || userOptions.quickMenuSearchHotkeys === 'noAction') return;

		// ignore hotkeys when the search bar is being edited
		if (document.activeElement === sb) return;
		
		for (let i=0;i<userOptions.searchEngines.length;i++) {
			let se = userOptions.searchEngines[i];
			if (se.hotkey && se.hotkey === e.which) {
				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: i,
						selectionText: sb.value,//quickMenuObject.searchTerms,
						openMethod: userOptions.quickMenuSearchHotkeys
					}
				});
				
				if (
					!(e.shiftKey && userOptions.quickMenuShift === "keepMenuOpen") &&
					!(e.ctrlKey && userOptions.quickMenuCtrl === "keepMenuOpen") &&
					!(e.altKey && userOptions.quickMenuAlt === "keepMenuOpen") &&
					userOptions.quickMenuCloseOnClick &&
					!quickMenuObject.locked
				) {
					browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "hotkey"});
				}
				
				break;
			}
		}
		
	});
	
	document.addEventListener('keydown', (e) => {
		
		if (document.activeElement === sb) {
			
			// let left/right works as normal
			if (e.keyCode === 37 || e.keyCode === 39) return;
			
			if (e.keyCode === 9 || e.keyCode === 40 || e.keyCode === 38) {
				sb.blur();
				sb.selectionEnd = sb.selectionStart;
			}
			
		}

		if (e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 ||e.keyCode === 40 || e.keyCode === 9) {
			
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

			let divs = quickMenuElement.querySelectorAll('div');
			
			if (sb.selectedIndex !== undefined) {
				divs[sb.selectedIndex].classList.remove('selectedFocus');
			}
			
			if (
				(e.keyCode === 9 && e.shiftKey && sb.selectedIndex === undefined) ||
				(e.keyCode === 38 && sb.selectedIndex === undefined)
			)
				sb.selectedIndex = divs.length -1;
			else if (sb.selectedIndex === undefined)
				sb.selectedIndex = getFirstSearchEngineTileIndex(divs);
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
			else
				sb.selectedIndex+=direction;

			divs[sb.selectedIndex].classList.add('selectedFocus');
			
			// if (divs[sb.selectedIndex].index === undefined) {
				// divs[sb.selectedIndex].style.filter = 'brightness(0) invert(1)';
				// let img = document.createElement('img');
				// let url = divs[sb.selectedIndex].style.backgroundImage;
				// console.log(url);
				// img.src = url.slice(4, -1).replace(/['"]/g, "");
				// console.log(img.src);
				// divs[sb.selectedIndex].appendChild(img);
			// }

		}
		
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
	function getOpenMethod(e) {
		let openMethod = "";
		if (e.which === 3)
			openMethod = userOptions.quickMenuRightClick;
		else if (e.which === 2)
			openMethod = userOptions.quickMenuMiddleClick;
		else if (e.which === 1) {
			openMethod = userOptions.quickMenuLeftClick;
			
			// ignore methods that aren't opening methods
			if (e.shiftKey && userOptions.quickMenuShift !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuShift;
			if (e.ctrlKey && userOptions.quickMenuCtrl !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuCtrl;
			if (e.altKey && userOptions.quickMenuAlt !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuAlt;
		
		}

//		console.log("openMethod => " + openMethod);
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
			
			if (document.title === "QuickMenu") {
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
		for (let eventType of ['mousedown','mouseup','click','contextmenu']) {
			_tile.addEventListener(eventType, (e) => {
				e.preventDefault();
				e.stopPropagation();
				return false;
			});
		}
		
	}

	// array for all tiles
	let tileArray = [];
	
	function createToolsArray() {
	
		let toolsArray = [];

		// iterate over tools
		for (let tool of userOptions.quickMenuTools) {

			// skip disabled tools
			if (tool.disabled) continue;
			
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
		}
		
		return toolsArray;
	}
	
	function buildQuickMenuElement(options) {
		
		let tileArray = options.tileArray;
		let toolsArray = options.toolsArray;
		let quickMenuElement = options.quickMenuElement;
		
		while (quickMenuElement.firstChild) {
			quickMenuElement.removeChild(quickMenuElement.firstChild);
		}
		quickMenuElement.getBoundingClientRect();

		if (userOptions.quickMenuToolsPosition === 'top')
			tileArray = toolsArray.concat(tileArray);
		else if (userOptions.quickMenuToolsPosition === 'bottom')
			tileArray = tileArray.concat(toolsArray);

		// make rows / columns
		for (let i=0;i<tileArray.length;i++) {
			let tile = tileArray[i];

			quickMenuElement.appendChild(tile);
			
			if (userOptions.quickMenuUseOldStyle) {

				tile.style.width = '200px';
				tile.style.height = '20px';
				tile.style.fontSize = '11pt';
				tile.style.border = 'none';
				tile.style.fontFamily = 'Arial';
				tile.style.lineHeight = '20px';
				tile.style.verticalAlign = 'middle';
				tile.style.backgroundPosition = '4px 2px';
				tile.style.backgroundSize = '16px';
				
				tile.innerHTML = null; // added to clear monograms from folder icons
				
				let span = document.createElement('span');
				span.innerText = tile.title;
				span.style.marginLeft = '24px';
				
				tile.appendChild(span);
			}
			
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

		return quickMenuElement;
	}
	
	function quickMenuElementFromBookmarksFolder( id ) {
		return browser.runtime.sendMessage({action: "getQuickMenuBookmarks", id: id || null}).then( (result) => {

			let nodes = result.tileNodes;
			let tileArray = [];
			
			if (result.parentId) { // if parentId was sent, assume subfolder and add 'back' button
				let tile = buildSearchIcon(browser.runtime.getURL('/icons/back.png'), browser.i18n.getMessage('back') || 'back');
				tile.onclick = function() {

					quickMenuElementFromBookmarksFolder(result.parentId).then( (qme) => {
						let message = {
							action: "quickMenuIframeLoaded", 
							size: {
								width: window.getComputedStyle(qme,null).width,
								height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(document.getElementById('quickMenuSearchBarContainer'), null).height) + 'px'
							},
							resizeOnly: true
						}

						browser.runtime.sendMessage(message);
					});
				}
								
				tileArray.push(tile);
			}

			for (let node of nodes) {
				
				if (node.type === "searchEngine") {

					let se = userOptions.searchEngines[node.id];
					let tile = buildSearchIcon(se.icon_base64String, se.title);

					tile.index = node.id;
					tile.dataset.index = node.id;
					
					addTileEventHandlers(tile, (e) => {
						browser.runtime.sendMessage({
							action: "quickMenuSearch", 
							info: {
								menuItemId: tile.index,
								selectionText: sb.value,//quickMenuObject.searchTerms,
								openMethod: getOpenMethod(e)
							}
						});
					});

					tileArray.push(tile);
					
					continue;
				}
				
				if (node.type === 'folder') {
					let tile = buildSearchIcon(browser.runtime.getURL('/icons/folder-icon.png'), node.title);
					
					//tile.style.position = 'relative';
					let span = document.createElement('span');
					span.style='font-size:7pt;line-height:1em;padding:2px;font-family:Arial;font-weight:bold; color: white;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;overflow:hidden;position:relative;top:20px';

					span.innerText = node.title;
					
					tile.appendChild(span);
					
					tile.onclick = function() {
						quickMenuElementFromBookmarksFolder(node.id).then( (qme) => {
							
							let message = {
								action: "quickMenuIframeLoaded", 
								size: {
									width: window.getComputedStyle(qme,null).width,
									height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(document.getElementById('quickMenuSearchBarContainer'), null).height) + 'px'
								},
								resizeOnly: true
							}

							browser.runtime.sendMessage(message);
						});
					}
					
					tile.addEventListener('mousedown', (e) => {
						
						// for middle-button
						if (e.which !== 2) return;
						
						browser.runtime.sendMessage({action: "getQuickMenuBookmarks", id: node.id}).then( (_result) => {
							for (let _node of _result.tileNodes) {
								if (_node.type === 'searchEngine') {
									browser.runtime.sendMessage({
										action: "quickMenuSearch", 
										info: {
											menuItemId: _node.id,
											selectionText: sb.value,//quickMenuObject.searchTerms,
											openMethod: "openBackgroundTab"
										}
									});
								}
							}
						});
					});
					
					tileArray.push(tile);
					
					continue;
				}
			}
			
			return buildQuickMenuElement({tileArray:tileArray, toolsArray:createToolsArray(), quickMenuElement: quickMenuElement});
		});
	}
	
	if (userOptions.quickMenuBookmarks) {	
		return Promise.resolve(quickMenuElementFromBookmarksFolder());
	} else {

		for (var i=0;i<userOptions.searchEngines.length && tileArray.length < userOptions.quickMenuItems;i++) {
			
			let se = userOptions.searchEngines[i];
			
			if ( se.hidden !== undefined && se.hidden) continue;

			let tile = buildSearchIcon(se.icon_base64String, se.title);

			tile.index = i;
			tile.dataset.index = i;
			
			addTileEventHandlers(tile, (e) => {
				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: tile.index,
						selectionText: sb.value,//quickMenuObject.searchTerms,
						openMethod: getOpenMethod(e)
					}
				});
			});

			tileArray.push(tile);
		}
		
		return Promise.resolve(buildQuickMenuElement({tileArray:tileArray, toolsArray:createToolsArray(), quickMenuElement: quickMenuElement}));

	}

}

function isTextBox(element) {
	
	if ( element.type === 'text' || element.type === 'textarea' || element.isContentEditable )
		return true;
	else
		return false;
}

// Special setup for IFRAME popup
if (document.title === "QuickMenu") {
	document.addEventListener("DOMContentLoaded", () => {
	
		browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
			userOptions = message.userOptions || {};
			
			if ( userOptions === {} ) return;
			
		//	let quickMenuElement = makeQuickMenu();
		
			makeQuickMenu().then( (qme) => {
				
				let quickMenuElement = qme;
		
				document.body.appendChild(quickMenuElement);
				
				let sb = document.getElementById('quickmenusearchbar');
				let sbc = document.getElementById('quickMenuSearchBarContainer');
				
				if (userOptions.quickMenuSearchBar === 'bottom') {	
					sbc.style.borderRadius = "0 0 10px 10px";
					document.body.appendChild(sbc);
				} else {
					sbc.style.borderRadius = "10px 10px 0 0";
				}

				browser.runtime.sendMessage({
					action: "quickMenuIframeLoaded", 
					size: {
						width: window.getComputedStyle(quickMenuElement,null).width,
						height: parseInt(window.getComputedStyle(quickMenuElement,null).height) + parseInt(window.getComputedStyle(sbc, null).height) + 'px'
					}
					// size: {
						// width: quickMenuElement.ownerDocument.defaultView.getComputedStyle(quickMenuElement, null).getPropertyValue("width"), 
						// height:parseInt(quickMenuElement.ownerDocument.defaultView.getComputedStyle(quickMenuElement, null).getPropertyValue("height")) + parseInt(sbc.ownerDocument.defaultView.getComputedStyle(sbc, null).height) + 'px'
					// }
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
							window.focus();
						}
					}, 100);
				});
			});
		});
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.action !== 'undefined') {
			switch (message.action) {
				case "updateQuickMenuObject":
					quickMenuObject = message.quickMenuObject;
					
					// send event to OpenAsLink tile to enable/disable
					document.dispatchEvent(new CustomEvent('updatesearchterms'));
					break;
					
				case "focusSearchBar":
					let sb = document.getElementById('quickmenusearchbar');

					if (userOptions.quickMenuSearchBarSelect) {
						sb.addEventListener('focus', ()=> {
							setTimeout(() => {
								sb.select();
							}, 100);
						},{once:true});
					}

					sb.focus();

					break;
			}
		}
	});
}

// Listen for ESC and close Quick Menu
document.addEventListener('keydown', (ev) => {
	
	if (
		ev.which !== 27 ||
		ev.repeat ||
		!userOptions.quickMenu		
	) return false;
	
	browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "esc"});
		
});

window.addEventListener('wheel', scrollEventListener);
window.addEventListener('scroll', scrollEventListener);

// set up listeners for parent windows only
if (document.title !== "QuickMenu") {
	
	// Listen for quickMenuKey
	document.addEventListener('keydown', (ev) => {
		
		if (
			ev.which !== userOptions.quickMenuKey ||
			ev.repeat ||
			!userOptions.quickMenuOnKey ||
			!userOptions.quickMenu ||
			getSelectedText(ev.target) === "" ||
			( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs)
		) return false;

		quickMenuObject.keyDownTimer = Date.now();
		
	});

	// Listen for quickMenuKey
	document.addEventListener('keyup', (ev) => {
		
		if (
			ev.which !== userOptions.quickMenuKey ||
			ev.repeat ||
			!userOptions.quickMenu ||
			!userOptions.quickMenuOnKey
		) return false;
		
		if (Date.now() - quickMenuObject.keyDownTimer < 250)
			openQuickMenu(ev);
		
		quickMenuObject.keyDownTimer = 0;
		
	});
	// Listen for HOLD quickMenuMouseButton
	document.addEventListener('mousedown', (ev) => {

		if (
			!userOptions.quickMenu ||
			!userOptions.quickMenuOnMouse ||
			userOptions.quickMenuOnMouseMethod !== 'hold' ||
			ev.which !== userOptions.quickMenuMouseButton ||
			getSelectedText(ev.target) === "" ||
			( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs )
		) return false;
		
		quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
		
		// timer for mouse down
		quickMenuObject.mouseDownTimer = setTimeout(() => {
			
			// prevent drag events when using search on mouseup
		//	if (userOptions.quickMenuSearchOnMouseUp) {
				window.addEventListener('dragstart', (e) => {
					e.preventDefault();
				}, {once: true});
		//	}

			// ignore select / drag events
			if (Math.abs(quickMenuObject.mouseCoords.x - quickMenuObject.mouseCoordsInit.x) > quickMenuObject.mouseDragDeadzone || Math.abs(quickMenuObject.mouseCoords.y - quickMenuObject.mouseCoordsInit.y) > quickMenuObject.mouseDragDeadzone ) return false;

			// prevent losing text selection
			ev.target.addEventListener('mouseup', (evv) => {
				if (evv.which !== ev.which) return;
				evv.preventDefault();
				quickMenuObject.mouseLastClickTime = Date.now();
			}, {once: true}); // parameter to run once, then delete
			
			if (ev.which === 1) {
				// Disable click to prevent links from opening
				ev.target.addEventListener('click', (evv) => {
					if (evv.which !== 1) return;
					evv.preventDefault();
					quickMenuObject.mouseLastClickTime = Date.now();
				}, {once: true}); // parameter to run once, then delete
				
			} else if (ev.which === 3) {
				// Disable the default context menu once
				document.addEventListener('contextmenu', (evv) => {
					evv.preventDefault();
					quickMenuObject.mouseLastClickTime = Date.now();
				}, {once: true}); // parameter to run once, then delete

			}	
			openQuickMenu(ev);
			
		}, quickMenuObject.delay);

	//	document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});

	});

	// Listen for HOLD quickMenuMouseButton
	document.addEventListener('mouseup', (ev) => {

		if (
			!userOptions.quickMenu ||
			!userOptions.quickMenuOnMouse ||
			userOptions.quickMenuOnMouseMethod !== 'hold' ||
			ev.which !== userOptions.quickMenuMouseButton
		) return false;
			
		clearTimeout(quickMenuObject.mouseDownTimer);
	//	document.removeEventListener('contextmenu', preventContextMenuHandler);
	});

	// Listen for quickMenuAuto 
	document.addEventListener('mousedown', (ev) => {
		
		if (
			!userOptions.quickMenu ||
			!userOptions.quickMenuAuto || 
			ev.which !== 1 ||
			ev.target.id === 'quickMenuElement' ||
			ev.target.parentNode.id === 'quickMenuElement'
		) return false;
		
		quickMenuObject.mouseDownTargetIsTextBox = isTextBox(ev.target);
		
	});

	document.addEventListener('mouseup', (ev) => {

		if (
			!userOptions.quickMenu ||
			!userOptions.quickMenuAuto || 
			ev.which !== 1 ||
			ev.target.id === 'quickMenuElement' ||
			ev.target.parentNode.id === 'quickMenuElement' ||
			getSelectedText(ev.target) === "" ||
			( isTextBox(ev.target) && !userOptions.quickMenuAutoOnInputs ) ||
			( quickMenuObject.mouseDownTargetIsTextBox && !userOptions.quickMenuAutoOnInputs )
		) return false;

		if (Date.now() - quickMenuObject.lastSelectTime > 1000 && !isTextBox(ev.target) ) return false;
		
		quickMenuObject.mouseLastClickTime = Date.now();
		
		clearTimeout(quickMenuObject.mouseDownTimer);
		
		openQuickMenu(ev);

	});

	// Listen for quickMenuOnClick
	document.addEventListener('mousedown', (ev) => {	

		if (
			!userOptions.quickMenu ||
			!userOptions.quickMenuOnMouse ||
			userOptions.quickMenuOnMouseMethod !== 'click' ||
			ev.which !== userOptions.quickMenuMouseButton ||
			getSelectedText(ev.target) === "" ||
			((ev.target.type === 'text' || ev.target.type === 'textarea' || ev.target.isContentEditable ) && !userOptions.quickMenuAutoOnInputs)
		) return false;
		
		quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
		
		function preventContextMenuHandler(evv) {
			evv.preventDefault();
		}
		
		document.addEventListener('contextmenu', preventContextMenuHandler, {once: true});
		
		// timer for right mouse down
		quickMenuObject.mouseDownTimer = setTimeout(() => {
			document.removeEventListener('contextmenu', preventContextMenuHandler);
			quickMenuObject.mouseDownTimer = null;
		},quickMenuObject.delay);

	});
			
	// Listen for quickMenuOnClick	
	document.addEventListener('mouseup', (ev) => {	

		if (
			!userOptions.quickMenu || 
			!userOptions.quickMenuOnMouse ||
			userOptions.quickMenuOnMouseMethod !== 'click' ||
			ev.which !== userOptions.quickMenuMouseButton ||
			!quickMenuObject.mouseDownTimer ||
			getSelectedText(ev.target) === ""
		) return false;
		
		quickMenuObject.mouseLastClickTime = Date.now();
		
		ev.stopPropagation();
		
		// document.addEventListener('contextmenu', (evv) => {
			// evv.preventDefault();
		// }, {once: true}); // parameter to run once, then delete
		
		openQuickMenu(ev);
		
	});

	// unlock if quickmenu is closed
	document.addEventListener('closequickmenu', () => {
		quickMenuObject.locked = false;
	});

	// close quickmenu when clicking anywhere on page
	document.addEventListener("click", (ev) => {

		if (Date.now() - quickMenuObject.mouseLastClickTime < 100) return false;

		browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_window"});

	});

	// track mouse position
	document.addEventListener("mousemove", (ev) => {
		quickMenuObject.mouseCoords = {x: ev.clientX, y: ev.clientY};
		quickMenuObject.screenCoords = {x: ev.screenX, y: ev.screenY};
	});

	// prevent quickmenu during drag events
	document.addEventListener("drag", (ev) => {
		clearTimeout(quickMenuObject.mouseDownTimer);
	});

	window.addEventListener('keydown', (e) => {
		if (
			e.keyCode !== 9 ||
			!document.getElementById('quickMenuIframe') 
		) return;
		
		e.preventDefault();
		
		// links and text boxes need to be blurred before focus can be applied to search bar (why?)
		e.target.blur();
		
		browser.runtime.sendMessage({action: "focusSearchBar"});
		
	});

	window.addEventListener('keydown', (e) => {
		if (
			!userOptions.quickMenuOnHotkey
			|| e.repeat
		) return;
		
		for (let i=0;i<userOptions.quickMenuHotkey.length;i++) {
			let key = userOptions.quickMenuHotkey[i];
			if (key === 16 && !e.shiftKey) return;
			if (key === 17 && !e.ctrlKey) return;
			if (key === 18 && !e.altKey) return;
			if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return;
		}

		e.preventDefault();
		openQuickMenu(e);
		
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions || {};
		}
		if (typeof message.action !== 'undefined') {
			switch (message.action) {
				
				case "closeQuickMenuRequest":
					closeQuickMenu(message.eventType || null);
					break;
					
				case "openQuickMenu":
					let x = (message.screenCoords.x - (quickMenuObject.screenCoords.x - quickMenuObject.mouseCoords.x * window.devicePixelRatio)) / window.devicePixelRatio;
					
					let y = (message.screenCoords.y - (quickMenuObject.screenCoords.y - quickMenuObject.mouseCoords.y * window.devicePixelRatio)) / window.devicePixelRatio;

					quickMenuObject.searchTerms = message.searchTerms;
					makeQuickMenuContainer({'x': x,'y': y});
					break;
				
				case "updateSearchTerms":

					// only update if quickmenu is opened and locked OR using IFRAME popup to avoid unwanted behavior
					if (quickMenuObject.locked || document.title === "QuickMenu") {
						quickMenuObject.searchTerms = message.searchTerms;
						
						// send event to OpenAsLink tile to enable/disable
						document.dispatchEvent(new CustomEvent('updatesearchterms'));

						browser.runtime.sendMessage({
							action: "updateQuickMenuObject", 
							quickMenuObject: quickMenuObject
						});
					}
					break;
				
				case "updateQuickMenuObject":
					quickMenuObject = message.quickMenuObject;
					
					// iframe needs to disable here
					if (quickMenuObject.disabled)
						userOptions.quickMenu = false;
					
					let qm = document.getElementById('quickMenuIframe')
					
					if( qm && message.toggleLock ) {
					
						if (quickMenuObject.locked) {
							qm.style.left = parseFloat(qm.style.left) - getOffsets().x + "px";
							qm.style.top = parseFloat(qm.style.top) - getOffsets().y + "px";
							qm.style.position='fixed';
						} else {
							qm.style.left = parseFloat(qm.style.left) + getOffsets().x + "px";
							qm.style.top = parseFloat(qm.style.top) + getOffsets().y + "px";
							qm.style.position=null;
						}
					}
			
					break;
					
				case "quickMenuIframeLoaded":
				
					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					});
					
					scaleAndPositionQuickMenu(message.size, message.resizeOnly || false);
					
					break;
			}
		}
	});
}