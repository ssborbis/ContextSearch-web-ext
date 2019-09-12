var userOptions;

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

//let columns;

// context menu options
// window.addEventListener('contextmenu', (e) => {
	
	// browser.contextMenus.create({
		// id: "showSuggestions",
		// title: browser.i18n.getMessage("ShowSuggestions"),
		// type: "checkbox",
		// checked: userOptions.searchBarSuggestions
	// }, () => {});
	// browser.contextMenus.create({
		// id: "clearHistory",
		// title: browser.i18n.getMessage("ClearSearchHistory")
	// }, () => {});

	// setTimeout(() => {
		// window.addEventListener('mousemove', ()=> {
			// browser.contextMenus.remove("showSuggestions");
			// browser.contextMenus.remove("clearHistory");
		// }, {once: true});
	// }, 1000);
// });

// what was this for? ( page_action is not considered a tab and does not receive userOptions updates )
// setInterval(() => {
	// if ( browser.runtime === undefined ) return;
	// browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		// userOptions = message.userOptions || {};
	// });
// }, 1000);

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.searchBarTheme === 'dark' )
		document.querySelector('#dark').rel="stylesheet";

	makeSearchBar();

	makeQuickMenu({type: window == top ? "searchbar" : "sidebar"}).then( (qme) => {
		document.body.insertBefore(qme, null);
		document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
		//resizeMenu();
	});	
});

document.addEventListener('quickMenuIframeLoaded', () => {
		
	qm = document.getElementById('quickMenuElement');
	sb = document.getElementById('searchBar');
	tb = document.getElementById('titleBar');
	sg = document.getElementById('suggestions');
	mb = document.getElementById('menuBar');

	// focus the searchbar on open
	sb.focus();
	
	// qm.style.width = null;
	// qm.style.height = null;	
	sg.style.width = null;

	// trigger resize for sidebar. Resize triggers on load in the browser_action
	resizeMenu();

});

function toolBarResize() {
	
	if ( window != top ) return;

	qm.style.width = null;
	qm.style.height = null;

	runAtTransitionEnd(document.body, ["width", "height"], () => {

		if ( window.innerHeight < document.documentElement.scrollHeight ) {
			
			let sumHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height;
			
			qm.style.height = ( (window.innerHeight < 600 && qm.scrollHeight > (600 - sumHeight) ) ? 600 : window.innerHeight ) - sumHeight + "px";
			
		//	qm.style.height = window.innerHeight - ( sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height ) + "px";
		} 

		if (qm.getBoundingClientRect().width < window.innerWidth) {

			qm.style.width = document.documentElement.scrollWidth + "px";
			
			// tb.style.maxWidth = document.documentElement.scrollWidth - 10 + "px";

			let div_width = 'calc(' + 100 / columns + "% - 2px)";
			qm.querySelectorAll('.tile:not(.singleColumn)').forEach( div => {
				div.style.width = div_width;
			});
		}
		
		tb.style.maxWidth = document.documentElement.scrollWidth - 10 + "px";
		sg.style.width = document.documentElement.scrollWidth;
	});
}

function sideBarResize() {

	if ( window == top ) return;
	
	// throwing sidebar errors
	if ( !qm ) return;
	
	let allOtherElsHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height;
		
	let qm_height = 'calc(100% - ' + allOtherElsHeight + "px)";
	qm.style.height = qm_height;

	setTimeout( () => {
		qm.style.height = Math.min(window.innerHeight, window.innerHeight - allOtherElsHeight) + "px";

		// account for scrollbars
		qm.style.width = qm.scrollWidth + qm.offsetWidth - qm.clientWidth + "px";
		window.parent.postMessage({action:"resizeSideBar", size: {width: qm.getBoundingClientRect().width, height: allOtherElsHeight + parseFloat(qm.style.height)}}, "*");
		
		
	}, 250);

	let rect = document.body.getBoundingClientRect();
	let rect_qm = qm.getBoundingClientRect();

	// send size to parent window for sidebar widget
	window.parent.postMessage({
		action:"resizeSideBar", 
		size: {width: rect_qm.width, height: rect.height}, 
		tileSize: {width: qm.firstChild.offsetWidth, height: qm.firstChild.offsetHeight}, 
		singleColumn: qm.querySelector(".singleColumn") ? true : false
	}, "*");
}

function resizeMenu() {
	toolBarResize();
	sideBarResize();
}

window.addEventListener('message', (e) => {

	switch (e.data.action) {
		case "sideBarResize":
			sideBarResize();
			break;
		
		case "quickMenuIframeLoaded":
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			break;
			
		case "sideBarRebuild":
			let qm = document.getElementById('quickMenuElement');
			
			function insertBreaks(_columns) {
		
				qm.querySelectorAll('br').forEach( br => {
					qm.removeChild(br);
				});
				every_nth([ ...qm.querySelectorAll('.tile:not([data-hidden="true"])')], _columns).forEach( tile => {
					tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);;
				});
			}
			
			insertBreaks(e.data.columns);
			qm.columns = e.data.columns;
			
			sideBarResize();
			
			break;
	}
});

document.getElementById('closeButton').addEventListener('click', (e) => {
	
	if ( window != top )
		window.parent.postMessage({action: "closeSideBar"}, "*");
	else
		window.close();
});

document.getElementById('menuBar').addEventListener('mousedown', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = true;
	window.parent.postMessage({action: "handle_dragstart", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mouseup', (e) => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = false;
	window.parent.postMessage({action: "handle_dragend", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mousemove', (e) => {
	if ( e.which !== 1 ) return;
	
	if ( !document.getElementById('menuBar').moving ) return;
	window.parent.postMessage({action: "handle_dragmove", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

document.getElementById('menuBar').addEventListener('dblclick', (e) => {
	if ( e.which !== 1 ) return;

	window.parent.postMessage({action: "handle_dock", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});