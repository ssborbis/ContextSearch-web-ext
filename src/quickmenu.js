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

document.addEventListener("DOMContentLoaded", () => {

	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
		
		if ( userOptions === {} ) return;

		makeQuickMenu({type: "quickmenu"}).then( (qme) => {

			document.body.appendChild(qme);
			
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
					width: window.getComputedStyle(qme,null).width,
					height: parseInt(window.getComputedStyle(qme,null).height) + parseInt(window.getComputedStyle(sbc, null).height) + 'px'
				}
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
