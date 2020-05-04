function getSelectedText(el) {
	
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString();

}

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", ev => {
	if ( quickMenuObject ) quickMenuObject.lastSelectTime = Date.now();
	
	let searchTerms = window.getSelection().toString()
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});

});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea, [contenteditable='true']")) {
	el.addEventListener('mouseup', e => {
		let searchTerms = getSelectedText(e.target)
		if (searchTerms) {
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
			browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
		}
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', e => {

	if ( e.which !== 3 ) return false;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e) || "";
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: searchTerms});
	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

// https://stackoverflow.com/a/1045012
function offset(elem) {
    if(!elem) elem = this;

    var x = elem.offsetLeft;
    var y = elem.offsetTop;

    while (elem = elem.offsetParent) {
        x += elem.offsetLeft;
        y += elem.offsetTop;
    }

    return { left: x, top: y };
}

function repositionOffscreenElement( element, padding ) {

	padding = padding || { top:0, bottom:0, left:0, right:0 };

	let fixed = window.getComputedStyle( element, null ).getPropertyValue('position') === 'fixed' ? true : false;
	
	// let originalTransition = element.style.transition || null;
	// let originalDisplay = element.style.display || null;
	// element.style.transition = 'none';

//	element.style.display = 'none';

	element.style.maxHeight = element.style.maxWidth = 0;

	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	element.style.maxHeight = element.style.maxWidth = null;
	
	// element.style.display = originalDisplay;
	
	let rect = element.getBoundingClientRect();
	
	if ( ! fixed ) {
		
		let maxWidth = Math.min(window.innerWidth, document.body.getBoundingClientRect().right);
		let maxHeight = Math.min(window.innerHeight, document.body.getBoundingClientRect().bottom);
		
		if (rect.y < 0) 
			element.style.top = Math.max(parseFloat(element.style.top) - rect.y, 0) + padding.top + "px";
		
		if (rect.bottom > window.innerHeight) 
			element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight - padding.bottom + "px";
		
		if (rect.x < 0) 
			element.style.left = Math.max(parseFloat(element.style.left) - rect.x, 0) + padding.left + "px";
		
		if (rect.right > maxWidth ) 
			element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - maxWidth) - padding.right + "px";

		return;
	}
	
	if ( rect.bottom > window.innerHeight - scrollbarHeight ) {
		if ( element.style.bottom )
			element.style.bottom = "0";
		else 
			element.style.top = (window.innerHeight - scrollbarHeight - rect.height) + "px";
		
		// console.log('bottom overflow');
	}

	if (rect.top < 0) {
		if ( element.style.bottom ) 
			element.style.bottom = (window.innerHeight - rect.height) + "px";
		else
			element.style.top = "0";
		
		// console.log('top overflow');
	}
	
	if ( rect.right > window.innerWidth - scrollbarWidth ) {
		if ( element.style.right )
			element.style.right = "0";
		else 
			element.style.left = (window.innerWidth - scrollbarWidth - rect.width) + "px";
		
		// console.log('right overflow');
	}
	
	if ( rect.left < 0 ) {
		if ( element.style.right ) 
			element.style.right = (window.innerWidth - rect.width) + "px";
		else
			element.style.left = "0";
		
		// console.log('left overflow');
	}
	
	// if (rect.y + rect.height > window.innerHeight) 
		// element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	// if (rect.left < 0) 
		// element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	// if (rect.x + rect.width > window.innerWidth) 
		// element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

}

function getLink(el, e) {

	let a = el.closest('a');
	
	if ( !a ) return "";
	
	let method = userOptions.contextMenuSearchLinksAs;
	
	if ( e && e.ctrlKey ) method = method === 'url' ? 'text' : 'url';

	return method === 'url' ? a.href || a.innerText : a.innerText || a.href;
}

function getImage(el, e) {
	
	if ( el.innerText ) return false;
	
	if ( el.tagName === 'IMG' ) return el.src;
	
	let style = window.getComputedStyle(el, false);
	
	let backgroundImage = style.backgroundImage;

	if ( ! /^url\(/.test(backgroundImage) ) return false;

	return backgroundImage.slice(4, -1).replace(/"/g, "")
}

function addResizeWidget(el, options) {
	
	let o = {
		tileSize: {},
		deadzone: 10,
		onDragStart: function() {},
		onDrag: function() {},
		onDrop: function() {},
		columns: 0,
		rows: 0,
		isResizing: false,
		allowHorizontal: true,
		allowVertical: true,
		minRows: 1,
		minCols: 1,
		maxCols: 100,
		maxRows: 100
	}
	
	o = Object.assign(o, options);

	let resizeWidget = el.resizeWidget;

	// overlay a div to capture mouse events over els
	let overDiv = document.createElement('div');
	overDiv.className = "CS_overDiv";
	overDiv.style = "cursor:nwse-resize";
	
	// build resize widget once per quick menu open
	if ( !resizeWidget ) {
		
		let startCoords, endCoords, endSize;
		
		resizeWidget = document.createElement('div');
		resizeWidget.className = 'CS_resizeWidget';
		resizeWidget.title = browser.i18n.getMessage('resize');

		document.body.appendChild(resizeWidget);

		resizeWidget.options = o;
		resizeWidget.setPosition = positionResizeWidget;
		el.resizeWidget = resizeWidget;

		resizeWidget.addEventListener('mousedown', function elementResize(e) {
			
			o.isResizing = true;

			let startSize = {columns: o.columns, rows: o.rows};

			document.body.appendChild(overDiv);

			el.style.transition = 'none';
			el.style.borderWidth = '2px';
			el.style.borderStyle = 'dashed';
			
			resizeWidget.style.transition = 'none';

			// lower the quick menu in case zIndex = MAX
			el.style.zIndex = window.getComputedStyle(el).zIndex - 1;

			// match grid to tile size after scaling
			let stepX = el.getBoundingClientRect().width / el.offsetWidth * o.tileSize.width;
			let stepY = el.getBoundingClientRect().height / el.offsetHeight * o.tileSize.height;

			// initialize the coords with some offset for a deadzone
			startCoords = {x: e.clientX, y: e.clientY};

			document.addEventListener('mousemove', elementDrag);
			
			document.addEventListener('click', function captureClick(_e) {
				_e.stopPropagation();	
			}, {capture: true, once: true});

			// track mod size to ignore repeat drag events
			let mostRecentModSize = {columns:0,rows:0};
			
			o.onDragStart(o);
			
			function elementDrag(_e) {

				endCoords = {x: _e.clientX, y: _e.clientY};

				let colsMod = Math.floor (( endCoords.x - startCoords.x ) / stepX);
				let rowsMod = Math.floor (( endCoords.y - startCoords.y ) / stepY);
				
				// size less than 1 do nothing
				if ( startSize.columns + colsMod <= 0 || startSize.rows + rowsMod <= 0 ) return;

				// ignore repeat drag events
				if ( mostRecentModSize.columns === colsMod && mostRecentModSize.rows === rowsMod )
					return;

				o.columns = startSize.columns + colsMod;
				o.rows = startSize.rows + rowsMod;

				// add code to skip when !allowHorizontal and only rows change
				o.onDrag({
					columns: o.columns,
					rows: o.rows,
					columnsOffset: colsMod,
					rowsOffset: rowsMod,
					xOffset: endCoords.x - startCoords.x,
					yOffset: endCoords.y - startCoords.y,
					endCoords: endCoords
					
				});
				
				mostRecentModSize = {columns: colsMod, rows: rowsMod};
			}

			document.addEventListener('mouseup', _e => {

				_e.preventDefault();
				_e.stopPropagation();
				_e.stopImmediatePropagation();

				// clear overlay
				overDiv.parentNode.removeChild(overDiv);
				
				// clear resize styling
				el.style.transition = null;
				el.style.borderWidth = null;
				el.style.borderStyle = null;
				el.style.zIndex = null;
				
				resizeWidget.style.transition = null;
				
				o.onDrop(o);
				
				document.removeEventListener('mousemove', elementDrag);
				
				o.isResizing = false;
			}, {once: true});
			
		});
	}
	
	// queue reposition for transitions
	el.addEventListener('transitionend', positionResizeWidget);
	
	// reposition on custom page zoom event
	document.addEventListener('zoom', positionResizeWidget);
	
	// set animation state
	if ( !userOptions.enableAnimations ) resizeWidget.style.setProperty('--user-transition', 'none');

	/* dnd resize end */	
	positionResizeWidget();

	function positionResizeWidget() {
		
		resizeWidget.style.top = null;
		resizeWidget.style.left = null;
		resizeWidget.style.right = null;
		resizeWidget.style.bottom = null;

		let w_rect = resizeWidget.getBoundingClientRect();
		let rect = el.getBoundingClientRect();

		resizeWidget.style.transformOrigin = el.style.transformOrigin || "top left";
		resizeWidget.style.transform = window.getComputedStyle(el, null).getPropertyValue('transform');
		
		let offset = 8 / window.devicePixelRatio;

		if ( el.style.left ) 
			resizeWidget.style.left = parseFloat(el.style.left) + rect.width - w_rect.width + offset + "px";
		if ( el.style.right )
			resizeWidget.style.right = parseFloat(el.style.right) - offset + "px";
		if ( el.style.top )
			resizeWidget.style.top = parseFloat(el.style.top) + rect.height - w_rect.height + offset + "px";
		if ( el.style.bottom )
			resizeWidget.style.bottom = parseFloat(el.style.bottom) - offset + "px";
	}
	
	return resizeWidget;
}

function showNotification(msg) {
	let CS_notification = document.createElement('div');
	CS_notification.className = 'CS_notification';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/alert.png');
	
	let content = document.createElement('div');
	content.className = 'content';
	content.innerText = msg;
	
	[img, content].forEach(el => CS_notification.appendChild(el));

	CS_notification.style.opacity = 0;
	document.body.appendChild(CS_notification);
	CS_notification.getBoundingClientRect();
	CS_notification.style.opacity = 1;
	CS_notification.getBoundingClientRect();
	setTimeout(() => {
		runAtTransitionEnd(CS_notification, ['opacity'], () => {
			document.body.removeChild(CS_notification);
			delete CS_notification;
		});
		
		CS_notification.style.opacity = 0;
	}, 3000);
	
	CS_notification.onclick = () => {
		document.body.removeChild(CS_notification);
		delete CS_notification;
	}
}

// set zoom attribute to be used for scaling objects
document.documentElement.style.setProperty('--cs-zoom', window.devicePixelRatio);

document.addEventListener('zoom', e => {
	document.documentElement.style.setProperty('--cs-zoom', window.devicePixelRatio);
});

// apply global user styles for /^[\.|#]CS_/ matches in userStyles
browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	let userOptions = result.userOptions;

	if ( userOptions.userStylesEnabled && userOptions.userStylesGlobal ) {
		
		let styleEl = document.createElement('style');
		
		styleEl.innerText = userOptions.userStylesGlobal;

		document.head.appendChild(styleEl);
	}
});

// document.addEventListener('mouseup', e => {
	
	// if ( e.which !== 1 ) return;
	
	// let selection = document.getSelection().toString();
	
	// if ( !selection ) return;
	
	// if ( selection.length > 2048 ) return;

	// let input = document.createElement('input');
	// input.type = "text";
	// input.value = document.getSelection().toString();
	// input.style.display = 'none';
	// document.body.appendChild(input);

	// input.select();
	
	// if ( !document.queryCommandSupported('copy') ) {
		// console.log('copy not supported');
		// return;
	// }

	// document.execCommand("copy");
	// browser.runtime.sendMessage({action: 'copy', msg: selection});
// });
