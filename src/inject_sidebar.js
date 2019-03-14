if ( window != top ) {
	// console.log('not parent window');
} else {
	
	var userOptions;

	function getIframe() { return document.getElementById('CS_sbIframe') }
	function getOpeningTab() { return document.getElementById('CS_sbOpeningTab') }
	function getContainer() { return document.getElementById('CS_sbContainer') }
	
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};

		if ( userOptions.sideBar.widget.enabled )	
			main();

		if ( userOptions.sideBar.startOpen )
			openSideBar();
	
		// listen for quickMenuHotkey
		window.addEventListener('keydown', (e) => {

			if (
				!userOptions.quickMenuOnHotkey
				|| e.repeat
			) return;

			// console.log(e);
			// console.log(e);
			
			// console.log(e.which);

			for (let i=0;i<userOptions.quickMenuHotkey.length;i++) {
				let key = userOptions.quickMenuHotkey[i];
				if (key === 16 && !e.shiftKey) return;
				if (key === 17 && !e.ctrlKey) return;
				if (key === 18 && !e.altKey) return;
				if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return;
			}

			e.preventDefault();

			if ( getIframe() )
				closeSideBar();
			else
				openSideBar();
			
		});
	
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
					let sbContainer = getContainer();
					
					if ( !userOptions.enableAnimations ) 
						sbContainer.style.setProperty('--user-transition', 'none');

					if ( !iframe ) return;
					
					if ( e.data.size.height ) {
						iframe.style.height = Math.min(e.data.size.height, window.innerHeight * window.devicePixelRatio, sbContainer.dataset.windowtype === 'undocked' ? parseFloat(sbContainer.style.height) || userOptions.sideBar.height : Number.MAX_SAFE_INTEGER) + "px";
						
					//	iframe.style.maxHeight = iframe.style.height;
					}
					
					if ( e.data.size.width ) {
						
						iframe.style.width = e.data.size.width + "px";
						iframe.style.maxWidth = iframe.style.width;

					}
					
					sbContainer.style.opacity = 1;

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

					runAtTransitionEnd(sbContainer, ["width", "height", "max-width", "max-height"], () => {	
						repositionOffscreenElement(sbContainer);
						
						if ( sbContainer.docking.options.windowType === 'docked' )
							sbContainer.docking.offset();
					});
					
					break;
			}

			
		});
		
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions;
			getOpeningTab().style.display = userOptions.sideBar.widget.enabled ? null : "none";
		}
		
		switch ( message.action ) {
			case "closeSideBar":
				closeSideBar();
				break;
		}
	});
	
	function openSideBar() {
		
		if ( !getContainer() ) main();
		
		let sbContainer = getContainer();
		let openingTab = getOpeningTab();
		let iframe = getIframe();

		iframe = document.createElement('iframe');
		iframe.id = 'CS_sbIframe';
		iframe.src = browser.runtime.getURL('/searchbar.html');
		
		openingTab.classList.add('CS_close');

		sbContainer.appendChild(iframe);

		sbContainer.insertBefore(openingTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);

		// set the initial state of the sidebar, not the opening tab
		sbContainer.docking.options.windowType = sbContainer.dataset.windowtype = userOptions.sideBar.windowType;
		
		runAtTransitionEnd(sbContainer, ["height", "width", "max-height", "max-width"], () => { 
			sbContainer.docking.init();
			
			sbContainer.style.opacity = 1;
			sbContainer.dataset.opened = true;
			
			// add resize widget	
			let resizeWidget = addResizeWidget(sbContainer, {
				tileSize: {width:32, height:32}, // snap size
				columns: userOptions.sideBar.columns, // bogus init value
				rows: 100, // bogus init value
				onDrag: (o) => {
					
					// set the fixed quadrant to top-left
					sbContainer.docking.translatePosition("top", "left");
					
					// step the container and iframe height
					sbContainer.style.height = ( o.endCoords.y - sbContainer.getBoundingClientRect().y ) * window.devicePixelRatio + "px";
					iframe.style.height = iframe.style.maxHeight = sbContainer.style.height;
					
					// sbContainer.style.width = ( o.columns * 32 ) * window.devicePixelRatio + "px";
					// iframe.style.width = iframe.style.maxWidth = sbContainer.style.width;
					
					// // set prefs
					// userOptions.sideBar.columns = o.columns;
					
					// console.log(o.columns);
					
					// rebuild menu with new dimensions
					iframe.contentWindow.postMessage({action: "sideBarResize"}, browser.runtime.getURL('/searchbar.html'));	
				},
				onDrop: (o) => {

					// save prefs
					userOptions.sideBar.height = parseFloat(sbContainer.style.height);
					browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});	

					setTimeout(() => {
						sbContainer.style.height = null;
						sbContainer.style.maxHeight = null;
						iframe.contentWindow.postMessage({action: "quickMenuIframeLoaded"}, browser.runtime.getURL('/searchbar.html'));	
						sbContainer.dispatchEvent(new TransitionEvent('transitionend'));
						
						// reset the quadrant
						sbContainer.style.transition = 'none';
						let position = sbContainer.docking.getPositions(sbContainer.docking.options.lastOffsets);
						sbContainer.docking.translatePosition(position.v, position.h);
						sbContainer.style.transition = null;
					}, 100);
					
				}
			});
			
			resizeWidget.style.position = 'fixed';
			resizeWidget.style.cursor = 'ns-resize';
			
			document.addEventListener('closesidebar', () => {
				resizeWidget.parentNode.removeChild(resizeWidget);
				delete sbContainer.resizeWidget;
				
			}, {once: true});
			
			
		});

	}
	
	function closeSideBar() {
		
		let iframe = getIframe();
		let sbContainer = getContainer();
		let openingTab = getOpeningTab();
		
		iframe.style.maxWidth = null;
		sbContainer.style.opacity = null;
		openingTab.classList.remove('CS_close');

		runAtTransitionEnd(sbContainer, "height", () => { iframe.parentNode.removeChild(iframe) });

		sbContainer.dataset.opened = false;
		if (sbContainer.dataset.windowtype === 'docked') {
			sbContainer.docking.undock();	
		}
		
		if ( !userOptions.sideBar.widget.enabled ) {
			sbContainer.parentNode.removeChild(sbContainer);
		}
		
		document.dispatchEvent(new CustomEvent('closesidebar'));

	}
	
	function main() {

		let openingTab = document.createElement('div');

		openingTab.id = 'CS_sbOpeningTab';
		openingTab.style.setProperty("--opening-icon", 'url(' + browser.runtime.getURL("/icons/search.svg") + ')');
		openingTab.style.setProperty("--handle-icon", 'url(' + browser.runtime.getURL("/icons/vertical.svg") + ')');
		openingTab.classList.add('CS_handle');

		let sbContainer = document.createElement('div');
		sbContainer.id = 'CS_sbContainer';

		if ( userOptions.searchBarTheme === 'dark' ) {
			sbContainer.classList.add('CS_dark');
			openingTab.classList.add('CS_dark');
		}

		openingTab.addEventListener('click', () => {
			
			if ( sbContainer.moving ) return false;
			
			let iframe = getIframe();
			
			if ( iframe ) 
				;//closeSideBar();
			else 
				openSideBar();
		});
		
		// open sidebar if dragging text over
		openingTab.addEventListener('dragenter', (e) => {
			if ( getIframe() ) return;
			openingTab.dispatchEvent(new MouseEvent('click'));
			getIframe().focus();
		});
		
		sbContainer.appendChild(openingTab);
		document.body.appendChild(sbContainer);
		
		// move openingTab if offscreen
		let rect = sbContainer.getBoundingClientRect();
		if ( rect.bottom > window.innerHeight )
			sbContainer.style.top = (window.innerHeight - rect.height) + "px";
		
		function saveSideBarOptions(o) {
			userOptions.sideBar.offsets = o.lastOffsets;
			
			if ( sbContainer.dataset.opened === "true" ) {
				userOptions.sideBar.position = o.dockedPosition;
				userOptions.sideBar.windowType = o.windowType;
			}
			
			browser.runtime.sendMessage({action: "saveUserOptions", userOptions:userOptions});
		}

		makeDockable(sbContainer, {
			windowType: "undocked",
			dockedPosition: userOptions.sideBar.position,
			handleElement: sbContainer.querySelector('.CS_handle'),
			lastOffsets: userOptions.sideBar.offsets,
			onUndock: (o) => {
				sbContainer.style.height = null;
				let iframe = getIframe();
				if ( iframe ) {
					iframe.contentWindow.postMessage({action: "sideBarResize"}, browser.runtime.getURL('/searchbar.html'));	

					// trigger transition event to reset resize widget
					sbContainer.dispatchEvent(new TransitionEvent('transitionend'));
				}

				saveSideBarOptions(o);
			},
			onDock: (o) => {
				let iframe = getIframe();

				sbContainer.style.height = 100 * window.devicePixelRatio + '%';
				iframe.style.height = '100%';
				iframe.style.maxHeight = '100%';

				iframe.contentWindow.postMessage({action: "sideBarResize"}, browser.runtime.getURL('/searchbar.html'));
				
				// dont save settings when opening tab
				saveSideBarOptions(o);
			}
		});

		sbContainer.docking.init();
	}

	document.addEventListener("fullscreenchange", (e) => {
		
		let sbc = getContainer();
		
		if ( document.fullscreen )
			sbc.style.display = 'none';		
		else			
			sbc.style.display = null;
	});
	
	document.addEventListener('zoom', (e) => {

	});
}
