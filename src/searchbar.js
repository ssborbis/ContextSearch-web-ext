var userOptions;
var typeTimer = null;
const historyLength = 1024; // number of searches to save in userOptions
const displayCount = 10; // number of total suggestions to display (browser_action height is limited!)

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
		browser.contextMenus.remove("showSuggestions");
		browser.contextMenus.remove("clearHistory");
	}, 100);
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

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	function addToHistory(terms) {
		
		terms = terms.trim();
		
		// send last search to backgroundPage for session storage
		browser.runtime.sendMessage({action: "setLastSearch", lastSearch: terms});
		
		if (userOptions.searchBarHistory.includes(terms)) return;
		
		if (userOptions.searchBarHistory.length === historyLength)
			userOptions.searchBarHistory.shift();
		
		userOptions.searchBarHistory.push(terms);
		
		browser.runtime.sendMessage({action: "saveUserOptions", "userOptions": userOptions});
	}
		
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
	
	let qm = document.createElement('div');
	qm.id = 'quickMenuElement';
	
	let sb_width = 300;
	let columns = (userOptions.searchBarUseOldStyle) ? 1 : 6;
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
			
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: sb.selectedIndex || 0,
					selectionText: sb.value,
					openMethod: "openNewTab"
				}
			});
			
			addToHistory(sb.value);
			
			if (userOptions.searchBarCloseAfterSearch)
				window.close();	

		}
	}
	
	sb.addEventListener('keydown', (e) => {
		if (e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 ||e.keyCode === 40 || e.keyCode === 9) {
			
			e.preventDefault();

			let direction = 0;
			if (e.keyCode === 9 && !e.shiftKey)
				direction = 1;
			else if (e.keyCode === 9 && e.shiftKey)
				direction = -1;
			else if (e.keyCode === 40)
				direction = columns;
			else if (e.keyCode === 38)
				direction = -columns;
			else if (e.keyCode === 39)
				direction = 1; 
			else if (e.keyCode === 37)
				direction = -1;

			let divs = quickMenuElement.querySelectorAll('div[data-index]');
			
			if (sb.selectedIndex !== undefined) divs[sb.selectedIndex].classList.remove('selectedFocus');
			
			if (sb.selectedIndex === undefined)
				sb.selectedIndex = 0;
			else if (sb.selectedIndex + direction === divs.length && e.keyCode === 9)
				sb.selectedIndex = 0;
			else if (sb.selectedIndex + direction < 0 && e.keyCode === 9)
				sb.selectedIndex = divs.length -1;
			else if (sb.selectedIndex + direction >= divs.length)
				;
				//sb.selectedIndex = userOptions.quickMenuColumns - (divs.length - sb.selectedIndex);
			else if (sb.selectedIndex + direction < 0)
				;
				//sb.selectedIndex = divs.length - userOptions.quickMenuColumns - sb.selectedIndex;
			else
				sb.selectedIndex+=direction;
			
			let se = userOptions.searchEngines[sb.selectedIndex];
			document.getElementById('searchEngineTitle').innerText = se.title;

			divs[sb.selectedIndex].classList.add('selectedFocus');
		}
	});
		
	for (let i=0;i<userOptions.searchEngines.length;i++) {
		
		let se = userOptions.searchEngines[i];
		
		let div = document.createElement('div');
		
		div.style.width = div_width + "px";
	
		div.style.backgroundImage = "url(" + se.icon_base64String || se.icon_url + ")";
//		div.style.backgroundSize = 16 * userOptions.quickMenuIconScale + "px";
		div.index = i;
		div.dataset.index = i;
		div.title = se.title;
		
		div.onmouseup = function(e) {
			
			// stop all other mouse events for this tile from propagating
			for (let eventType of ['mousedown','mouseup','click','contextmenu']) {
				div.addEventListener(eventType, (ee) => {
					ee.preventDefault();
					ee.stopPropagation();
					return false;
				});
			}

			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: div.index,
					selectionText: sb.value,
					openMethod: getOpenMethod(e)
				}
			});
			
			addToHistory(sb.value);
			
			if (userOptions.searchBarCloseAfterSearch)
				window.close();	
		};
		
		div.onmouseenter = function() {
			document.getElementById('searchEngineTitle').innerText = se.title;
		}
		div.onmouseleave = function() {
			document.getElementById('searchEngineTitle').innerText = ' ';
		}
		
		qm.appendChild(div);
		
		if (userOptions.searchBarUseOldStyle) {

			div.style.width = '300px';
			div.style.height = '20px';
			div.style.fontSize = '11pt';
			div.style.border = 'none';
			div.style.fontFamily = 'Arial';
			div.style.lineHeight = '20px';
			div.style.verticalAlign = 'middle';
			div.style.backgroundPosition = '4px 2px';
			
			let span = document.createElement('span');
			span.innerText = se.title;
			span.style.marginLeft = '24px';
			
			div.appendChild(span);
		}

		if ( (i + 1) % columns === 0) {
			let br = document.createElement('br');
			qm.appendChild(br);
		}
	}
	
	document.body.appendChild(qm);

	let div = document.createElement('div');
	div.style = 'text-align:center;border-top:1px solid #e0e0e0';
	div.className = 'hover';
	let img = document.createElement('img');
	img.src = "/icons/settings.png";
	img.style.height = '16px';
	img.style.padding = '8px';

	div.onclick = function() {
		document.body.style.visibility = 'hidden';
		location.href = browser.runtime.getURL('/options.html#browser_action');
	}
	
	document.getElementById('searchEngineTitle').style.width = parseFloat(window.getComputedStyle(qm).width) - 10 + "px";
	
	div.appendChild(img);

	document.body.appendChild(div);
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
	
	// window.onfocus = function() {
		// console.log('focused');
		// setTimeout(() => {
			// sb.focus();
			// sb.select();
		// }, 10);
	// }

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
	
		// get open method based on user preferences
	function getOpenMethod(e) {
		let openMethod = "";
		if (e.which === 3)
			openMethod = userOptions.quickMenuRightClick;
		else if (e.which === 2)
			openMethod = userOptions.quickMenuMiddleClick;
		else if (e.which === 1) {
			openMethod = userOptions.quickMenuLeftClick;
			
			// ignore methods that aren't opening methods
			if (e.shiftKey && userOptions.quickMenuShift !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuShift;
			if (e.ctrlKey && userOptions.quickMenuCtrl !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuCtrl;
			if (e.altKey && userOptions.quickMenuAlt !== 'keepMenuOpen')
				openMethod = userOptions.quickMenuAlt;
		
		}

//		console.log("openMethod => " + openMethod);
		return openMethod
	}

});