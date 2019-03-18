var userOptions;
var typeTimer = null;
const historyLength = 1024; // number of searches to save in userOptions
const displayCount = 10; // number of total suggestions to display (browser_action height is limited!)

// show the add search engine icon in the searchbar
// browser.runtime.sendMessage({action: "getOpenSearchHref"}).then( (result) => {
	// if (result.href) {
		// let sb = document.getElementById('searchBar');
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
let sb_width;

// context menu options
window.addEventListener('contextmenu', (e) => {
	
	browser.contextMenus.create({
		id: "showSuggestions",
		title: browser.i18n.getMessage("ShowSuggestions"),
		type: "checkbox",
		checked: userOptions.searchBarSuggestions
	}, () => {});
	browser.contextMenus.create({
		id: "clearHistory",
		title: browser.i18n.getMessage("ClearSearchHistory")
	}, () => {});

	setTimeout(() => {
		window.addEventListener('mousemove', ()=> {
			browser.contextMenus.remove("showSuggestions");
			browser.contextMenus.remove("clearHistory");
		}, {once: true});
	}, 1000);
});

// what was this for?
setInterval(() => {
	if ( browser.runtime === undefined ) return;
	browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
		userOptions = message.userOptions || {};
	});
}, 1000);

function addToHistory(terms) {
	
	terms = terms.trim();
	
	// send last search to backgroundPage for session storage
	browser.runtime.sendMessage({action: "setLastSearch", lastSearch: terms});
	
	// return if history is disabled
	if ( ! userOptions.searchBarEnableHistory ) return;
	
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

function getSelectedText(el) {
	return el.value.substring(el.selectionStart, el.selectionEnd);
}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.searchBarTheme === 'dark' )
		document.querySelector('#dark').rel="stylesheet";

	let sb = document.getElementById('searchBar');
	sb.placeholder = browser.i18n.getMessage('Search');

	browser.runtime.sendMessage({action: "getLastSearch"}).then((message) => {
		
		// skip empty 
		if (!message.lastSearch || !userOptions.searchBarDisplayLastSearch) return;
		
		sb.value = message.lastSearch;
		sb.select();

		// workaround for linux 
		var selectInterval = setInterval( () => {

			if (getSelectedText(sb) == sb.value)
				clearInterval(selectInterval);
			else
				sb.select();
		}, 50);

	});

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
				
				suggest.style.width = sb.parentNode.getBoundingClientRect().width + "px";

				suggest.addEventListener('transitionend', (e) => {

					// for browser_action
					// reset the menu height for window resizing
				//	document.getElementById('quickMenuElement').style.height = null;
				
					toolBarResize();

					// for sidebar
					sideBarResize();
				});
				
				let suggestionHeight = suggestions.length ? suggest.firstChild.getBoundingClientRect().height : 0;
				
				suggest.style.maxHeight = Math.min(suggestionHeight * 5, suggestions.length * suggestionHeight) + "px";

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
			
			if (userOptions.searchBarCloseAfterSearch) window.close();	
		}
	}
	
	function getSuggestions(terms, callback) {
		
		let url = 'https://suggestqueries.google.com/complete/search?output=toolbar&hl=' + browser.i18n.getUILanguage() + '&q=' + encodeURIComponent(terms);
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
	
	makeQuickMenu({type: window == top ? "searchbar" : "sidebar"}).then( (qme) => {
		document.body.insertBefore(qme, null);
		document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
	});
		
});

document.addEventListener('quickMenuIframeLoaded', () => {
		
	let qm = document.getElementById('quickMenuElement');
	let sb = document.getElementById('searchBar');
	let tb = document.getElementById('titleBar');
	let sg = document.getElementById('suggestions');
	let ob = document.getElementById('optionsButton');
	let mb = document.getElementById('menuBar');

	qm.querySelectorAll('.tile').forEach( div => {
		div.onmouseenter = () => tb.innerText = div.title;
		div.onmouseleave = () => tb.innerText = ' ';
	});

	ob.onclick = function() {
		// document.body.style.visibility = 'hidden';
		browser.runtime.sendMessage({action: "openOptions"});
		if ( window == top ) window.close();
	}

	// focus the searchbar on open
	sb.focus();
	
	qm.style.width = null;
	qm.style.height = null;
	
	sg.style.width = null;

	// trigger resize for sidebar. Resize triggers on load in the browser_action
	sideBarResize();
	toolBarResize();

});

function toolBarResize() {
	
	if ( window != top ) return;
	
	let qm = document.getElementById('quickMenuElement');
	let sb = document.getElementById('searchBar');
	let tb = document.getElementById('titleBar');
	let sg = document.getElementById('suggestions');
	let mb = document.getElementById('menuBar');

	runAtTransitionEnd(document.body, ["width", "height"], () => {
		if ( window.innerHeight < document.body.scrollHeight ) {
			qm.style.height = window.innerHeight - ( sb.getBoundingClientRect().height + sg.getBoundingClientRect().height + tb.getBoundingClientRect().height + mb.getBoundingClientRect().height ) + "px";
		} 

		if (qm.getBoundingClientRect().width < window.innerWidth) {

			qm.style.width = document.documentElement.scrollWidth + "px";
			
		//	tb.style.maxWidth = document.documentElement.scrollWidth - 10 + "px";

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
	if ( window == top ) return
	
	let qm = document.getElementById('quickMenuElement');
	let sb = document.getElementById('searchBar');
	let tb = document.getElementById('titleBar');
	let sg = document.getElementById('suggestions');
	let mb = document.getElementById('menuBar');
	
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
				qm.querySelectorAll('.tile:nth-of-type(' + _columns + 'n)').forEach( tile => {
					tile.parentNode.insertBefore(document.createElement('br'), tile.nextSibling);
				});
			}
			
			insertBreaks(e.data.columns);
			qm.columns = e.data.columns;
			
			sideBarResize();

			document.dispatchEvent(new CustomEvent('quickMenuIframeLoaded'));
	}
});

document.getElementById('closeButton').addEventListener('click', (e) => {
	
	if ( window != top )
		window.parent.postMessage({action: "closeSideBar"}, "*");
	else
		window.close();
});
