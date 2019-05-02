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

function makeFrameContents(options) {
	
	options 			= options || {};	
	options.mode 		= options.mode || "normal";
	options.resizeOnly 	= options.resizeOnly || false;

	makeQuickMenu({type: "quickmenu", mode: options.mode}).then( (qme) => {

		let old_qme = document.getElementById('quickMenuElement');
		
		if (old_qme) document.body.removeChild(old_qme);
	
		document.body.appendChild(qme);
		
		let sb = document.getElementById('searchBar');
		let sbc = document.getElementById('searchBarContainer');
		let tb = document.getElementById('toolBar');
		
		sb.dataset.position = userOptions.quickMenuSearchBar;
		
		if ( userOptions.quickMenuToolsPosition === 'bottom' && userOptions.quickMenuToolsAsToolbar )	
			document.body.appendChild(tb);
		
		if (userOptions.quickMenuSearchBar === 'bottom') 
			document.body.appendChild(sbc);
		

		browser.runtime.sendMessage({
			action: "quickMenuIframeLoaded", 
			size: {
				width: qme.getBoundingClientRect().width,
				height: qme.getBoundingClientRect().height + sbc.getBoundingClientRect().height + tb.getBoundingClientRect().height + 'px'
			},
			resizeOnly: options.resizeOnly,
			tileSize: {width: qme.firstChild.offsetWidth, height: qme.firstChild.offsetHeight},
			tileCount: qme.querySelectorAll('div:not([data-hidden])').length
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
					qme.focus();
				}
			}, 100);
		});
	});
	
}
	

document.addEventListener("DOMContentLoaded", () => {

	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
		
		if ( userOptions === {} ) return;
		
		if ( userOptions.quickMenuTheme === 'dark' )
			document.querySelector('#dark').rel="stylesheet";
		
		makeFrameContents();
		
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
				let sb = document.getElementById('searchBar');

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

// listen for messages from parent window
window.addEventListener('message', (e) => {

	switch (e.data.action) {
		case "rebuildQuickMenu":
			userOptions = e.data.userOptions;
			makeFrameContents(e.data.makeQuickMenuOptions);
			break;
	}
});
