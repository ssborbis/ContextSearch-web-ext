if ( window != top ) {
	console.log('not parent window');
} else {
	
	var userOptions;
	
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
		main();
	});

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

		if (typeof message.userOptions !== 'undefined') {
			userOptions = message.userOptions;
			
			let openingTab = document.getElementById('CS_sbOpeningTab');
			let sbContainer = document.getElementById('CS_sbContainer');			
			let sbCloseTab = document.getElementById('CS_sbCloseTab');
			
			openingTab.className = userOptions.sideBar.widget.position;
			sbContainer.className = userOptions.sideBar.widget.position;
			sbContainer.style.top = openingTab.style.top;
			
			if (sbCloseTab) { // menu is open
				sbCloseTab.className = userOptions.sideBar.widget.position;
				sbContainer.insertBefore(sbCloseTab, userOptions.sideBar.widget.position === "right" ? sbContainer.firstChild : sbContainer.lastChild.nextSibling);
			}

			openingTab.style.display = userOptions.sideBar.widget.enabled ? null : "none";
		}
	});
		
	function main() {

		let openingTab = document.createElement('div');
		let sbCloseTab;
		
		openingTab.id = 'CS_sbOpeningTab';
		openingTab.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";

		openingTab.className = userOptions.sideBar.widget.position;

		openingTab.style.top = userOptions.sideBar.widget.offset * 1 / window.devicePixelRatio + "px";

		let icon = new Image();
		icon.src = browser.runtime.getURL('icons/search.png');
		icon.draggable = false;
		
		openingTab.appendChild(icon);
		
		let sbContainer = document.createElement('div');
		sbContainer.id = 'CS_sbContainer';
		sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		sbContainer.className = userOptions.sideBar.widget.position;
		sbContainer.style.top = openingTab.style.top;

		openingTab.addEventListener('click', () => {
			
			if ( openingTab.moving ) return false;
			
			let iframe = document.createElement('iframe');
			iframe.id = 'CS_searchBarIframe';
			iframe.src = browser.runtime.getURL('/searchbar.html');

			sbContainer.appendChild(iframe);

			sbCloseTab = document.createElement('div');
			sbCloseTab.id = 'CS_sbCloseTab';
			sbCloseTab.className = userOptions.sideBar.widget.position;
			
			let img = document.createElement('img');
			img.src = browser.runtime.getURL('/icons/crossmark.png');
			img.style = '-moz-user-select:none;user-select:none';
			img.style.display = 'inline-block';
			
			img.draggable = false;
			
			img.addEventListener('dragstart',(e) => {
				e.preventDefault();
				e.stopPropagation();
				img.dragging = true;
			});
			
			img.addEventListener('mousedown', (e) => {
				
				sbContainer.style.transition = 'none';
				openingTab.dispatchEvent(new MouseEvent(e.type, e));
				
				document.addEventListener('mouseup', (e) => {
					sbContainer.style.transition = null;
				}, {once:true});
			});
			
			sbCloseTab.appendChild(img);
			
			sbCloseTab.addEventListener('click', (e) => {

				// prevent closing menu on mouseup during reposition
				if ( img.dragging ) {
					delete img.dragging;
					return false;
				}
				
				if ( iframe ) {
					iframe.addEventListener('transitionend', (e) => {
						iframe.parentNode.removeChild(iframe);
						sbCloseTab.parentNode.removeChild(sbCloseTab);
					});
					iframe.style.maxWidth = null;
					openingTab.style.display = userOptions.sideBar.widget.enabled ? null : "none";
					sbContainer.style.opacity = null;
					return;
				}
			});

			sbContainer.insertBefore(sbCloseTab, userOptions.sideBar.widget.position === "right" ? iframe : iframe.nextSibling);
			
			sbContainer.style.opacity = 1;
			openingTab.style.display = 'none';
		});

		// open sidebar if dragging text over
		openingTab.addEventListener('dragover', (e) => {
			if ( document.getElementById('CS_searchBarIframe') ) return;
			openingTab.dispatchEvent(new MouseEvent('click'));
		});

		openingTab.addEventListener('mousedown', (e) => {

			openingTab.X = e.clientX;
			openingTab.Y = e.clientY;
			openingTab.moving = false;
			e.preventDefault();
			
			document.addEventListener('mousemove', tabMoveListener);

			document.addEventListener('mouseup', (_e) => {
				
				document.removeEventListener('mousemove', tabMoveListener);
				
				if ( !openingTab.moving ) return;
				
				openingTab.classList.remove('moving');
				
				userOptions.sideBar.widget.offset = parseInt(openingTab.style.top) * window.devicePixelRatio;
				userOptions.sideBar.widget.position = openingTab.classList.contains("right") ? "right" : "left";
				sbContainer.className = userOptions.sideBar.widget.position;

				// save prefs
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions})
				.then( ()=> {
					browser.runtime.sendMessage({action: "updateUserOptions"});
				});
				setTimeout(() => {openingTab.moving = false}, 50);
			}, {once: true});
		});

		function tabMoveListener(e) {
			e.preventDefault();

			if ( !openingTab.moving && Math.abs( openingTab.X - e.clientX ) < 10 && Math.abs( openingTab.Y - e.clientY ) < 10 )	return;
			
			else if ( !openingTab.moving ) {
				openingTab.moving = true;
				openingTab.classList.add('moving');
			}
			
			if ( e.clientX < window.innerWidth / 4 ) {
				openingTab.classList.remove("right");
				openingTab.classList.add("left");
			}
			
			if ( window.innerWidth - e.clientX < window.innerWidth / 4 ) {
				openingTab.classList.remove("left");
				openingTab.classList.add("right");
			}
			
			let _top = openingTab.offsetTop - ( openingTab.Y - e.clientY );
			if ( _top < 0 ) return;
			if (_top + 38 * 1 / window.devicePixelRatio > window.innerHeight) return;
			
			openingTab.style.top = _top + "px";

			openingTab.X = e.clientX;
			openingTab.Y = e.clientY;
			
			sbContainer.style.top = openingTab.style.top;
			
			// console.log(sbContainer.style.top);
		}

		if ( !userOptions.sideBar.widget.enabled )	
			openingTab.style.display = 'none';
		
		document.body.appendChild(openingTab);
		document.body.appendChild(sbContainer);
		
		// move openingTab if offscreen
		let openingTabRect = openingTab.getBoundingClientRect();
		if ( openingTabRect.bottom > window.innerHeight )
			openingTab.style.top = (window.innerHeight - openingTabRect.height) + "px";
			
		window.addEventListener('message', (e) => {

			let url = new URL(browser.runtime.getURL(''));

			if ( e.origin !== url.origin ) return;
			
			if ( !e.data.size ) return;

			let iframe = document.getElementById('CS_searchBarIframe');
			let sbContainer = document.getElementById('CS_sbContainer');

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
			sbCloseTab.style.display = 'inline-block';

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
			
			if ( document.getElementById('CS_searchBarIframe') )
				sbCloseTab.click();
			else
				openingTab.click();
			
		});
	}
}
