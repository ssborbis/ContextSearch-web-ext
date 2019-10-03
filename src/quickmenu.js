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
		
		// let sb = document.getElementById('searchBar');
		let sbc = document.getElementById('searchBarContainer');
		let tb = document.getElementById('toolBar');

		if ( userOptions.quickMenuToolsPosition === 'bottom' && userOptions.quickMenuToolsAsToolbar )	
			document.body.appendChild(tb);
		
		if (userOptions.quickMenuSearchBar === 'bottom') 
			document.body.appendChild(sbc);
		
		if ( options.mode === "resize" ) {
			// qme.style.minWidth = null;
			qme.style.overflowY = null;
			qme.style.height = null;
			qme.style.width = null;
		}
		
		makeSearchBar();

		document.getElementById('closeButton').addEventListener('click', (e) => {
			browser.runtime.sendMessage({action: "closeQuickMenuRequest"});
		});

		browser.runtime.sendMessage({
			action: "quickMenuIframeLoaded", 
			size: {
				width: qme.getBoundingClientRect().width,
				height: document.body.getBoundingClientRect().height
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
			
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
		});
	});	
}

function resizeMenu(o) {
	
	o = o || {};
	
	qm = document.getElementById('quickMenuElement');
	sb = document.getElementById('searchBar');
	tb = document.getElementById('titleBar');
	sg = document.getElementById('suggestions');
	mb = document.getElementById('menuBar');

	// console.log('resizeMenu options',o);
	
	let initialHeight = qm.firstChild.offsetHeight * userOptions.quickMenuRows;

	let allOtherElsHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height;

	let currentHeight = qm.style.height;

	qm.style.height = null;
	qm.style.overflowY = null;
	qm.style.width = null;
	
	if ( o.suggestionsResize || o.lockResize ) 
		qm.style.height = currentHeight;
	else if ( o.openFolder ) 
		qm.style.height = Math.min( qm.getBoundingClientRect().height, initialHeight ) + "px";
	else if ( o.quickMenuMore || o.groupMore )
		qm.style.height = qm.getBoundingClientRect().height;
	else
		qm.style.height = Math.min(qm.getBoundingClientRect().height, window.innerHeight - allOtherElsHeight) + "px";

	qm.style.width = qm.scrollWidth + qm.offsetWidth - qm.clientWidth + "px";
	
	document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
	
	window.parent.postMessage({
		action: "quickMenuResize",
		size: {
			width:  qm.getBoundingClientRect().width, 
			height: document.body.getBoundingClientRect().height
		}}, "*");
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

// prevent context menu when using right-hold
function preventContextMenu(e) { if ( e.which === 3 ) e.preventDefault(); }		
document.addEventListener('contextmenu', preventContextMenu);
document.addEventListener('mousedown', function rightMouseDownHandler(e) {
	if ( e.which !== 3 ) return;
	document.removeEventListener('contextmenu', preventContextMenu);
	document.removeEventListener('mousedown', rightMouseDownHandler);
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
			
		case "resizeMenu":
			resizeMenu(e.data.options);
			break;
			
		case "showMenuBar":
			document.getElementById('menuBar').style.display = 'block';
			resizeMenu({lockResize: true});
			break;
			
		case "hideMenuBar":
			document.getElementById('menuBar').style.display = null;
			resizeMenu({lockResize: true});
			break;
			
	}
});

document.getElementById('menuBar').addEventListener('dblclick', (e) => {
		e.preventDefault();
		e.stopImmediatePropagation();
});

document.getElementById('menuBar').addEventListener('mousedown', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = true;
	window.parent.postMessage({action: "handle_dragstart", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mouseup', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = false;
	window.parent.postMessage({action: "handle_dragend", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mousemove', (e) => {
	if ( e.which !== 1 ) return;
	
	if ( !document.getElementById('menuBar').moving ) return;
	window.parent.postMessage({action: "handle_dragmove", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

document.getElementById('menuBar').addEventListener('dblclick', (e) => {
	if ( e.which !== 1 ) return;

	window.parent.postMessage({action: "handle_dock", target: "quickMenu", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});
