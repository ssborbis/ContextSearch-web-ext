// unique object to reference globally
var quickMenuObject = { 
	triggered_mouse: false, 
	triggered_key: false,
	delay: 250, // how long to hold right-click before translating in ms
	keyDownTimer: 0,
	mouseDownTimer: 0,
	mouseCoords: {x: 0, y:0},
	mouseCoordsInit: {x:0,y:0},
	mouseLastClick: 0,
	mouseDragDeadzone: 4
}; 

var searchEngines = [];
var userOptions = {};

document.addEventListener('keydown', (ev) => {
	
	if (ev.repeat) return false;
	if (!userOptions.quickMenu) return false; 
	if (!userOptions.quickMenuOnKey) return false;
	if (ev.which !== userOptions.quickMenuKey) return false;
	if (getSelectedText(ev.target) === "") return false;

	quickMenuObject.keyDownTimer = Date.now();
	
	return false;
});

document.addEventListener('keyup', (ev) => {
	
	if (ev.repeat) return false;
	if (!userOptions.quickMenu) return false; 
	if (!userOptions.quickMenuOnKey) return false;
	if (ev.which !== userOptions.quickMenuKey) return false;
	
	if (Date.now() - quickMenuObject.keyDownTimer < 250) {
		quickMenuObject.triggered_key = true;	
		main(ev);
	}
	
	quickMenuObject.keyDownTimer = 0;
	
	return false;
});

// Listen for a long right-click and enable script
document.addEventListener('mousedown', function(ev) {

	if (!userOptions.quickMenu) return false;
	if (!userOptions.quickMenuOnMouse) return false; 
	if (ev.which !== userOptions.quickMenuMouseButton) return false;
	if (getSelectedText(ev.target) === "") return false;
	
	quickMenuObject.mouseCoordsInit = {x: ev.clientX, y: ev.clientY};
//	ev.preventDefault();
//	console.log(ev);
	// timer for right mouse down
	quickMenuObject.mouseDownTimer = setTimeout(function() {
		
		if (Math.abs(quickMenuObject.mouseCoords.x - quickMenuObject.mouseCoordsInit.x) > quickMenuObject.mouseDragDeadzone || Math.abs(quickMenuObject.mouseCoords.y - quickMenuObject.mouseCoordsInit.y) > quickMenuObject.mouseDragDeadzone ) return false;

		// Reached the required mousedown time so enable the global trigger
		quickMenuObject.triggered_mouse = true;	
		
		if (ev.which === 1) {
			
			// prevent losing text selection		
			document.addEventListener('mouseup', function(evv) {
				if (evv.which !== 1) return;
				evv.preventDefault();
				quickMenuObject.mouseLastClick = Date.now();
			}, {once: true}); // parameter to run once, then delete
		
		} else if (ev.which === 3) {
			// Disable the default context menu once
			document.addEventListener('contextmenu', function(evv) {
				evv.preventDefault();
			}, {once: true}); // parameter to run once, then delete
		}
		
		// run main script body
		main(ev);
		
	}, quickMenuObject.delay);

	return false;
});

document.addEventListener('mouseup', function(ev) {
	
	// if disabled, do nothing
	if (!userOptions.quickMenu) return false;
	if (!userOptions.quickMenuOnMouse) return false; 
	if (ev.which !== userOptions.quickMenuMouseButton) return false;
			
	// clear the mousedown timer
	clearTimeout(quickMenuObject.mouseDownTimer);
	
	return false;
});

// main single word capture, selection capture, translate and display method
function main(ev) {

	// if disabled or not triggered, do nothing
	if (!userOptions.quickMenu) return false;
	if (!quickMenuObject.triggered_mouse && !quickMenuObject.triggered_key) return false;	
	
	// clear the triggers
	quickMenuObject.triggered_mouse = false; 
	quickMenuObject.triggered_key = false;
	
	ev = ev || window.event;
	var target = ev.target || ev.srcElement;	// clicked element
	
	// create the element object to hold the word we clicked
	var selectedText = getSelectedText(ev.target);

	// get actual element offsets with scrolling
	var xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);	
	var yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);
	
	var x = ev.clientX || quickMenuObject.mouseCoords.x;
	var y = ev.clientY || quickMenuObject.mouseCoords.y;

	// popup div parent
	var hover_div = document.createElement('div');
	hover_div.style.top = y + yOffset - 2  + "px";
	hover_div.style.left = x + xOffset - 2 + "px";
	hover_div.id = 'hover_div';
	hover_div.onclick = function() {
		hover_div.parentNode.removeChild(hover_div);
	};

	hover_div.style.maxWidth = userOptions.quickMenuColumns * (16 + 16 + 2) + "px"; // set width icon width + icon padding * cols
	
	// remove old popup
	var old_hover_div = document.getElementById(hover_div.id);
	if (old_hover_div !== null && old_hover_div.parentNode) old_hover_div.parentNode.removeChild(old_hover_div);

	for (var i=0;i<searchEngines.length && i < userOptions.quickMenuItems;i++) {

		var q = replaceOpenSearchParams(searchEngines[i].query_string, selectedText);
		
		var img = document.createElement('img');
		img.src = searchEngines[i].icon_base64String || searchEngines[i].icon_url;
		img.index = i;
		img.title = searchEngines[i].title;
		img.className = "searchIcon";
		
		function openLink(e) {
			e.preventDefault();			

			browser.runtime.sendMessage({
				action: "openTab", 
				info: {
					modifiers: [
						(e.shiftKey) ? "Shift" : null,
						(e.ctrlKey) ? "Ctrl": null
					],
					menuItemId: this.index,
					selectionText: selectedText
				}
			});
		}

		img.addEventListener('click', openLink);		
		hover_div.appendChild(img);
	}

	document.body.appendChild(hover_div);
/*	iframe handler

	if (window.frameElement === null) 
		document.body.appendChild(hover_div);
	else {
//		let documentWidth = parent.window.innerWidth;
//		let documentHeight = parent.window.innerHeight;
//		let iframeWidth = window.innerWidth;
//		let iframeHeight = window.innerHeight;
		// Get Left Position
		let iframeX = window.frameElement.offsetLeft;
		// Get Top Position
		let iframeY = window.frameElement.offsetTop;
		console.log(iframeX + "," + iframeY);
		console.log(x + "," + y);
		hover_div.style.left = x + iframeX + "px";
		hover_div.style.top = y + iframeY + "px";
		parent.document.body.appendChild(hover_div);
	}
*/	
	if (searchEngines.length === 0 || typeof searchEngines[0].icon_base64String === 'undefined') {
		var div = document.createElement('div');
		div.style='font-size:8pt;padding:10px 2px;text-align:center';
		div.innerText = 'Where are my icons?';
		div.onclick = function() {
			alert('If you are seeing this message, reload your search settings file\r\nIf an icon cannot be loaded, it will given a color');
			
			browser.runtime.sendMessage({action: "openOptions"});	
		}
		
		hover_div.appendChild(div);
	}
	
	var els = document.getElementById('hover_div').getElementsByTagName('*');
	for (var i in els) {
		if (els[i].nodeType === undefined || els[i].nodeType !== 1) continue;
		if (window.getComputedStyle(els[i], null).getPropertyValue("display") === 'none' || window.getComputedStyle(document.getElementById('hover_div'), null).getPropertyValue("display") === 'none') {
			console.log('quick menu hidden by external script (adblocker?).  Enabling context menu');
			browser.runtime.sendMessage({action: 'enableContextMenu'}).then(() => {
				let mev = new MouseEvent('contextmenu', {
					view: window,
					bubbles: true,
					cancelable: true
				});
				document.elementFromPoint(x, y).dispatchEvent(mev);
			});
			break;
		}
	}

	return false;
}

function getSelectedText(el) {
	var text = "";
	if (typeof window.getSelection != "undefined") {
		text = window.getSelection().toString();
	} else if (typeof document.selection != "undefined" && document.selection.type == "Text") {
		text = document.selection.createRange().text;
	}

	if (el && typeof el.selectionStart !== 'undefined') {
		var start = el.selectionStart;
		var finish = el.selectionEnd;
		text = el.value.substring(start, finish);
	}

	return text;
}

document.addEventListener("click", (e) => {
	if (e.which === 3) return false; // ignore right-click
	var hover_div = document.getElementById('hover_div');
	if (hover_div === null) return false;
	if (Date.now() - quickMenuObject.mouseLastClick < 100) return false; // prevents hover_div from closing immediately

	hover_div.parentNode.removeChild(hover_div);
});

document.addEventListener("mousemove", function(ev) {
	quickMenuObject.mouseCoords = {x: ev.clientX, y: ev.clientY};
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	userOptions = message.userOptions || {};
	searchEngines = message.searchEngines || [];
});

browser.runtime.sendMessage({action: "getSearchEngines"}).then((message) => {
	searchEngines = message.searchEngines || [];
});

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});
