window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

let isFirefox = navigator.userAgent.match('Firefox') ? true : false;

function notify(message, sender, sendResponse) {
		
	switch(message.action) {

		case "saveUserOptions":
			userOptions = message.userOptions;
			return browser.storage.local.set({"userOptions": message.userOptions});
			break;
			
		case "updateUserOptions":
			return getAllOpenTabs().then((tabs) => {
				for (let tab of tabs) {
					browser.tabs.sendMessage(tab.id, {"userOptions": userOptions}).catch(function(error) {
					  error.url = tab.url;
					  console.log(error);
					});	
				}
			}).then(() => {
				buildContextMenu();
			});
			break;
			
		case "nativeAppRequest":
		
			message.userOptions = userOptions;

			let nativeApping = browser.runtime.sendMessage("contextsearch.webext.native.messenger@ssborbis.addons.mozilla.org", message);
			
			return nativeApping.then((result) => {	

				// quick check for valid userOptions
				if (result && result.searchEngines) {

					console.log("native app: adding " + (result.searchEngines.length - userOptions.searchEngines.length) + " search engines");

					userOptions = result;
					
					notify({action: "saveOptions"});
					notify({action: "updateUserOptions"});
					
				}
				
				return result;

			}, (e) => {
				console.log(e);
			});
			
			break;
			
		case "openOptions":
			browser.tabs.create({
				url: browser.runtime.getURL("/options.html" + (message.hashurl || "")) 
			});
			
			break;
			
		case "quickMenuSearch":
			if (!sender.tab) { // browser_action popup has no tab, use current tab
				function onFound(tabs) {
					let tab = tabs[0];
					console.log(message.info);
					return quickMenuSearch(message.info, tab);
				}

				function onError(err){
					console.error(err);
				}
				return browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);
			} else
				return quickMenuSearch(message.info, sender.tab);
			break;
			
		case "enableContextMenu":
			userOptions.contextMenu = true;
			buildContextMenu();
			break;
			
		case "getUserOptions":
			return Promise.resolve({"userOptions": userOptions});
			break;
		
		case "getDefaultUserOptions":
			return Promise.resolve({"defaultUserOptions": defaultUserOptions});
			break;
			
		case "getSearchEngineById":
		
			if ( !message.id) return;
			
			return Promise.resolve({"searchEngine": userOptions.searchEngines.find(se => se.id === message.id)});
			break;

		case "openQuickMenu":
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "closeQuickMenuRequest":
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
		
		case "quickMenuIframeLoaded":
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
		
		case "updateQuickMenuObject":
			// send to all frames for bi-directional updates to/from quickmenu IFRAME v1.3.8+
			browser.tabs.sendMessage(sender.tab.id, message);
			break;
			
		case "rebuildQuickMenu":
			console.log('rebuildQuickMenu bg.js');
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "closeWindowRequest":
			return browser.windows.remove(sender.tab.windowId);
			break;
		
		case "closeCustomSearch":
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "getOpenSearchHref":
		
			return Promise.resolve(browser.tabs.query({currentWindow: true, active: true}).then( (tab) => {
				return browser.tabs.executeScript( tab.id, {
					code: "document.querySelector('link[type=\"application/opensearchdescription+xml\"]').href"
				}).then( (result) => {

					result = result.shift();

					if (result)
						return {href: result};
					else
						return {};
				});
			}));

			break;
			
		case "updateSearchTerms":
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "updateContextMenu":
			var searchTerms = message.searchTerms;
			
			if (searchTerms === '') break;
			
			if (searchTerms.length > 18) 
				searchTerms = searchTerms.substring(0,15) + "...";
			
			let hotkey = ''; 
			if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';

			browser.contextMenus.update("search_engine_menu", {title: hotkey + browser.i18n.getMessage("SearchFor").replace("%1", searchTerms)});
			break;
			
		case "addSearchEngine":
			let url = message.url;
			window.external.AddSearchProvider(url);
			break;
		
		case "addContextSearchEngine":
		
			let se = message.searchEngine;
			
			console.log(se);
			
			let index = userOptions.searchEngines.findIndex( se2 => se.title === se2.title );
			
			if (index !== -1) {
				sendResponse({errorMessage: 'Name must be unique. Search engine already exists'});
				return;
			}
			
			se.id = gen();

			userOptions.searchEngines.push(se);
			userOptions.nodeTree.children.push({
				type: "searchEngine",
				title: se.title,
				id: se.id,
				hidden: false
			});

			browser.storage.local.set({"userOptions": userOptions}).then(() => {
				notify({action: "updateUserOptions"});
			});
			
			break;
			
		case "removeContextSearchEngine":

			if ( !message.id ) return;

			index = userOptions.searchEngines.findIndex( se => se.id === message.id );
			
			if (index === -1) {
				console.log('index not found');
				return;
			}
			
			userOptions.searchEngines.splice(index, 1);
	
			browser.storage.local.set({"userOptions": userOptions}).then(() => {
				notify({action: "updateUserOptions"});
			});
			
			break;
			
		case "testSearchEngine":
			
			openSearch({
				searchTerms: message.searchTerms,
				tab: sender.tab,
				temporarySearchEngine: message.tempSearchEngine
			});

			break;
			
		case "enableAddCustomSearchMenu":

			if (!userOptions.contextMenuShowAddCustomSearch) return;

			browser.contextMenus.create({
				id: "add_engine",
				title: browser.i18n.getMessage("AddCustomSearch"),
				contexts: ["editable"]
			});

			break;
			
		case "enableAddCustomSearchMenu":
			browser.contextMenus.remove("add_engine");
			break;
			
		case "log":
			console.log(message.msg);
			break;
			
		case "focusSearchBar":
			browser.tabs.sendMessage(sender.tab.id, message);
			break;
			
		case "setLastSearch":
			sessionStorage.setItem("lastSearch", message.lastSearch);
			break;
			
		case "getLastSearch":
			return Promise.resolve({lastSearch: sessionStorage.getItem("lastSearch")});
			break;
			
		case "getCurrentTheme":
			browser.theme.getCurrent().then((theme) => {
				console.log(theme);
			});
			break;
			
		case "executeTestSearch":
		
			var searchTerms = encodeURIComponent(message.searchTerms);
			var timeout = Date.now();

			let urlCheckInterval = setInterval( () => {
				browser.tabs.get(sender.tab.id).then( (tabInfo) => {
					
					if (tabInfo.status !== 'complete') return;

					if (tabInfo.url.indexOf(searchTerms) !== -1) {
						
						let newUrl = tabInfo.url.replace(searchTerms, "{searchTerms}");
						
						let se = message.badSearchEngine;
						
						se.template = se.query_string = newUrl;

						browser.tabs.sendMessage(tabInfo.id, {action: "openCustomSearch", searchEngine: se}, {frameId: 0});
						
						clearInterval(urlCheckInterval);
						
					}
					
					// No recognizable GET url. Prompt for advanced options
					if (Date.now() - timeout > 5000) {

						console.log('urlCheckInterval timed out');
						browser.tabs.sendMessage(tabInfo.id, {action: "openCustomSearch", timeout: true}, {frameId: 0});
						clearInterval(urlCheckInterval);
					}

				});
			}, 1000);
			
			return true;
			
			break;
			
		case "copy":
			let input = document.createElement('input');
			input.type = "text";
			input.value = message.msg;
			document.body.appendChild(input);

			input.select();

			document.execCommand("copy");
			break;
			
		case "hasBrowserSearch":
			return Promise.resolve(typeof browser.search !== undefined);
			break;
			
		case "checkForOneClickEngines":	
			return checkForOneClickEngines();
			break;

		// case "openSidebar":
			// browser.sidebarAction.open();
			// break;			

	}
}

function loadUserOptions() {
	
	function onGot(result) {
		
		// no results found, use defaults
		if ( !result.userOptions ) {
			userOptions = Object.assign({}, defaultUserOptions);
			return false;
		}
		
		// Update default values instead of replacing with object of potentially undefined values
		for (let key in defaultUserOptions) {
			userOptions[key] = (result.userOptions[key] !== undefined) ? result.userOptions[key] : defaultUserOptions[key];
		}
		
		return true;

	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	var getting = browser.storage.local.get("userOptions");
	return getting.then(onGot, onError).then(buildContextMenu);
}

function buildContextMenu() {
	browser.contextMenus.removeAll().then( () => {

		if (!userOptions.contextMenu) return false;
		
		let hotkey = ''; 
		if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';

		browser.contextMenus.create({
			id: "search_engine_menu",
			title: (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + browser.i18n.getMessage("SearchWith"),
			contexts: ["selection", "link", "image"]
		});

		let root = userOptions.nodeTree;

		if (!root.children) return;
	
		let id = 0;
		delete root.id;
		
		function onCreated() {

			if (browser.runtime.lastError) {
				console.log(browser.runtime.lastError);
			}
		}
		
		function traverse(node, parentId) {
			
			if (node.hidden) return;

			if ( node.type === 'searchEngine' ) {

				let se = userOptions.searchEngines.find(se => se.id === node.id);
				
				if (!se) {
					console.log('no search engine found for ' + node.id);
					return;
				}

				let createOptions = {
					parentId: parentId,
					title: se.title,
					id: se.id,
					contexts: ["selection", "link", "image"]	
				}

				if (isFirefox) {
					createOptions.icons = {
						"16": se.icon_base64String || se.icon_url || "/icons/icon48.png",
						"32": se.icon_base64String || se.icon_url || "/icons/icon48.png"
					}
				}

				browser.contextMenus.create( createOptions, onCreated);
			}
			
			if (node.type === 'bookmarklet') {
				let createOptions = {
					parentId: parentId,
					title: node.title,
					id: node.id,
					contexts: ["selection", "link", "image"]	
				}
				
				if (isFirefox) {
					createOptions.icons = {
						"16": browser.runtime.getURL("/icons/code.png"),
						"32": browser.runtime.getURL("/icons/code.png")
					}
				}

				browser.contextMenus.create( createOptions, onCreated);
			}
			
			if (node.type === 'oneClickSearchEngine') {
				let createOptions = {
					parentId: parentId,
					title: node.title,
					id: "__oneClickSearchEngine__" + node.id,
					contexts: ["selection", "link", "image"]	
				}
				
				if (isFirefox) {
					createOptions.icons = {
						"16": node.icon,
						"32": node.icon
					}
				}

				browser.contextMenus.create( createOptions, onCreated);
			}
			
			if (node.type === 'separator' /* firefox */) {
				browser.contextMenus.create({
					parentId: parentId,
					type: "separator"
				});
			}
			
			if ( node.type === 'folder' ) {
				
				let createOptions = {
					parentId: parentId,
					id: "folder" + ++id,
					title: node.title,
					contexts: ["selection", "link", "image"]
				}
				
				if (isFirefox ) {
					createOptions.icons = {
						"16": "/icons/folder.png",
						"32": "/icons/folder.png"
					}
				}

				browser.contextMenus.create( createOptions, onCreated );
				
				for (let child of node.children) {
					traverse(child, createOptions.id);
				}
			}
			
		}
		
		for (let child of root.children) {
			traverse(child, "search_engine_menu");
		}

	});
}

browser.contextMenus.onClicked.addListener(contextMenuSearch);

function executeBookmarklet(info) {
	
	if (!browser.bookmarks) {
		console.error('No bookmarks permission');
		return;
	}
	// run as bookmarklet
	browser.bookmarks.get(info.menuItemId).then((bookmark) => {
		bookmark = bookmark.shift();
		
		if (bookmark.url.match(/^javascript/) === null) {
			console.error('bookmark not a bookmarklet');
			return false;
		}

		browser.tabs.query({currentWindow: true, active: true}).then( (tabs) => {
			let code = decodeURI(bookmark.url);
//			console.log("Executing bookmarklet code -> " + code);
			browser.tabs.executeScript(tabs[0].id, {
				code: code
			});
		});

	}, (error) => {
		console.error(error);
	});
}

function executeOneClickSearch(info) {
	console.log('one click search');
	
	let searchTerms = info.selectionText;
	let openMethod = info.openMethod;
		
	let engineId = info.menuItemId.replace("__oneClickSearchEngine__", "");
	let engineName = findNodes( userOptions.nodeTree, node => node.id === engineId )[0].title;
	
	switch (openMethod) {
		case "openCurrentTab":
			browser.search.search({
				query: searchTerms,
				engine: engineName
			});	
			break;
		case "openNewTab":
			browser.tabs.create({
				active: true
			}).then( (tab) => {
				browser.search.search({
					query: searchTerms,
					engine: engineName,
					tabId: tab.id
				});	
			});
			break;
		case "openNewWindow":
			browser.windows.create({
				incognito: false
			}).then( (tab) => {
				
				// if new window
				if (tab.tabs) tab = tab.tabs[0];
				
				browser.search.search({
					query: searchTerms,
					engine: engineName,
					tabId: tab.id
				});	
			});
			break;
		case "openNewIncognitoWindow":
			browser.windows.create({
				incognito: true
			}).then( (tab) => {
				
				// if new window
				if (tab.tabs) tab = tab.tabs[0];
				
				browser.search.search({
					query: searchTerms,
					engine: engineName,
					tabId: tab.id
				});	
			});
			break;
		case "openBackgroundTab":
			browser.tabs.create({
				active: false
			}).then( (tab) => {
				browser.search.search({
					query: searchTerms,
					engine: engineName,
					tabId: tab.id
				});	
			});
			break;
	}

}

function contextMenuSearch(info, tab) {

	if (info.menuItemId === 'showSuggestions') {
		userOptions.searchBarSuggestions = info.checked;
		browser.storage.local.set({"userOptions": userOptions});
		notify({action: "updateUserOptions"});

		return;
	}
	
	if (info.menuItemId === 'clearHistory') {
		userOptions.searchBarHistory = [];
		browser.storage.local.set({"userOptions": userOptions});
		notify({action: "updateUserOptions"});
		
		return;
	}
	
	// clicked Add Custom Search
	if (info.menuItemId === 'add_engine') {
		browser.tabs.sendMessage(tab.id, {action: "openCustomSearch"}, {frameId: 0});		
		return false;
	}
	
	// if searchEngines is empty, open Options
	if (userOptions.searchEngines.length === 0) {	
		browser.runtime.openOptionsPage();
		return false;	
	}
	
	// get modifier keys
	let openMethod;
	if ( info.modifiers && info.modifiers.includes("Shift") )
		openMethod = userOptions.contextMenuShift;
	else if ( info.modifiers && info.modifiers.includes("Ctrl") )
		openMethod = userOptions.contextMenuCtrl;
	else
		openMethod = userOptions.contextMenuClick;
	
	var searchTerms;
	if (!info.selectionText && info.srcUrl)
		searchTerms = info.srcUrl
	else
		searchTerms = (info.linkUrl && !info.selectionText) ? info.linkUrl : info.selectionText.trim();
	
	if (typeof info.menuItemId === 'string' && info.menuItemId.match(/^__oneClickSearchEngine__/) ) {
		info.selectionText = searchTerms;
		info.openMethod = openMethod;
		executeOneClickSearch(info);
		return false;
	}
	
	// run as bookmarklet
	if (browser.bookmarks !== undefined && !userOptions.searchEngines.find( se => se.id === info.menuItemId ) ) {
		executeBookmarklet(info);
		return false;
	}

	openSearch({
		searchEngineId: info.menuItemId, 
		searchTerms: searchTerms,
		openMethod: openMethod, 
		tab: tab
	});
}

function quickMenuSearch(info, tab) {
	
	// run as one-click search
	if (typeof info.menuItemId === 'string' && info.menuItemId.match(/^__oneClickSearchEngine__/) ) {
		executeOneClickSearch(info);
		return false;
	}
	
	// run as bookmarklet
	if (browser.bookmarks !== undefined && !userOptions.searchEngines.find( se => se.id === info.menuItemId ) && !info.openUrl ) {
		executeBookmarklet(info);
		return Promise.resolve(false);
	}
	
	return openSearch({
		searchEngineId: info.menuItemId, 
		searchTerms: info.selectionText,
		openMethod: info.openMethod, 
		tab: tab,
		openUrl: info.openUrl || null,
		folder: info.folder
	});
}

function openSearch(details) {

	var searchEngineId = details.searchEngineId || null;
	var searchTerms = details.searchTerms.trim();
	var openMethod = details.openMethod || "openNewTab";
	var tab = details.tab || null;
	var openUrl = details.openUrl || false;
	var temporarySearchEngine = details.temporarySearchEngine || null; // unused now | intended to remove temp engine

	if (
		searchEngineId === null //||
//		!searchTerms ||
//		tab === null
	) return false;

	if (!tab) {
		tab = {
			url:"",
			id:0
		}
	}
	
	var se;
	
	if (!openUrl) {

		// if temp engine exists, use that
		se = temporarySearchEngine || userOptions.searchEngines.find(se => se.id === searchEngineId);

		// must be invalid
		if (!se.query_string) return false;
		
		// legacy fix
		se.queryCharset = se.queryCharset || "UTF-8";
		
		if (se.searchRegex && !openUrl) {
			try {
				let parts = JSON.parse('[' + se.searchRegex + ']');
				let _find = new RegExp(parts[0], 'g');
				let _replace = parts[1];
				let newSearchTerms = searchTerms.replace(_find, _replace);
				
				console.log(searchTerms + " -> " + newSearchTerms);
				searchTerms = newSearchTerms;
			} catch (error) {
				console.error("regex replace failed");
			}
		}
		
		var encodedSearchTermsObject = encodeCharset(searchTerms, se.queryCharset);
		var q = replaceOpenSearchParams(se.query_string, encodedSearchTermsObject.uri, tab.url);
		
		// set landing page for POST engines
		if ( 
			!searchTerms || // empty searches should go to the landing page also
			(typeof se.method !== 'undefined' && se.method === "POST") // post searches should go to the lander page
		) {
			
			if ( se.searchForm )
				q = se.searchForm;
			else {
				let url = new URL(se.template);
				q = url.origin + url.pathname;
			}
			
		}
	}
	
	
	// if using Open As Link from quick menu
	if (openUrl) {
		q = searchTerms;
		if (searchTerms.match(/^.*:\/\//) === null)
			q = "http://" + searchTerms;
	}

//	console.log("openSearch url -> " + q);

	switch (openMethod) {
		case "openCurrentTab":
			return openCurrentTab();
			break;
		case "openNewTab":
			return openNewTab();
			break;
		case "openNewWindow":
			return openNewWindow();
			break;
		case "openNewIncognitoWindow":
			return openNewWindow(true);
			break;
		case "openBackgroundTab":
			return openBackgroundTab();
			break;
		// case "openSidebar":
			// console.log('sidebar');
			// console.log(q);
			
			// browser.sidebarAction.setPanel( {
				// panel: ""
			// }).then(() => {
				// browser.sidebarAction.setPanel( {
					// panel: q
				// }).then(onCreate(tab));
			// });
			// break;
		
	}
	
	function onCreate(_tab) {

		// code for POST engines
		if (typeof se.method === 'undefined' || se.method !== "POST") return _tab;

		// searches without terms should stay here
		if (!searchTerms) return _tab;
		
		function escapeDoubleQuotes(str) {
			return str.replace(/\\([\s\S])|(")/g,"\\$1$2");
		}
				
		// if new window
		if (_tab.tabs) _tab = _tab.tabs[0];

		browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabInfo) {
	
			// new windows open to about:blank and throw extra complete event
		//	if (tabInfo.url === "about:blank") return;
		//	if (tabInfo.url !== q) return;	
		
			// new method for working from current tab
			let landing_url = new URL(q);
			let current_url = new URL(tabInfo.url);
			
			if (current_url.hostname !== landing_url.hostname) return;

			browser.tabs.onUpdated.removeListener(listener);

			browser.tabs.executeScript(_tab.id, {
				code: 'var _ID="' + searchEngineId + '", _SEARCHTERMS="' + /*encodedSearchTermsObject.ascii */ escapeDoubleQuotes(searchTerms) + '"' + ((temporarySearchEngine) ? ', CONTEXTSEARCH_TEMP_ENGINE=' + JSON.stringify(temporarySearchEngine) : ""), 
				runAt: 'document_start'
			}).then(() => {
			return browser.tabs.executeScript(_tab.id, {
				file: '/opensearch.js',
				runAt: 'document_start'
			}).then(() => {
			return browser.tabs.executeScript(_tab.id, {
				file: '/execute.js',
				runAt: 'document_start'
			});});});

		});

		return _tab;
	}
	
	function onError() {
		console.log(`Error: ${error}`);
	}
			
	function openCurrentTab() {
		
		var creating = browser.tabs.update({
			url: q,
			openerTabId: tab.id
		});
		return creating.then(onCreate, onError);
	} 
	function openNewWindow(incognito) {	// open in new window

		var creating = browser.windows.create({
			url: q,
			incognito: incognito || false
		});
		return creating.then(onCreate, onError);
	} 
	function openNewTab(inBackground) {	// open in new tab
	
		inBackground = inBackground || false;
		
		var creating = browser.tabs.create({
			url: q,
			active: !inBackground,
			openerTabId: details.folder ? null : (tab.id || null)
		});
		return creating.then(onCreate, onError);

	}	
	function openBackgroundTab() {
		return openNewTab(true)
	}
}

function getAllOpenTabs() {
	
	function onGot(tabs) {
		return tabs;
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var querying = browser.tabs.query({});
	return querying.then(onGot, onError);
}

function encodeCharset(string, encoding) {

	try {
		
		if (encoding.toLowerCase() === 'utf-8') 
			return {ascii: string, uri: encodeURIComponent(string)};
		
		let uint8array = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true }).encode(string);
		let uri_string = "", ascii_string = "";
		
		for (let uint8 of uint8array) {
			let c = String.fromCharCode(uint8);
			ascii_string += c;
			uri_string += (c.match(/[a-zA-Z0-9\-_.!~*'()]/) !== null) ? c : "%" + uint8.toString(16).toUpperCase();
		}

		return {ascii: ascii_string, uri: uri_string};
	} catch (error) {
		console.log(error.message);
		return {ascii: string, uri: string};
	}
}

function updateUserOptionsVersion(uo) {

	// v1.1.0 to v 1.2.0
	return browser.storage.local.get("searchEngines").then((result) => {
		if (typeof result.searchEngines !== 'undefined') {
			console.log("-> 1.2.0");
			uo.searchEngines = result.searchEngines || uo.searchEngines;
			browser.storage.local.remove("searchEngines");
		}
		
		return uo;
	}).then((_uo) => {
	
		// v1.2.4 to v1.2.5
		if (_uo.backgroundTabs !== undefined && _uo.swapKeys !== undefined) {
			
			console.log("-> 1.2.5");
			
			if (_uo.backgroundTabs) {
				_uo.contextMenuClick = "openBackgroundTab";
				_uo.quickMenuLeftClick = "openBackgroundTab";
			}
			
			if (_uo.swapKeys) {
				_uo.contextShift = [_uo.contextCtrl, _uo.contextCtrl = _uo.contextShift][0];
				_uo.quickMenuShift = [_uo.quickMenuCtrl, _uo.quickMenuCtrl = _uo.quickMenuShift][0];
			}
			
			delete _uo.backgroundTabs;
			delete _uo.swapKeys;
			
		}
		
		return _uo;
		
	}).then((_uo) => {
	
		//v1.5.8
		if (_uo.quickMenuOnClick !== undefined) {
			
			console.log("-> 1.5.8");
			
			if (_uo.quickMenuOnClick)
				_uo.quickMenuOnMouseMethod = 'click';
			
			if (_uo.quickMenuOnMouse)
				_uo.quickMenuOnMouseMethod = 'hold';
			
			if (_uo.quickMenuOnClick || _uo.quickMenuOnMouse)
				_uo.quickMenuOnMouse = true;
			
			delete _uo.quickMenuOnClick;
		}
		
		return _uo;

	}).then((_uo) => {
		
		if (browser.bookmarks === undefined) return _uo;

		if (browser.i18n.getMessage("ContextSearchMenu") === "ContextSearch Menu") return _uo;
		
		console.log("-> 1.6.0");
		
		browser.bookmarks.search({title: "ContextSearch Menu"}).then((bookmarks) => {

			if (bookmarks.length === 0) return _uo;

			console.log('New locale string for bookmark name. Attempting to rename');
			return browser.bookmarks.update(bookmarks[0].id, {title: browser.i18n.getMessage("ContextSearchMenu")}).then(() => {
				console.log(bookmarks[0]);
			}, (error) => {
				console.log(`An error: ${error}`);
			});

		});
		
		return _uo;
	}).then((_uo) => {

		// version met
		if (_uo.nodeTree.children) return _uo;
	
		console.log("-> 1.8.0");
	
		function buildTreeFromSearchEngines() {
			let root = {
				title: "/",
				type: "folder",
				children: [],
				hidden: false
			}

			for (let se of _uo.searchEngines) {
				root.children.push({
					type: "searchEngine",
					title: se.title,
					hidden: se.hidden || false,
					id: se.id
				});
			}
			
			return root;
		}

		// convert items to rows
		let toolCount = _uo.quickMenuTools.filter( tool => !tool.disabled ).length;
		
		// any position but top is safe to ignore
		if (_uo.quickMenuToolsPosition === 'hidden')
			toolCount = 0;
		
		let totalTiles = toolCount + _uo.quickMenuItems;
		
		let rows = Math.ceil(totalTiles / _uo.quickMenuColumns);
		
		if ( _uo.quickMenuUseOldStyle )
			rows = totalTiles;

		_uo.quickMenuRows = rows;

		// generate unique id for each search engine
		for (let se of _uo.searchEngines)
			se.id = gen();

		// neither menu uses bookmarks, build from search engine list
		if (!_uo.quickMenuBookmarks && !_uo.contextMenuBookmarks) {
			let root = buildTreeFromSearchEngines();
			_uo.nodeTree = root;
			return _uo;
		}  	
		
		// both menus use bookmarks, build from bookmarks
		else if (_uo.quickMenuBookmarks && _uo.contextMenuBookmarks) {
			return CSBookmarks.treeToFolders().then( root => {
				_uo.nodeTree = root;
				return _uo;
			});
		}

		else {

			return CSBookmarks.treeToFolders().then( (bmTree) => {
				let seTree = buildTreeFromSearchEngines();

				if (_uo.quickMenuBookmarks) {
					console.log("BM tree + SE tree");
					bmTree.children = bmTree.children.concat({type:"separator"}, seTree.children);

					_uo.nodeTree = bmTree;
					
				} else {
					console.log("SE tree + BM tree");
					seTree.children = seTree.children.concat({type:"separator"}, bmTree.children);

					_uo.nodeTree = seTree;
				}
				
				return _uo;

			});
				
		}

	}).then((_uo) => {
		
		if (!_uo.searchEngines.find(se => se.hotkey) ) return _uo;
		
		console.log("-> 1.8.2");
		
		_uo.searchEngines.forEach( se => {
			if (se.hotkey) {
				let nodes = findNodes(_uo.nodeTree, node => node.id === se.id);
				nodes.forEach(node => {
					node.hotkey = se.hotkey;
				});
				
				delete se.hotkey;
			}
		});
		
		return _uo;
		
	}).then((_uo) => {	
		console.log('done');
		return _uo;
	});
}

const defaultUserOptions = {
	searchEngines: defaultEngines || [],
	nodeTree: {},
	hiddenEngines: "",
	quickMenu: true,
	quickMenuColumns: 5,
	quickMenuRows: 5,
	quickMenuItems: 100,
	quickMenuKey: 0,
	quickMenuOnKey: false,
	quickMenuOnHotkey: false,
	quickMenuHotkey: [17, 18, 81],
	quickMenuOnMouse: true,
	quickMenuSearchOnMouseUp: false,
	quickMenuOnMouseMethod: "hold",
	quickMenuMouseButton: 3,
	quickMenuAuto: false,
	quickMenuAutoOnInputs: true,
	quickMenuScale: 1,
	quickMenuIconScale: 1,
	quickMenuScaleOnZoom: true,
	quickMenuPosition: "bottom center",
	quickMenuOffset: {x:0, y:20},
	quickMenuCloseOnScroll: false,
	quickMenuCloseOnClick: true,
	quickMenuTrackingProtection: true,
	quickMenuSearchBar: "bottom",
	quickMenuSearchBarFocus: false,
	quickMenuSearchBarSelect: true,
	quickMenuUseOldStyle: false,
	contextMenu: true,
	contextMenuKey: 0,
	contextMenuShowAddCustomSearch: true,
	contextMenuBookmarks: false,
	quickMenuBookmarks: false,
	quickMenuTools: [
		{name: 'disable', 	disabled: false},
		{name: 'close', 	disabled: false},
		{name: 'copy', 		disabled: false},
		{name: 'link', 		disabled: false},
		{name: 'lock',		disabled: false}
	],
	quickMenuToolsPosition: "top",
	searchJsonPath: "",
	reloadMethod: "",
	contextMenuClick: "openNewTab",
	contextMenuShift: "openNewWindow",
	contextMenuCtrl: "openBackgroundTab",
	quickMenuLeftClick: "openNewTab",
	quickMenuRightClick: "openCurrentTab",
	quickMenuMiddleClick: "openBackgroundTab",
	quickMenuShift: "openNewWindow",
	quickMenuCtrl: "openBackgroundTab",
	quickMenuAlt: "keepMenuOpen",
	quickMenuFolderLeftClick: "openFolder",
	quickMenuFolderRightClick: "noAction",
	quickMenuFolderMiddleClick: "openBackgroundTab",
	quickMenuFolderShift: "openNewWindow",
	quickMenuFolderCtrl: "noAction",
	quickMenuFolderAlt: "noAction",
	quickMenuSearchHotkeys: "noAction",
	searchBarSuggestions: true,
	searchBarEnableHistory: true,
	searchBarHistory: [],
	searchBarUseOldStyle: false,
	searchBarColumns: 5,
	searchBarCloseAfterSearch: true,
	sideBar: {
		enabled: true,
		hotkey: [],
		widget: {
			enabled: false,
			position: "right",
			offset: 100
		}	
	}
};

var userOptions = {};

loadUserOptions().then( checkForOneClickEngines );

function checkForOneClickEngines() {

	// not FF 63+
	if ( !browser.search ) return Promise.resolve(-1);
	
	// don't add before nodeTree is populated
	if ( userOptions.nodeTree === {} ) {
		console.log('empty nodeTree - aborting one-click check');
		return Promise.resolve(-1);
	}

	return browser.search.get().then( engines => {

		let newEngineCount = 0;
		engines.forEach( engine => {
			if ( findNodes(userOptions.nodeTree, node => node.title === engine.name && ( node.type === "searchEngine" || node.type === "oneClickSearchEngine") ).length === 0 ) {

				let node = {
					type: "oneClickSearchEngine",
					title: engine.name,
					icon: engine.favIconUrl || browser.runtime.getURL('icons/search.png'),
					hidden: false,
					id: gen()
				}

				console.log('adding One-Click engine ' + engine.name);
				userOptions.nodeTree.children.push(node);
				
				newEngineCount++;
			}
		});
		
		return newEngineCount;
	});
}

browser.runtime.onMessage.addListener(notify);

// establish native listener
browser.tabs.onActivated.addListener((tab) => {
	if (userOptions.reloadMethod !== 'automatic') return false;
	
	notify({action:"nativeAppRequest"});
});

browser.runtime.onInstalled.addListener((details) => {

	// Show new features page
	if (
		(
			details.reason === 'update' 
			&& details.previousVersion < "1.8.1"
		)
//		|| details.temporary
	) {
		browser.tabs.create({
			url: "/update/update.html"
		});
	}

	let loadUserOptionsInterval = setInterval(() => {
		if (userOptions === {}) return;
		
		console.log("userOptions loaded. Updating objects");
		
		updateUserOptionsVersion(userOptions).then((_uo) => {
			userOptions = _uo;
			browser.storage.local.set({"userOptions": userOptions});
			buildContextMenu();
		});
		clearInterval(loadUserOptionsInterval);
		
		// Show install page
		// if ( 
			// details.reason === 'install' 
		// ) {
			// browser.tabs.create({
				// url: "/options.html?tab=help"
			// });
		// }
		
		if ( 
			details.temporary 
		) {
			
		}
	}, 250);
	
});

//browser.browserAction.setPopup({popup: "/options.html#browser_action"});
browser.browserAction.setPopup({popup: "/searchbar.html"});
browser.browserAction.onClicked.addListener(() => {	
	browser.browserAction.openPopup();
});

if (browser.pageAction) {
	/*
	Initialize the page action: set icon and title, then show.
	Only operates on tabs whose URL's protocol is applicable.
	*/
	function initializePageAction(tab) {
		
		browser.pageAction.hide(tab.id);
		
		var anchor = document.createElement('a');
		anchor.href = tab.url;
		
		if ( ! ['http:', 'https:'].includes(anchor.protocol)) return false;

		browser.tabs.executeScript( tab.id, {
			code: "document.querySelector('link[type=\"application/opensearchdescription+xml\"]').href;",
			runAt: "document_end"
		}).then( (result) => {

			result = result.shift();

			if (result) {
				browser.pageAction.setIcon({tabId: tab.id, path: "icons/add_search.png"});
				browser.pageAction.setTitle({tabId: tab.id, title: browser.i18n.getMessage("AddCustomSearch")});
				browser.pageAction.show(tab.id);
			} 
				
		});

	}

	/*
	When first loaded, initialize the page action for all tabs.
	*/
	var gettingAllTabs = browser.tabs.query({});
	gettingAllTabs.then((tabs) => {
		for (let tab of tabs) {
			initializePageAction(tab);
		}
	});

	/*
	Each time a tab is updated, reset the page action for that tab.
	*/
	browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
		if (changeInfo.status !== 'complete') return;
		initializePageAction(tab);
	});

	browser.pageAction.onClicked.addListener((tab) => {
		
		browser.tabs.sendMessage(tab.id, {
			action: "openCustomSearch",
			useOpenSearch: true
		}, {frameId: 0});

	});
}