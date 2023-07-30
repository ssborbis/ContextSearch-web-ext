function getSideBar() { return getShadowRoot().getElementById('CS_sbIframe') }
function getOpeningTab() { return getShadowRoot().getElementById('CS_sbOpeningTab') }

browser.runtime.sendMessage({action: "getUserOptions"}).then( uo => {
	userOptions = uo;

	if ( userOptions.sideBar.widget.enabled )	
		makeOpeningTab(true);

	if ( userOptions.sideBar.startOpen )
		openSideBar();

	window.addEventListener('message', e => {
		
		switch ( e.data.action ) {
			case "closeSideBar":
				closeSideBar();
				return;
				break;
				
			case "resizeSideBarIframe":

				let url = new URL(browser.runtime.getURL(''));

				if ( e.origin !== url.origin ) return;
				
				if ( !e.data.size ) return;

				let iframe = getSideBar();
				if ( !iframe ) return;

				if ( !userOptions.enableAnimations ) 
					iframe.style.setProperty('--user-transition', 'none');

				if ( iframe.resizeWidget && e.data.tileSize) {
					iframe.resizeWidget.options.tileSize = {
						width: e.data.tileSize.width,
						height: e.data.tileSize.height
					};
				}
				
				if ( iframe.resizeWidget && e.data.singleColumn !== undefined )
					iframe.resizeWidget.options.allowHorizontal = !e.data.singleColumn;

				if ( e.data.size.height && iframe.resizeWidget && !iframe.resizeWidget.options.isResizing) {

					if ( iframe.docking.options.windowType === 'undocked' )
						iframe.style.height = Math.min(e.data.size.height, window.innerHeight * window.devicePixelRatio / userOptions.sideBar.scale) + "px";
					else
						iframe.style.height = window.innerHeight * window.devicePixelRatio / userOptions.sideBar.scale + 'px';
				}

				if ( e.data.size.width && iframe.resizeWidget && !iframe.resizeWidget.options.isResizing )						
					iframe.style.width = e.data.size.width + "px";

				runAtTransitionEnd(iframe, ["width", "height"], () => {
					
					iframe.contentWindow.postMessage({action: "resizeDone"}, browser.runtime.getURL('/searchbar.html'));

					if ( iframe.docking.options.windowType === 'undocked' )
						repositionOffscreenElement(iframe);
					
					if ( iframe.docking.options.windowType === 'docked' )
						iframe.docking.offset();
					
					if ( iframe.resizeWidget )
						iframe.resizeWidget.setPosition();
				});
				
				break;

		}
	});
	
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	switch ( message.action ) {
		case "closeSideBar":
			closeSideBar();
			break;
		case "openSideBar":
		case "sideBarHotkey":
			if ( getSideBar() )
				closeSideBar();
			else
				openSideBar();
			break;
	}
});
	
function openSideBar(options) {
	
	options = options || {};

	window.openedOnSearchResults = options.openedOnSearchResults || false;

	if ( options.minimized ) {
		closeSideBar(true);
		return;
	}

	let openingTab = getOpeningTab();
	
	if ( openingTab ) openingTab.style.display = 'none';
	if ( openingTab && !userOptions.sideBar.widget.enabled ) openingTab.parentNode.removeChild(openingTab);

	let iframe = document.createElement('iframe');
	iframe.id = 'CS_sbIframe';
	iframe.style.opacity = 0;
	iframe.style.width = "0px";

	iframe.setAttribute('allow', "clipboard-read; clipboard-write");

	iframe.style.setProperty('--cs-custom-scale', userOptions.sideBar.scale);

	iframe.allowTransparency = true;

	getShadowRoot().appendChild(iframe);
	
	function saveSideBarOptions(o) {
		userOptions.sideBar.offsets = o.lastOffsets;

		if ( iframe.dataset.opened === "true" ) {
			userOptions.sideBar.position = o.dockedPosition;
			userOptions.sideBar.windowType = o.windowType;
		}

		browser.runtime.sendMessage({action: "saveUserOptions", userOptions:userOptions, source: "saveSideBarOptions"});
	}

	iframe.onload = function() {

		makeDockable(iframe, {
			windowType: "undocked",
			dockedPosition: userOptions.sideBar.position,
			handleElement: iframe,
			lastOffsets: userOptions.sideBar.offsets,
			onUndock: o => {

				iframe.style.height = Math.min( iframe.getBoundingClientRect().height * window.devicePixelRatio, userOptions.sideBar.height ) + "px";

				saveSideBarOptions(o);
				
				runAtTransitionEnd(iframe, ["height"], () => {
					iframe.contentWindow.postMessage({action: "sideBarResize", iframeHeight: userOptions.sideBar.height, docked: false, suggestionsResize: true }, browser.runtime.getURL('/searchbar.html'));	

					// trigger transition event to reset resize widget
					if ( iframe.resizeWidget ) iframe.resizeWidget.setPosition();
					
					repositionOffscreenElement(iframe);
					
					if ( openingTab ) {
						openingTab.docking.options.lastOffsets = iframe.docking.options.lastOffsets;
						["left", "right","top","bottom"].forEach( side => openingTab.style[side] = iframe.style[side] );
					}
				});
			},
			onDock: o => {

				iframe.style.height = window.innerHeight * window.devicePixelRatio / userOptions.sideBar.scale + 'px';

				saveSideBarOptions(o);

				runAtTransitionEnd(iframe, ["height"], () => {
					iframe.contentWindow.postMessage({action: "sideBarResize", iframeHeight: window.innerHeight * window.devicePixelRatio / userOptions.sideBar.scale, docked: true}, browser.runtime.getURL('/searchbar.html'));
				});

			}
		});

		// set the initial state of the sidebar, not the opening tab
		iframe.docking.options.windowType = iframe.dataset.windowtype = userOptions.sideBar.windowType;

		iframe.docking.init();

		runAtTransitionEnd(iframe, ["height", "width"], () => { 

			iframe.style.opacity = null;
			iframe.dataset.opened = true;
			
			// add resize widget	
			let resizeWidget = addResizeWidget(iframe, {
				tileSize: {width:32, height:32}, // snap size - should update on resizeSidebar message
				columns: userOptions.sideBar.columns,
				rows: 100, // arbitrary init value
				allowHorizontal: true,
				allowVertical: true,
				onDragStart: o => {
					
					// set the fixed quadrant to top-left
					iframe.docking.translatePosition("top", "left");
				},	
				onDrag: o => {

					// step the container and iframe size
					iframe.style.height = ( o.endCoords.y - iframe.getBoundingClientRect().y ) * window.devicePixelRatio / userOptions.sideBar.scale + "px";
					
					// value set on resizeSideBar message based on singleColumn
					if ( resizeWidget.options.allowHorizontal )
						iframe.style.width = ( o.columns * resizeWidget.options.tileSize.width ) + "px";

					// rebuild menu with new dimensions
					iframe.contentWindow.postMessage({action: "sideBarRebuild", columns: o.columns, iframeHeight: parseFloat( iframe.style.height )}, browser.runtime.getURL('/searchbar.html'));	

				},
				onDrop: o => {
					
					// resize changes the offsets
					iframe.docking.options.lastOffsets = iframe.docking.getOffsets();

					// save prefs
					userOptions.sideBar.height = parseFloat( iframe.style.height );
					
					if ( resizeWidget.options.allowHorizontal )
						userOptions.sideBar.columns = o.columns;

					browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions, source: "sideBar onDrop"}).then(() => {

						// reset the fixed quadrant
						iframe.style.transition = 'none';
						let position = iframe.docking.getPositions(iframe.docking.options.lastOffsets);
						iframe.docking.translatePosition(position.v, position.h);
						iframe.style.transition = null;

						iframe.contentWindow.postMessage({action: "sideBarResize", iframeHeight:userOptions.sideBar.height}, browser.runtime.getURL('/searchbar.html'));
						
						iframe.resizeWidget.setPosition();
					});
				}
			});

			// add listener to remove the widget on close
			document.addEventListener('closesidebar', () => {
				resizeWidget.parentNode.removeChild(resizeWidget);
				delete iframe.resizeWidget;
			}, {once: true});

		});
	
	}
	
	iframe.src = browser.runtime.getURL('/searchbar.html');
	
	if ( !options.noSave ) saveState(true);

}

function closeSideBar(minimize) {
	
	let iframe = getSideBar();
	let openingTab = getOpeningTab();

	if ( openingTab || minimize) { 
	
		if ( !openingTab ) openingTab = makeOpeningTab();
	//	openingTab.docking.undock();	
		openingTab.style.display = null;
	}
	
	if ( iframe ) {
		iframe.style.opacity = null;
		iframe.dataset.opened = false;
		iframe.parentNode.removeChild(iframe);
		delete iframe;
	}

	document.dispatchEvent(new CustomEvent('closesidebar'));
	
	saveState(false);
}

function saveState(state) {
	if ( userOptions.sideBar.rememberState ) {
		userOptions.sideBar.startOpen = state;
		browser.runtime.sendMessage({action: "saveUserOptions", "userOptions": userOptions, source: "sideBar saveState"});
	}
}

function makeOpeningTab() {

	let openingTab = getOpeningTab() || document.createElement('div');

	openingTab.id = 'CS_sbOpeningTab';
	openingTab.style.setProperty("--opening-icon", 'url(' + browser.runtime.getURL("/icons/search.svg") + ')');
	openingTab.classList.add('CS_handle');
	openingTab.style.setProperty('--cs-custom-scale', userOptions.sideBar.scale);
	
	openingTab.addEventListener('click', () => {
		if ( openingTab.moving ) return false;	
		openSideBar();
	});
	
	//open sidebar if dragging text over
	openingTab.addEventListener('dragenter', e => {
		openingTab.dispatchEvent(new MouseEvent('click'));
		getSideBar().focus();
	});
	
	// prevent docking on double-click
	openingTab.addEventListener('dblclick', e => {
		e.preventDefault();
		e.stopImmediatePropagation();
	});
	
//	document.body.appendChild(openingTab);

	getShadowRoot().appendChild(openingTab);

	makeDockable(openingTab, {
		windowType: "undocked",
		dockedPosition: userOptions.sideBar.position,
		handleElement: openingTab,
		lastOffsets: userOptions.sideBar.offsets,
		onUndock: o => {
			userOptions.sideBar.offsets = o.lastOffsets;

			if (!o.init)
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions:userOptions, source: "openingTab onUndock"});
			
			// match sbContainer position with openingTab
			if ( getSideBar() && getSideBar().docking ) getSideBar().docking.options.lastOffsets = o.lastOffsets;
		}
	});

	openingTab.docking.init();
	setTimeout(() => repositionOffscreenElement(openingTab), 100);
	
	return openingTab;
}

if ( window == top && typeof addParentDockingListeners === 'function')
	addParentDockingListeners('CS_sbIframe', 'sideBar');

window.addEventListener('message', e => {
	if ( e.data.action === "closeSideBarRequest" ) 
		closeSideBar();
	if ( e.data.action === "minimizeSideBarRequest" )
		closeSideBar(true);
	if ( e.data.action === "undock")
		getSideBar().docking.undock();
});

document.addEventListener('click', e => {
	if (e.target.closest("contextsearch-widgets")) return;
	if ( !getSideBar() ) return;
	getSideBar().contentWindow.postMessage({action: "editEnd"}, browser.runtime.getURL('/searchbar.html'));
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			case "minifySideBar":
				minifySideBar();
				break;
		}
	}
});

function minifySideBar() {
	getSideBar().docking.undock();
	runAtTransitionEnd(getSideBar(), ["height", "width", "left", "top"], () => {
		getSideBar().contentWindow.postMessage({action: "minifySideBar"}, browser.runtime.getURL('/searchbar.html'));
	});
}
