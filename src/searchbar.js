var userOptions;
var typeTimer = null;
const historyLength = 1024; // number of searches to save in userOptions
const displayCount = 10; // number of total suggestions to display (browser_action height is limited!)

// show the add search engine icon in the searchbar
// browser.runtime.sendMessage({action: "getOpenSearchHref"}).then( (result) => {
	// if (result.href) {
		// let sb = document.getElementById('quickmenusearchbar');
		// let img = document.createElement('img');
		// img.src = '/icons/add_search.png';
		// img.style = 'height:16px;position:absolute;right:4px;top:4px;z-index:2';
		// img.title = browser.i18n.getMessage('AddOfficial') || "add official search engine for this site";
		// document.body.appendChild(img);
	// }
// });

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

let columns;

// context menu options
window.addEventListener('contextmenu', (e) => {
	
	browser.contextMenus.create({
		id: "showSuggestions",
		title: browser.i18n.getMessage("ShowSuggestions"),
		type: "checkbox",
		checked: userOptions.searchBarSuggestions
	});
	browser.contextMenus.create({
		id: "clearHistory",
		title: browser.i18n.getMessage("ClearSearchHistory")
	});

	setTimeout(() => {
		window.addEventListener('mousemove', ()=> {
			browser.contextMenus.remove("showSuggestions");
			browser.contextMenus.remove("clearHistory");
		}, {once: true});
	}, 1000);
});

// what was this for?
setInterval(() => {
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
	});
}, 1000);

// browser.theme.onUpdated.addListener(async ({ theme, windowId }) => {
  // const sidebarWindow = await browser.windows.getCurrent();
  // /*
    // Only update theme if it applies to the window the sidebar is in.
    // If a windowId is passed during an update, it means that the theme is applied to that specific window.
    // Otherwise, the theme is applied globally to all windows.
  // */

  // console.log('theme updated');
    // console.log(theme);

// });

// browser.tabs.query({currentWindow: true, active: true}).then((tab) => {
// //	console.log(tab);
// //	console.log(tab[0].windowId);
	// browser.theme.getCurrent(tab[0].windowId).then((theme) => {
	
		// let sb = document.getElementById('quickmenusearchbar');

		// console.log(theme);

		// if (!theme.colors) return;
		
		// sb.style.backgroundColor = theme.colors.toolbar_field || null;
		// sb.parentNode.style.backgroundColor = theme.colors.toolbar_field || null;
		
		// sb.style.color = theme.colors.toolbar_field_text || null;
			
	// });
// });

function addToHistory(terms) {
		
	terms = terms.trim();
	
	// send last search to backgroundPage for session storage
	browser.runtime.sendMessage({action: "setLastSearch", lastSearch: terms});
	
	// ignore duplicates
	if (userOptions.searchBarHistory.includes(terms)) return;
	
	// remove first entry if over limit
	if (userOptions.searchBarHistory.length === historyLength)
		userOptions.searchBarHistory.shift();
	
	// add new term
	userOptions.searchBarHistory.push(terms);
	
	// update prefs
	browser.runtime.sendMessage({action: "saveUserOptions", "userOptions": userOptions});
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	let sb = document.getElementById('quickmenusearchbar');
	sb.placeholder = browser.i18n.getMessage('Search');

	browser.runtime.sendMessage({action: "getLastSearch"}).then((message) => {
		
		// skip empty 
		if (!message.lastSearch) return;
		
		sb.value = message.lastSearch;
		sb.select();
		
		function getSelectedText(el) {
			let start = el.selectionStart;
			let finish = el.selectionEnd;
			return el.value.substring(start, finish);
		}
		
		// workaround for linux 
		var selectInterval = setInterval( () => {

			if (getSelectedText(sb) == sb.value)
				clearInterval(selectInterval);
			else
				sb.select();
		}, 50);

	});
	
	let sb_width = 300;
	columns = (userOptions.searchBarUseOldStyle) ? 1 : userOptions.searchBarColumns;
	let div_width = sb_width / columns;
	
	let suggest = document.getElementById('suggestions');
		
	sb.onkeypress = function(e) {
		
		clearTimeout(typeTimer);
		
		typeTimer = setTimeout(() => {
			
			if (!sb.value.trim()) {
				suggest.style.maxHeight = null;
				return;
			}
			
			console.log('fetching suggestions');
			suggest.innerHTML = null;
			
			let history = [];
			let lc_searchTerms = sb.value.toLowerCase();
			for (let h of userOptions.searchBarHistory) {
				if (h.toLowerCase().indexOf(lc_searchTerms) === 0)
					history.push({searchTerms: h, type: 0});
				
				if (history.length === displayCount) break;
			}
			
			function displaySuggestions(suggestions) {
				
				suggestions = suggestions.sort(function(a,b) {
					return a.searchTerms - b.searchTerms;
				});
				
				for (let s of suggestions) {
					let div = document.createElement('div');
					div.style.height = "20px";
					div.onclick = function() {
						let selected = suggest.querySelector('.selectedFocus');
						if (selected) selected.classList.remove('selectedFocus');
						this.classList.add('selectedFocus');
						sb.value = this.innerText;
					}
					
					div.ondblclick = function() {
						var e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, keyCode: 13});
						sb.dispatchEvent(e);
					}
					
					let img = document.createElement("img");
					img.src = "/icons/history.png";
					img.style.height = "1em";
					img.style.marginRight = "5px";
					img.style.opacity = .75;
					img.style.verticalAlign = "middle";
					img.title = browser.i18n.getMessage('History') || "history";
					
					if (s.type === 1) img.style.visibility = 'hidden';
					div.appendChild(img);
										
					// put search terms in bold
					// let matches = new RegExp("^(.*)(" + sb.value + ")(.*)").exec(s.searchTerms);
					// //browser.runtime.sendMessage({action: "log", msg: matches});

					// for (let i=1;i<matches.length;i++) {
						// let part = matches[i];
						// let el = null;
						// if (!part) continue;
						// else if (part === sb.value) {
							// el = document.createElement('b');
							// el.innerText = sb.value;
							// el.style.fontWeight = '600';
						// } else  {
							// el = document.createTextNode(part);
						// }

						// div.appendChild(el);
					// }

					
					let text = document.createTextNode(s.searchTerms);
					div.appendChild(text);
					
//					div.innerHTML = div.innerText.replace(sb.value, "<b>" + sb.value + "</b>");
					suggest.appendChild(div);
				}
				
				suggest.style.maxHeight = Math.min(100, suggestions.length * 20) + "px";
			}
			
			if (userOptions.searchBarSuggestions) {
				getSuggestions(sb.value, (xml) => {
					
					let suggestions = [];
					for (let s of xml.getElementsByTagName('suggestion')) {
						let searchTerms = s.getAttribute('data');
						
						let found = false;
						for (let h of history) {
							if (h.searchTerms.toLowerCase() === searchTerms.toLowerCase()) {
								found = true;
								break;
							}
						}
						if (!found)
							suggestions.push({searchTerms: searchTerms, type: 1});
					}

					suggestions = history.concat(suggestions);
					
					displaySuggestions(suggestions);
					
				});
			} else
				displaySuggestions(history);
			
		}, 250);
	}
	
	sb.onkeydown = function(e) {
		if (e.keyCode === 13) {
			
			addToHistory(sb.value);
			
			if (userOptions.searchBarCloseAfterSearch)
				window.close();	

		}
	}

	function getSuggestions(terms, callback) {
		
		let url = 'http://suggestqueries.google.com/complete/search?output=toolbar&hl=' + browser.i18n.getUILanguage() + '&q=' + encodeURIComponent(terms);
		callback = callback || function() {};
		var xmlhttp;

		xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = function()	{
			if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
				if(xmlhttp.status == 200) {

					let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'application/xml');
					
					if (parsed.documentElement.nodeName=="parsererror") {
						console.log('xml parse error');
						
						console.log(parsed);
						parsed = false;
					}
					callback(parsed);
			   } else {
				   console.log('Error fetching ' + url);
			   }
			}
		}
		
		xmlhttp.ontimeout = function (e) {
			console.log('Timeout fetching ' + url);
			callback(false);
		};

		xmlhttp.open("GET", url, true);
		xmlhttp.timeout = 500;
		xmlhttp.send();
	}
	
	makeQuickMenu({type: "searchbar"}).then( (qme) => {
		document.body.appendChild(qme);
		document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
	});
	
		// set div width based on columns 
	let width = window.getComputedStyle(document.body).width / userOptions.quickMenuColumns + "px";

	var style = document.createElement('style');
	style.type = 'text/css';
	style.innerText = '#quickMenuElement DIV { width: ' + width + '; }';
	document.getElementsByTagName('head')[0].appendChild(style);
	
});

document.addEventListener('quickMenuIframeLoaded', () => {

	let qm = document.getElementById('quickMenuElement');
	let sb = document.getElementById('quickmenusearchbar');
	let suggest = document.getElementById('suggestions');
	
	for (let br of qm.querySelectorAll('br') )
		qm.removeChild(br);
	
	let divs = qm.getElementsByTagName('div');
	for (let i=0;i<divs.length;i++ ) {
		
		let div = divs[i];
		if ( (i+1) % columns === 0 )
			qm.insertBefore(document.createElement('br'), div.nextSibling);
		
		div.style.width = 300 / columns + "px";

	// addToHistory(sb.value);
	
	// if (userOptions.searchBarCloseAfterSearch)
		// window.close();	

	
		div.onmouseenter = function() {
			document.getElementById('searchEngineTitle').innerText = div.title;
		}
		div.onmouseleave = function() {
			document.getElementById('searchEngineTitle').innerText = ' ';
		}

	}

	// create Options button
	let div = document.getElementById('optionsButton');
	if (!div) {
		div = document.createElement('div');
		div.id = 'optionsButton';
		div.style = 'text-align:center;border-top:1px solid #e0e0e0';
		div.className = 'hover';
		let img = document.createElement('img');
		img.src = "/icons/settings.png";
		img.style.height = '16px';
		img.style.padding = '8px';

		div.onclick = function() {
			document.body.style.visibility = 'hidden';
			//location.href = browser.runtime.getURL('/options.html#browser_action');
			browser.runtime.sendMessage({action: "openOptions"});
			window.close();
		}
		
		document.getElementById('searchEngineTitle').style.width = parseFloat(window.getComputedStyle(qm).width) - 10 + "px";
		
		div.appendChild(img);

		document.body.appendChild(div);
	}
	
	// focus the searchbar on open
	sb.focus();
	
	// listen for resize events, specifically the browser action resizing
	// and add scrollbars when necessary
	window.addEventListener('resize', () => {
		if (window.innerHeight < parseInt(window.getComputedStyle(qm).height) ) {
			qm.style.height = window.innerHeight - 100 /* height of search bar + options button + title bar */ + "px";
			qm.style.overflowY = 'scroll';
			
			suggest.style.width = "100%";
		}

	});	

});
