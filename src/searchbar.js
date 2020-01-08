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

// context menu options
// window.addEventListener('contextmenu', e => {
	
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
	// browser.runtime.sendMessage({action: "getUserOptions"}).then( message => {
		// userOptions = message.userOptions || {};
	// });
// }, 1000);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	
	if ( message.userOptions ) userOptions = message.userOptions;

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
			case "updateQuickMenuObject":
				quickMenuObject = message.quickMenuObject;
				
				// quickMenuObject can update before userOptions. Grab the lastUsed
				userOptions.lastUsedId = quickMenuObject.lastUsed || userOptions.lastUsedId;
				
				// send event to OpenAsLink tile to enable/disable
				document.dispatchEvent(new CustomEvent('updatesearchterms'));
				break;
		}
	}
});

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.searchBarTheme === 'dark' )
		document.querySelector('#dark').rel="stylesheet";

	makeSearchBar();
	
	let singleColumn = window == top ? userOptions.searchBarUseOldStyle : userOptions.sideBar.singleColumn;

	makeQuickMenu({type: window == top ? "searchbar" : "sidebar", singleColumn: singleColumn}).then( qme => {
		document.body.appendChild(qme);

		document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
	});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	userOptions = message.userOptions || userOptions;
});

document.addEventListener('quickMenuIframeLoaded', () => {
		
	qm = document.getElementById('quickMenuElement');
	sb = document.getElementById('searchBar');
	tb = document.getElementById('titleBar');
	sg = document.getElementById('suggestions');
	mb = document.getElementById('menuBar');

	// focus the searchbar on open
	sb.focus();

	// trigger resize for sidebar. Resize triggers on load in the browser_action
	resizeMenu();

});

function toolsHandler(qm) {
	
	qm = qm || document.getElementById('quickMenuElement');
	
	toolBar = document.getElementById('toolBar');
	
	if ( !qm ) return;

	let isRootNode = !qm.rootNode.parent;
	
	if ( !isRootNode ) return;
	
	let position = userOptions.quickMenuToolsPosition;
	
	// set tools position
	if ( userOptions.quickMenuToolsAsToolbar && position !== 'hidden' ) {
		
		// move tools bar below qm
		if ( position === 'bottom' ) {
			document.addEventListener('quickMenuIframeLoaded', () => toolBar.parentNode.appendChild(toolBar), {once: true});
		}
		
		// clear the old tools bar
		toolBar.innerHTML = null;

		let ls = document.createElement('span');
		ls.innerHTML = "&#9668;";		
		ls.style.left = 0;
		toolBar.appendChild(ls);
		
		let rs = document.createElement('span');
		rs.innerHTML = "&#9658;";
		rs.style.right = 0;
		toolBar.appendChild(rs);
		
		let mouseoverInterval = null;
		rs.addEventListener('mouseenter', e => {
			mouseoverInterval = setInterval(() => toolBar.scrollLeft += 10, 50);
		});
		
		ls.addEventListener('mouseenter', e => {	
			mouseoverInterval = setInterval(() => toolBar.scrollLeft -= 10, 50);
		});
		
		[rs,ls].forEach(s => s.addEventListener('mouseleave', () => clearInterval(mouseoverInterval)));
		
		qm.toolsArray.forEach( tool => {
			tool.className = 'tile';
			toolBar.appendChild(tool);
		});
		
		function showScrollButtons() {
			ls.style.display = toolBar.scrollLeft ? 'inline-block' : null;
			rs.style.display = ( toolBar.scrollLeft < toolBar.scrollWidth - toolBar.clientWidth ) ? 'inline-block' : null;
		}
		
		// scroll on mouse wheel
		toolBar.addEventListener('wheel', e => {
			toolBar.scrollLeft += (e.deltaY*6);
			e.preventDefault();
		});
		
		toolBar.addEventListener('scroll', showScrollButtons);
		toolBar.addEventListener('mouseenter', showScrollButtons);
		toolBar.addEventListener('mouseleave', () => ls.style.display = rs.style.display = null);	
		
		qm.insertBreaks(qm.columns);
		return;
	} 	
	
	if (  // match quickmenu and searchbar tools
		((type === "searchbar" && userOptions.quickMenuColumns === qm.columns) ||
		(type === "sidebar" && userOptions.quickMenuColumns === qm.columns)) && 
		userOptions.quickMenuToolsPosition === "top" && !qm.singleColumn && isRootNode && qm.querySelectorAll('[data-type="tool"]').length !== qm.columns && !userOptions.quickMenuToolsAsToolbar) {

		qm.toolsArray.forEach( (tool, index) => {
			
			qm.insertBefore(tool, qm.children.item(index))
			
			tool.dataset.hidden = false;
			tool.style.display = null;

			if ( tool.dataset.show ) return;

			tool.dataset.disabled = true;
			tool.disabled = true;
			tool.title = "";
		});	
	} else {
		qm.querySelectorAll('[data-type="tool"]').forEach( tool => tool.parentNode.removeChild(tool) );
	}
	
	qm.toolsArray.forEach( tool => {
		if (qm.singleColumn) tool.classList.add('singleColumn');
		else tool.classList.remove('singleColumn');
	});
	
	qm.insertBreaks(qm.columns);
}

function toolBarResize() {
		
	if ( window != top ) return;

	qm.style.width = null;
	qm.style.height = null;
	sg.style.width = null;
	
	qm.insertBreaks(qm.columns); // this is usually handled in the toolsHandler, but currently the toolbar does not use that method

	runAtTransitionEnd(document.body, ["width", "height"], () => {

		if ( window.innerHeight < document.documentElement.scrollHeight ) {
			
			let sumHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height;
			
			qm.style.height = ( (window.innerHeight < 600 && qm.scrollHeight > (600 - sumHeight) ) ? 600 : window.innerHeight ) - sumHeight + "px";
			
		//	qm.style.height = window.innerHeight - ( sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height ) + "px";
		} 

		if (qm.getBoundingClientRect().width < window.innerWidth) {

			qm.style.width = document.documentElement.scrollWidth + "px";
			
			// tb.style.maxWidth = document.documentElement.scrollWidth - 10 + "px";

			let div_width = 'calc(' + 100 / qm.columns + "% - 2px)";
			qm.querySelectorAll('.tile:not(.singleColumn)').forEach( div => {
				div.style.width = div_width;
			});
		}
		
		tb.style.maxWidth = document.documentElement.scrollWidth - 10 + "px";
		sg.style.width = document.documentElement.scrollWidth;
	});
}

var docked = false;

function sideBarResize(options) {
	
	options = options || {};

	if ( window == top ) return;
	
	// throwing sidebar errors
	if ( !qm ) return;
	
	qm = document.getElementById('quickMenuElement');
	sb = document.getElementById('searchBar');
	tb = document.getElementById('titleBar');
	sg = document.getElementById('suggestions');
	mb = document.getElementById('menuBar');

	let allOtherElsHeight = sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height;

	let qm_height = qm.style.height;
	
	let iframeHeight = options.iframeHeight || ( !docked ? userOptions.sideBar.height : 10000 );
	
	qm.style.height = null;
	qm.style.width = null;
	sg.style.width = null;

	qm.style.height = function() {
		// return the full height in some cases
		
		if ( options.suggestionsResize ) return qm_height;
		
		if ( docked ) return `calc(100% - ${allOtherElsHeight}px)`;
		
		// if ( openFolder ) return 
		
		// if ( options.groupMore ) return qm.getBoundingClientRect().height + "px";
		
		return Math.min(iframeHeight - allOtherElsHeight, qm.getBoundingClientRect().height) + "px";
	}();

	// account for scrollbars
	qm.style.width = qm.scrollWidth + qm.offsetWidth - qm.clientWidth + "px";

	window.parent.postMessage({
		action:"resizeSideBarIframe", 
		size: {width: parseFloat( qm.style.width ), height: document.body.offsetHeight}, 
		singleColumn: qm.singleColumn,
		tileSize: qm.getTileSize()
	}, "*");
}

function resizeMenu(o) {
	// store scroll position
	let scrollTop = qm.scrollTop;
	let sgScrollTop = sg.scrollTop;

	window.addEventListener('message', function resizeDoneListener(e) {
		if ( e.data.action && e.data.action === "resizeDone" ) {
			qm.scrollTop = scrollTop;
			sg.scrollTop = sgScrollTop;
			window.removeEventListener('message', resizeDoneListener);
		}
	});

	toolBarResize(o);
	sideBarResize(o);
	
	qm.scrollTop = scrollTop;
	sg.scrollTop = sgScrollTop;
}

window.addEventListener('message', e => {

	switch (e.data.action) {
		case "sideBarResize":
			if ( e.data.docked !== undefined ) docked = e.data.docked;
			resizeMenu({iframeHeight: e.data.iframeHeight});
			break;
		
		case "quickMenuIframeLoaded":
			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
			break;
			
		case "sideBarRebuild":
			let qm = document.getElementById('quickMenuElement');
			
			qm.columns = e.data.columns;

			toolsHandler();
			
			qm.style.height = null;
			qm.style.width = null;

			// reset the minWidth for the tilemenu
			qm.style.minWidth = ( qm.singleColumn ? 1 : qm.columns ) * qm.getTileSize().width + "px";
			
			let rect = document.body.getBoundingClientRect();
			let rect_qm = qm.getBoundingClientRect();

			// send size to parent window for sidebar widget
			window.parent.postMessage({
				action:"resizeSideBarIframe", 
				size: {width: rect_qm.width, height: rect.height}, 
				tileSize: qm.getTileSize(), 
				singleColumn: qm.singleColumn
			}, "*");
			
			break;
	}
});

document.getElementById('closeButton').addEventListener('click', e => {
	
	if ( window != top )
		window.parent.postMessage({action: "closeSideBar"}, "*");
	else
		window.close();
});

document.getElementById('menuBar').addEventListener('mousedown', e => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = true;
	window.parent.postMessage({action: "handle_dragstart", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mouseup', e => {
	if ( e.which !== 1 ) return;

	document.getElementById('menuBar').moving = false;
	window.parent.postMessage({action: "handle_dragend", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

window.addEventListener('mousemove', e => {
	if ( e.which !== 1 ) return;
	
	if ( !document.getElementById('menuBar').moving ) return;
	window.parent.postMessage({action: "handle_dragmove", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});

document.getElementById('menuBar').addEventListener('dblclick', e => {
	if ( e.which !== 1 ) return;

	window.parent.postMessage({action: "handle_dock", target: "sideBar", e: {clientX: e.screenX, clientY: e.screenY}}, "*");
});