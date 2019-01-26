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
			//getOpeningTab().click();
			
		// listen for quickMenuHotkey
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

			openSideBar();
			
		});
		
		window.addEventListener('message', (e) => {

			let url = new URL(browser.runtime.getURL(''));

			if ( e.origin !== url.origin ) return;
			
			if ( !e.data.size ) return;

			let iframe = getIframe();
			let sbContainer = getContainer();
			
			if ( !userOptions.enableAnimations ) 
				sbContainer.style.setProperty('--user-transition', 'none');

			if ( !iframe ) return;
			
			if ( e.data.size.height ) {
				iframe.style.height = Math.min(e.data.size.height, window.innerHeight * window.devicePixelRatio) + "px";	
				iframe.style.maxHeight = iframe.style.height;
				
				if ( userOptions.sideBar.type === 'panel' ) {
					sbContainer.style.height = 100 * window.devicePixelRatio + '%';
					iframe.style.height = '100%';
					iframe.style.maxHeight = '100%';
					sbContainer.style.top = '0';
				}
			}
			
			if ( e.data.size.width ) {
				iframe.style.width = e.data.size.width + "px";
				iframe.style.maxWidth = iframe.style.width;

				let bodyPadding = window.getComputedStyle(document.body).getPropertyValue('padding-' + userOptions.sideBar.widget.position);

				document.documentElement.style.setProperty('--cs-sidebar-width', sbContainer.getBoundingClientRect().width + parseFloat(bodyPadding) + "px");
				
				if ( userOptions.sideBar.type === 'panel' ) {
					document.documentElement.classList.add('CS_panel');
					
					// document.body.querySelectorAll('DIV').forEach( el => {
						
						// if ( el === sbContainer ) return;
						// let style = window.getComputedStyle(el);
						// if ( style.getPropertyValue('position') === 'fixed') {

							// console.log(style.getPropertyValue('width'));
							// // style.getPropertyValue('width') === '100%'
								// // parseInt(style.getPropertyValue('width')) === document.body.getBoundingClientRect().width

							// el.style.width = 'calc(100% - ' + sbContainer.getBoundingClientRect().width + 'px)';
						// //	el.classList.add('CS_panel');
						// }
					// });
				}
			}
			
			sbContainer.style.opacity = 1;

			// test for bottom overflow
			let rect = sbContainer.getBoundingClientRect();

			if ( !userOptions.sideBar.type && e.data.size.height * 1/window.devicePixelRatio + rect.top > window.innerHeight) 
				sbContainer.style.top = Math.max(0, window.innerHeight - e.data.size.height * 1/window.devicePixelRatio) + "px";
		});
		
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions;
			
			// let openingTab = getOpeningTab();
			// let sbContainer = getContainer();

			// document.documentElement.cs_sidebar_position = userOptions.sideBar.widget.position;
			
			// document.documentElement.classList.remove('CS_panel');
			
			// if ( getContainer().dataset.opened ) {
				
				// console.log('sending clicks');
				// getOpeningTab().click();
				// setTimeout( () => {
					
					// console.log(getContainer().dataset.opened);
					// getOpeningTab().click();
				// }, 2000);
					
			// }

			// causing container to move on tile dnd
		//	sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";

			getOpeningTab().style.display = userOptions.sideBar.widget.enabled ? null : "none";
		}
	});
	
	function openSideBar() {
		
		if ( !getContainer() ) main();
		
		let iframe = getIframe();
		let sbContainer = getContainer();
		let openingTab = getOpeningTab();

		iframe = document.createElement('iframe');
		iframe.id = 'CS_sbIframe';
		iframe.src = browser.runtime.getURL('/searchbar.html');
		
		openingTab.classList.add('CS_close');

		sbContainer.appendChild(iframe);

		sbContainer.insertBefore(openingTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);
		
		sbContainer.style.opacity = 1;
		sbContainer.dataset.opened = true;
	}
	
	function closeSideBar() {
		
		let iframe = getIframe();
		let sbContainer = getContainer();
		let openingTab = getOpeningTab();
		
		iframe.style.maxWidth = null;
		sbContainer.style.opacity = null;
		sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";
		openingTab.classList.remove('CS_close');

		runAtTransitionEnd(sbContainer, "height", () => { iframe.parentNode.removeChild(iframe) });

		sbContainer.dataset.opened = false;
		document.documentElement.classList.remove('CS_panel');
		
		if ( !userOptions.sideBar.widget.enabled ) {
			delete document.documentElement.dataset.cs_sidebar_position;
			document.documentElement.style.setProperty('--cs-sidebar-width', null);
			
			sbContainer.parentNode.removeChild(sbContainer);
		}
	}
	
	function main() {
		
		document.documentElement.dataset.cs_sidebar_position = userOptions.sideBar.widget.position;

		let openingTab = document.createElement('div');

		openingTab.id = 'CS_sbOpeningTab';
		openingTab.style.setProperty("--opening-icon", 'url(' + browser.runtime.getURL("/icons/search.svg") + ')');
		openingTab.style.setProperty("--closing-icon", 'url(' + browser.runtime.getURL("/icons/crossmark.svg") + ')');

		let sbContainer = document.createElement('div');
		sbContainer.id = 'CS_sbContainer';
		//sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		
		sbContainer.style.setProperty('transform', "scale(" + 1 / window.devicePixelRatio + ")", "important");
		sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";
		
		if ( userOptions.searchBarTheme === 'dark' )
			openingTab.classList.add('CS_dark');

		openingTab.addEventListener('click', () => {
			
			if ( sbContainer.moving ) return false;
			
			let iframe = getIframe();
			
			if ( iframe ) 
				closeSideBar();
			else 
				openSideBar();
		});
		
		// open sidebar if dragging text over
		openingTab.addEventListener('dragenter', (e) => {
			if ( getIframe() ) return;
			openingTab.dispatchEvent(new MouseEvent('click'));
			getIframe().focus();
		});

		openingTab.addEventListener('mousedown', (e) => {

			sbContainer.X = e.clientX;
			sbContainer.Y = e.clientY;
			sbContainer.moving = false;
			e.preventDefault();
			
			sbContainer.style.transition = "none";
			
			document.addEventListener('mousemove', tabMoveListener);

			document.addEventListener('mouseup', (_e) => {

				sbContainer.style.transition = null;
				
				document.removeEventListener('mousemove', tabMoveListener);
				
				if ( !sbContainer.moving ) return;
				
				let iframe = getIframe();
				
				sbContainer.classList.remove('CS_moving');

				userOptions.sideBar.widget.offset = parseInt(sbContainer.style.top) * window.devicePixelRatio;
				userOptions.sideBar.widget.position = document.documentElement.dataset.cs_sidebar_position;
				
				if ( iframe ) {
					sbContainer.insertBefore(openingTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);
				}

				// save prefs
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
				setTimeout(() => {sbContainer.moving = false}, 50);
			}, {once: true});
		});

		function tabMoveListener(e) {
			e.preventDefault();

			if ( !sbContainer.moving && Math.abs( sbContainer.X - e.clientX ) < 10 && Math.abs( sbContainer.Y - e.clientY ) < 10 )	return;
			
			else if ( !sbContainer.moving ) {
				sbContainer.moving = true;
				sbContainer.classList.add('CS_moving');				
			}
			
			if ( e.clientX < window.innerWidth / 4 ) {	
				document.documentElement.dataset.cs_sidebar_position = "left";
			}
			
			if ( window.innerWidth - e.clientX < window.innerWidth / 4 ) {
				document.documentElement.dataset.cs_sidebar_position = "right";
			}
			
			let _top = sbContainer.offsetTop - ( sbContainer.Y - e.clientY );
			if ( _top < 0 ) return;
			if (_top + 38 * 1 / window.devicePixelRatio > window.innerHeight) return;

			sbContainer.X = e.clientX;
			sbContainer.Y = e.clientY;

			sbContainer.style.top = _top + "px";
		}

		sbContainer.appendChild(openingTab);
		document.body.appendChild(sbContainer);
		
		// move openingTab if offscreen
		let rect = sbContainer.getBoundingClientRect();
		if ( rect.bottom > window.innerHeight )
			sbContainer.style.top = (window.innerHeight - rect.height) + "px";

	}
	
	document.addEventListener("fullscreenchange", (e) => {
		
		let sbc = getContainer();
		
		if ( userOptions.sideBar.hideFullScreen && document.fullscreen ) {

			sbc.style.display = 'none';
		//	document.documentElement.classList.remove('CS_panel');
		//	closeSideBar();
			
		} else {			
			sbc.style.display = null;
			
		//	openSideBar();
			
		//	if ( userOptions.sideBar.type === 'panel' )
		//		document.documentElement.classList.add('CS_panel');
		}
	});
}
