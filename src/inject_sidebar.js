if ( window != top ) {
	// console.log('not parent window');
} else {
	
	var userOptions;

	function getIframe() { return document.getElementById('CS_sbIframe') }
	function getOpeningTab() { return document.getElementById('CS_sbOpeningTab') }
	
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};

		if ( userOptions.sideBar.widget.enabled )	
			makeOpeningTab();

		if ( userOptions.sideBar.startOpen )
			openSideBar();

		window.addEventListener('message', (e) => {
			
			switch ( e.data.action ) {
				case "closeSideBar":
					closeSideBar();
					return;
					break;
					
				case "resizeSideBar":

					let url = new URL(browser.runtime.getURL(''));

					if ( e.origin !== url.origin ) return;
					
					if ( !e.data.size ) return;

					let iframe = getIframe();
					
					if ( !userOptions.enableAnimations ) 
						iframe.style.setProperty('--user-transition', 'none');

					if ( !iframe ) return;

					if ( e.data.size.height) {
						if ( iframe.dataset.windowtype === 'undocked' )
							iframe.style.height = Math.min(e.data.size.height, window.innerHeight * window.devicePixelRatio, iframe.dataset.windowtype === 'undocked' ? userOptions.sideBar.height : Number.MAX_SAFE_INTEGER) + "px";
					}
					
					if ( e.data.size.width ) {						
						iframe.style.width = e.data.size.width + "px";
						iframe.style.maxWidth = iframe.style.width;
					}
					
					if ( iframe.resizeWidget && e.data.tileSize) {
						iframe.resizeWidget.options.tileSize = {
							width: e.data.tileSize.width,
							height: e.data.tileSize.height
						};
						
						iframe.resizeWidget.options.allowHorizontal = !e.data.singleColumn;
					}
					
					iframe.style.opacity = 1;

					// test for bottom overflow
					// let rect = sbContainer.getBoundingClientRect();
					
					// if ( userOptions.sideBar.type === 'overlay' && e.data.size.height * 1/window.devicePixelRatio + rect.top > window.innerHeight) {
						
						// if ( true )
							// sbContainer.style.top = Math.max(0, window.innerHeight - e.data.size.height * 1/window.devicePixelRatio) + "px";
						// else {
							// sbContainer.style.height = window.innerHeight - parseFloat(sbContainer.style.top) * 1/window.devicePixelRatio + "px";
							// iframe.style.maxHeight = sbContainer.style.height;
						// }
					// }

					runAtTransitionEnd(iframe, ["width", "height", "max-width", "max-height"], () => {	
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

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions;
		}
		
		switch ( message.action ) {
			case "closeSideBar":
				closeSideBar();
				break;
				
			case "sideBarHotkey":
				if ( getIframe() )
					closeSideBar();
				else
					openSideBar();
				break;
		}
	});
		
	function openSideBar() {

		let openingTab = getOpeningTab();
		
		if ( openingTab ) openingTab.style.display = 'none';

		let iframe = document.createElement('iframe');
		iframe.id = 'CS_sbIframe';
		iframe.src = browser.runtime.getURL('/searchbar.html');

		if ( userOptions.searchBarTheme === 'dark' ) 
			iframe.classList.add('CS_dark');

		document.body.appendChild(iframe);
		
		// move openingTab if offscreen
		let rect = iframe.getBoundingClientRect();
		if ( rect.bottom > window.innerHeight )
			iframe.style.top = (window.innerHeight - rect.height) + "px";
		
		function saveSideBarOptions(o) {
			userOptions.sideBar.offsets = o.lastOffsets;
			
			if ( iframe.dataset.opened === "true" ) {
				userOptions.sideBar.position = o.dockedPosition;
				userOptions.sideBar.windowType = o.windowType;
			}
			
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions:userOptions});
		}

		makeDockable(iframe, {
			windowType: "undocked",
			dockedPosition: userOptions.sideBar.position,
			handleElement: iframe,
			lastOffsets: userOptions.sideBar.offsets,
			onUndock: (o) => {
				iframe.style.height = null;
				iframe.contentWindow.postMessage({action: "sideBarResize"}, browser.runtime.getURL('/searchbar.html'));	

				// trigger transition event to reset resize widget
				if ( iframe.resizeWidget ) iframe.resizeWidget.setPosition();

				saveSideBarOptions(o);
			},
			onDock: (o) => {

				iframe.style.height = 100 * window.devicePixelRatio + '%';
				// iframe.style.maxHeight = 100 * window.devicePixelRatio + '%';
				iframe.contentWindow.postMessage({action: "sideBarResize"}, browser.runtime.getURL('/searchbar.html'));

				saveSideBarOptions(o);
			}
		});

		iframe.docking.init();

		// set the initial state of the sidebar, not the opening tab
		iframe.docking.options.windowType = iframe.dataset.windowtype = userOptions.sideBar.windowType;
		
		runAtTransitionEnd(iframe, ["height", "width", "max-height", "max-width"], () => { 
			iframe.docking.init();
			
			iframe.style.opacity = 1;
			iframe.dataset.opened = true;
			
			// add resize widget	
			let resizeWidget = addResizeWidget(iframe, {
				tileSize: {width:32, height:32}, // snap size - should update on resizeSidebar message
				columns: userOptions.sideBar.columns,
				rows: 100, // arbitrary init value
				allowHorizontal: true,
				allowVertical: true,
				onDrag: (o) => {
					
					// set the fixed quadrant to top-left
					iframe.docking.translatePosition("top", "left");
					
					// step the container and iframe size
					iframe.style.height = ( o.endCoords.y - iframe.getBoundingClientRect().y ) * window.devicePixelRatio + "px";
					iframe.style.maxHeight = iframe.style.height;
					
					// value set on resizeSideBar message based on singleColumn
					if ( resizeWidget.options.allowHorizontal )
						iframe.style.width = iframe.style.maxWidth = ( o.columns * resizeWidget.options.tileSize.width ) + "px";

					// rebuild menu with new dimensions
					iframe.contentWindow.postMessage({action: "sideBarRebuild", columns:o.columns}, browser.runtime.getURL('/searchbar.html'));	

				},
				onDrop: (o) => {

					// resize changes the offsets
					iframe.docking.options.lastOffsets = iframe.docking.getOffsets();

					// save prefs
					userOptions.sideBar.height = parseFloat( iframe.style.height || iframe.style.maxHeight );
					
					if ( resizeWidget.options.allowHorizontal )
						userOptions.sideBar.columns = o.columns;
					
					browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});	
					
					// reset the fixed quadrant
					iframe.style.transition = 'none';
					let position = iframe.docking.getPositions(iframe.docking.options.lastOffsets);
					iframe.docking.translatePosition(position.v, position.h);
					iframe.style.transition = null;

					// crop the sidebar size after a delay
					setTimeout(() => {
						iframe.style.height = null;
						iframe.style.maxHeight = null;
						iframe.contentWindow.postMessage({action: "quickMenuIframeLoaded"}, browser.runtime.getURL('/searchbar.html'));	
						iframe.resizeWidget.setPosition();
					}, 100);
					
				}
			});
			
			// unlike the quickmenu, the sizebar should be fixed
			resizeWidget.style.position = 'fixed';
			
			// add listener to remove the widget on close
			document.addEventListener('closesidebar', () => {
				resizeWidget.parentNode.removeChild(resizeWidget);
				delete iframe.resizeWidget;
			}, {once: true});

		});

	}
	
	function closeSideBar() {
		
		let iframe = getIframe();
		let openingTab = getOpeningTab();
		
		iframe.style.maxWidth = null;
		iframe.style.opacity = null;
		
		if ( openingTab ) { // reposition the openingTab to match sidebar position
			["left", "right","top","bottom"].forEach( side => openingTab.style[side] = iframe.style[side] );
			openingTab.style.display = null;
		}

		runAtTransitionEnd(iframe, "height", () => { iframe.parentNode.removeChild(iframe) });

		iframe.dataset.opened = false;
		
		if (iframe.dataset.windowtype === 'docked')
			iframe.docking.undock();	

		document.dispatchEvent(new CustomEvent('closesidebar'));

	}
	
	function makeOpeningTab() {

		let openingTab = document.createElement('div');

		openingTab.id = 'CS_sbOpeningTab';
		openingTab.style.setProperty("--opening-icon", 'url(' + browser.runtime.getURL("/icons/search.svg") + ')');
		openingTab.classList.add('CS_handle');
		
		openingTab.addEventListener('click', () => {
			if ( openingTab.moving ) return false;	
			openSideBar();
		});
		
		//open sidebar if dragging text over
		openingTab.addEventListener('dragenter', (e) => {
			openingTab.dispatchEvent(new MouseEvent('click'));
			getIframe().focus();
		});
		
		// prevent docking on double-click
		openingTab.addEventListener('dblclick', (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
		});
		
		if ( userOptions.searchBarTheme === 'dark' )
			openingTab.classList.add('CS_dark');
		
		document.body.appendChild(openingTab);

		makeDockable(openingTab, {
			windowType: "undocked",
			dockedPosition: userOptions.sideBar.position,
			handleElement: openingTab,
			lastOffsets: userOptions.sideBar.offsets,
			onUndock: (o) => {
				userOptions.sideBar.offsets = o.lastOffsets;
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions:userOptions});
				
				// match sbContainer position with openingTab
				if ( getIframe() ) getIframe().docking.options.lastOffsets = o.lastOffsets;
			}
		});

		openingTab.docking.init();
	}

	// docking event listeners for iframe
	window.addEventListener('message', (e) => {
	
		if ( e.data.target !== "sideBar" ) return;
		
		let x = e.data.e.clientX / window.devicePixelRatio;
		let y = e.data.e.clientY / window.devicePixelRatio;

		switch ( e.data.action ) {
			case "handle_dragstart":
				getIframe().docking.moveStart({clientX:x, clientY:y});
				break;
			
			case "handle_dragend":
				getIframe().docking.moveEnd({clientX:x, clientY:y});
				break;
			
			case "handle_dragmove":
				getIframe().docking.moveListener({clientX:x, clientY:y});
				break;
				
			case "handle_dock":
				getIframe().docking.toggleDock();
				break;
		}
	});

	document.addEventListener("fullscreenchange", (e) => {
		
		let iframe = getIframe();
		let ot = getOpeningTab();
		
		if ( document.fullscreen )	
			[iframe, ot].forEach( el => { if ( el ) el.classList.add('CS_hide');});
		else 		
			[iframe, ot].forEach( el => { if ( el ) el.classList.remove('CS_hide');});
	});

}
