if ( window != top ) {
	// console.log('not parent window');
} else {
	
	var userOptions;
	
	function getIframe() { return document.getElementById('CS_sbIframe') }
	function getOpeningTab() { return document.getElementById('CS_sbOpeningTab') }
	function getContainer() { return document.getElementById('CS_sbContainer') }
	
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
		main();
		
		if ( userOptions.sideBar.startOpen )
			getOpeningTab().click();
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions;
			
			let openingTab = getOpeningTab();
			let sbContainer = getContainer();

			sbContainer.classList.remove('CS_left', 'CS_right');			
			sbContainer.classList.add('CS_' + userOptions.sideBar.widget.position);

			sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";

			openingTab.style.display = userOptions.sideBar.widget.enabled ? null : "none";
		}
	});
		
	function main() {

		let openingTab = document.createElement('div');

		openingTab.id = 'CS_sbOpeningTab';

		let sbContainer = document.createElement('div');
		sbContainer.id = 'CS_sbContainer';
		sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		openingTab.className = sbContainer.className = 'CS_' + userOptions.sideBar.widget.position;
		sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";

		openingTab.addEventListener('click', () => {
			
			if ( sbContainer.moving ) return false;
			
			let iframe = getIframe();
			if ( iframe ) {
				iframe.style.maxWidth = null;
				sbContainer.style.opacity = null;
				sbContainer.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";
				openingTab.classList.remove('CS_close');

				runAtTransitionEnd(sbContainer, "height", () => { iframe.parentNode.removeChild(iframe) });

				return;
			}
			
			iframe = document.createElement('iframe');
			iframe.id = 'CS_sbIframe';
			iframe.src = browser.runtime.getURL('/searchbar.html');
			
			openingTab.classList.add('CS_close');

			sbContainer.appendChild(iframe);

			sbContainer.insertBefore(openingTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);
			
			sbContainer.style.opacity = 1;

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
				userOptions.sideBar.widget.position = sbContainer.classList.contains("CS_right") ? "right" : "left";
				sbContainer.classList.remove('CS_left', 'CS_right');
				sbContainer.classList.add('CS_' + userOptions.sideBar.widget.position);

				if ( iframe ) {
					sbContainer.insertBefore(openingTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);
				}

				// save prefs
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions})
				.then( ()=> {
					browser.runtime.sendMessage({action: "updateUserOptions"});
				});
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
				sbContainer.classList.remove("CS_right");
				sbContainer.classList.add("CS_left");
			}
			
			if ( window.innerWidth - e.clientX < window.innerWidth / 4 ) {
				sbContainer.classList.remove("CS_left");
				sbContainer.classList.add("CS_right");
			}
			
			let _top = sbContainer.offsetTop - ( sbContainer.Y - e.clientY );
			if ( _top < 0 ) return;
			if (_top + 38 * 1 / window.devicePixelRatio > window.innerHeight) return;

			sbContainer.X = e.clientX;
			sbContainer.Y = e.clientY;

			sbContainer.style.top = _top + "px";
		}

		if ( !userOptions.sideBar.widget.enabled )	
			openingTab.style.display = 'none';
		
		sbContainer.appendChild(openingTab);
		document.body.appendChild(sbContainer);
		
		// move openingTab if offscreen
		let rect = sbContainer.getBoundingClientRect();
		if ( rect.bottom > window.innerHeight )
			sbContainer.style.top = (window.innerHeight - rect.height) + "px";
			
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
			}
			
			if ( e.data.size.width ) {
				iframe.style.width = e.data.size.width + "px";
				iframe.style.maxWidth = iframe.style.width;
			}
			
			sbContainer.style.opacity = 1;

			// test for bottom overflow
			let rect = sbContainer.getBoundingClientRect();

			if ( e.data.size.height * 1/window.devicePixelRatio + rect.top > window.innerHeight) 
				sbContainer.style.top = Math.max(0, window.innerHeight - e.data.size.height * 1/window.devicePixelRatio) + "px";
		});
		
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

			openingTab.click();
			
		});
		
		sbContainer.addEventListener('mouseenter', (e) => {
			if ( openingTab.classList.contains('CS_close') ) {
				openingTab.classList.add('CS_hover');
			}
		});
		
		sbContainer.addEventListener('mouseleave', (e) => {
			openingTab.classList.remove('CS_hover');
		});
	}
}
