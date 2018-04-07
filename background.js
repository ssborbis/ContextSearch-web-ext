function notify(message, sender, sendResponse) {
		
	switch(message.action) {
		case "saveUserOptions":
			browser.storage.local.set({"userOptions": message.userOptions});
			break;
			
		case "updateUserOptions":
			loadUserOptions().then(() => {
				getAllOpenTabs().then((tabs) => {
					for (let tab of tabs)
						// 1.3.7+ only send sanitized userOptions to tabs
						browser.tabs.sendMessage(tab.id, {"userOptions": userOptions});	
				});
			});
			break;
			
		case "nativeAppRequest":
			nativeApp( message.force || false );
			break;
			
		case "openOptions":
			browser.tabs.create({
				url: browser.runtime.getURL("/options.html" + (message.hashurl || "")) 
			});
			
			break;
			
		case "quickMenuSearch":
			quickMenuSearch(message.info, sender.tab);
			break;
			
		case "enableContextMenu":
			userOptions.contextMenu = true;
			buildContextMenu();
			break;
			
		case "getUserOptions":
		
			// ignore the load to keep tempSearchEngines for POST test
			if ( !message.noLoad ) loadUserOptions();
			
			sendResponse({"userOptions": userOptions});
			break;
			
		case "getSearchEngineByIndex":
		
			if ( !message.index ) return;
			if ( !message.noLoad ) loadUserOptions();
			
			sendResponse({"searchEngine": userOptions.searchEngines[message.index]});
			break;

		case "openQuickMenu":
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "closeQuickMenuRequest":
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
		
		case "quickMenuIframeLoaded":
			
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
		
		case "updateQuickMenuObject":
			// send to all frames for bi-directional updates to/from quickmenu IFRAME v1.3.8+
			browser.tabs.sendMessage(sender.tab.id, message); 
			break;
			
		case "closeWindowRequest":
			browser.windows.remove(sender.tab.windowId);
			break;
		
		case "updateSearchTerms":
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "updateContextMenu":
			let searchTerms = message.searchTerms;
			
			if (searchTerms === '') break;
			if (searchTerms.length > 18) 
				searchTerms = searchTerms.substring(0,15) + "...";
			browser.contextMenus.update("search_engine_menu", {title: "Search for \"" + searchTerms + "\""});
			break;
			
		case "addSearchEngine":
			let url = message.url;
			window.external.AddSearchProvider(url);
			break;
		
		case "addCustomSearchEngine":
			let se = message.searchEngine;
			
			for (let se2 of userOptions.searchEngines) {
				if (se2.title == se.title) {
					sendResponse({errorMessage: 'Name must be unique. Search engine "' + se2.title + '" already exists'});
					break;
				}
			}
			userOptions.searchEngines.push(se);

			browser.storage.local.set({"userOptions": userOptions}).then(() => {
				notify({action: "updateUserOptions"});
			});
			
			break;
			
		case "testSearchEngine":
			let tempSearchEngine = message.tempSearchEngine;
			userOptions.searchEngines.push(tempSearchEngine);
			
			openSearch({
				searchEngineIndex: userOptions.searchEngines.length - 1,
				searchTerms: message.searchTerms,
				tab: sender.tab,
				temporarySearchEngine: true
			});

			break;
			
		case "enableAddCustomSearch":

			if (!userOptions.contextMenuShowAddCustomSearch) return;
			
			console.log('enabling custom search menu item');
				
			browser.contextMenus.create({
				id: "add_engine",
				title: "Add Custom Search",
				contexts: ["editable"]
			});
			
			// Delaying the removal should keep the menu item visible long enough to open the context menu
			setTimeout(() => {
				browser.contextMenus.remove("add_engine");
			}, 1000);

			break;

		
	}
}

function loadUserOptions() {
	
	function onGot(result) {
		if ( !result.userOptions ) return false;
		// Update default values instead of replacing with object of potentially undefined values
		for (let key in result.userOptions) {
			userOptions[key] = (result.userOptions[key] !== undefined) ? result.userOptions[key] : userOptions[key];
		}

	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	var getting = browser.storage.local.get("userOptions");
	return getting.then(onGot, onError).then(buildContextMenu);
}

function buildContextMenu(disableAddCustomSearch) {

	browser.contextMenus.removeAll();

	if (!userOptions.contextMenu) {
		console.log('Context menu is disabled');
		return false;
	}	

	browser.contextMenus.create({
		id: "search_engine_menu",
		title: (userOptions.searchEngines.length === 0) ? "+ Add search engines" : "Search with",
		contexts: ["selection", "link"]
	});

	for (var i=0;i<userOptions.searchEngines.length;i++) {
		
		let se = userOptions.searchEngines[i];
		if (se.hidden) continue;
		browser.contextMenus.create({
			parentId: "search_engine_menu",
			id: i.toString(),
			title: se.title,
			contexts: ["selection", "link"],
			icons: {
				"16": se.icon_base64String || se.icon_url || "/icons/icon48.png",
				"32": se.icon_base64String || se.icon_url || "/icons/icon48.png"
			}
		});
	}	
}

browser.contextMenus.onClicked.addListener(contextMenuSearch);

function contextMenuSearch(info, tab) {
	
	// clicked Add Custom Search
	if (info.menuItemId === 'add_engine') {
			
		// inject script to retrieve search form features ...
		browser.tabs.executeScript(tab.id, { 
			file: '/getform.js'
		}).then( (data) => {
			
			console.log(data);
			
			// unpack json data ... 
			data = data.shift();

			// add favicon ...
			data.icon = tab.favIconUrl;

			// no description ? use tab title ...
			if ( !data.description ) data.description = tab.title;
			
			browser.tabs.sendMessage(tab.id, {action: "openSearchPopup", data: data}, {frameId: 0});
		}).catch( error =>{
			console.error(error);
		});
		
		return false;
	}
	
	// if searchEngines is empty, open Options
	if (userOptions.searchEngines.length === 0) {	
		browser.runtime.openOptionsPage();
		return false;	
	}
	
	var searchTerms = (info.linkUrl && !info.selectionText) ? info.linkUrl : info.selectionText.trim();
	
	// get modifier keys
	if ( info.modifiers.includes("Shift") )
		openMethod = userOptions.contextMenuShift;
	else if ( info.modifiers.includes("Ctrl") )
		openMethod = userOptions.contextMenuCtrl;
	else
		openMethod = userOptions.contextMenuClick;
	
	openSearch({
		searchEngineIndex: info.menuItemId, 
		searchTerms: searchTerms,
		openMethod: openMethod, 
		tab: tab
	});
}

function quickMenuSearch(info, tab) {
	openSearch({
		searchEngineIndex: info.menuItemId, 
		searchTerms: info.selectionText,
		openMethod: info.openMethod, 
		tab: tab,
		openUrl: info.openUrl || null
	});
}

function openSearch(details) {
	
	console.log(details);
	
	var searchEngineIndex = details.searchEngineIndex;
	var searchTerms = details.searchTerms;
	var openMethod = details.openMethod || "openNewTab";
	var tab = details.tab || null;
	var openUrl = details.openUrl || false;
	var temporarySearchEngine = details.temporarySearchEngine || null; // unused now | intended to remove temp engine
	
	if (
		searchEngineIndex === null ||
		!searchTerms ||
		tab === null
	) return false;
	
	var se = userOptions.searchEngines[searchEngineIndex];
	
	if (!se.query_string) return false;
	
	// legacy fix
	se.queryCharset = se.queryCharset || "UTF-8";
	
	var encodedSearchTermsObject = encodeCharset(searchTerms, se.queryCharset);
	var q = replaceOpenSearchParams(se.query_string, encodedSearchTermsObject.uri);
	
	// if using Open As Link from quick menu
	if (openUrl) {
		q = searchTerms;
		if (searchTerms.match(/^.*:\/\//) === null)
			q = "http://" + searchTerms;
	}
	
	
	if (typeof se.method !== 'undefined' && se.method === "POST") {
		
		if ( se.searchForm )
			q = se.searchForm;
		else {
			let url = new URL(se.template);
			q = url.origin + url.pathname;
		}
		
	}
	
	console.log(q);
	
	switch (openMethod) {
		case "openCurrentTab":
			openCurrentTab();
			break;
		case "openNewTab":
			openNewTab();
			break;
		case "openNewWindow":
			openNewWindow();
			break;
		case "openNewIncognitoWindow":
			openNewWindow(true);
			break;
		case "openBackgroundTab":
			openBackgroundTab();
			break;
		
	}
	
	function onCreate(_tab) {
		
		// code for POST engines
		if (typeof se.method === 'undefined' || se.method !== "POST") return;
		
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
				code: 'var _INDEX=' + searchEngineIndex + ', _SEARCHTERMS="' + /*encodedSearchTermsObject.ascii */ escapeDoubleQuotes(searchTerms) + '"', 
				runAt: 'document_start'
			}).then(() => {
			browser.tabs.executeScript(_tab.id, {
				file: '/opensearch.js',
				runAt: 'document_start'
			}).then(() => {
			browser.tabs.executeScript(_tab.id, {
				file: '/execute.js',
				runAt: 'document_start'
			});});});

		});
	}
	
	function onError() {
		console.log(`Error: ${error}`);
	}
			
	function openCurrentTab() {
		
		var creating = browser.tabs.update({
			url: q,
			openerTabId: tab.id
		});
		creating.then(onCreate, onError);
	} 
	function openNewWindow(incognito) {	// open in new window

		var creating = browser.windows.create({
			url: q,
			incognito: incognito || false
		});
		creating.then(onCreate, onError);
	} 
	function openNewTab(inBackground) {	// open in new tab
	
		inBackground = inBackground || false;
		
		var creating = browser.tabs.create({
			url: q,
			active: !inBackground,
			openerTabId: tab.id
		});
		creating.then(onCreate, onError);

	}	
	function openBackgroundTab() {
		openNewTab(true)
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

var userOptions = {
	searchEngines: defaultEngines || [],
	hiddenEngines: "",
	quickMenu: false,
	quickMenuColumns: 4,
	quickMenuItems: 100,
	quickMenuKey: 0,
	quickMenuOnKey: false,
	quickMenuOnMouse: true,
	quickMenuOnClick: false,
	quickMenuMouseButton: 3,
	quickMenuAuto: false,
	quickMenuAutoOnInputs: true,
	quickMenuScale: 1,
	quickMenuScaleOnZoom: true,
	quickMenuPosition: "bottom right",
	quickMenuOffset: {x:0, y:0},
	quickMenuCloseOnScroll: false,
	quickMenuCloseOnClick: true,
	quickMenuTrackingProtection: false,
	contextMenu: true,
	contextMenuShowAddCustomSearch: true,
	quickMenuTools: [
		{name: 'disable', 	disabled: false},
		{name: 'close', 	disabled: false},
		{name: 'copy', 		disabled: false},
		{name: 'link', 		disabled: false},
		{name: 'lock',		disabled: false}
	],
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
	quickMenuAlt: "keepMenuOpen"
};

loadUserOptions();

browser.runtime.onMessage.addListener(notify);
browser.runtime.onInstalled.addListener(function updatePage(details) {
	
	// v1.1.0 to v 1.2.0
	browser.storage.local.get("searchEngines").then((result) => {
		if (typeof result.searchEngines !== 'undefined') {
			console.log('found separate searchEngines array in local storage.  Copying to userOptions and removing');
			userOptions.searchEngines = result.searchEngines || userOptions.searchEngines;
			browser.storage.local.remove("searchEngines");
			browser.storage.local.set({"userOptions": userOptions});
		}
	});
	
	// v1.2.4 to v1.2.5
	if (userOptions.backgroundTabs !== undefined && userOptions.swapKeys !== undefined) {
		
		console.log("updating objects to 1.2.5");
		
		if (userOptions.backgroundTabs) {
			userOptions.contextMenuClick = "openBackgroundTab";
			userOptions.quickMenuLeftClick = "openBackgroundTab";
		}
		
		if (userOptions.swapKeys) {
			userOptions.contextShift = [userOptions.contextCtrl, userOptions.contextCtrl = userOptions.contextShift][0];
			userOptions.quickMenuShift = [userOptions.quickMenuCtrl, userOptions.quickMenuCtrl = userOptions.quickMenuShift][0];
		}
		
		delete userOptions.backgroundTabs;
		delete userOptions.swapKeys;
		
		browser.storage.local.set({"userOptions": userOptions});

	}

	// Show new features page
	if (
		(
			details.reason === 'update' 
			&& details.previousVersion < "1.2.8"
		)
//		|| details.temporary
	) {
		browser.tabs.create({
			url: "/update/update.html"
		});
	}
	
	// Show install page
	if ( 
		details.reason === 'install' 
	//	|| details.temporary
	) {
		browser.tabs.create({
			url: "/options.html#searchengines"
		});
	}
	
});

browser.browserAction.setPopup({popup: "/options.html#browser_action"});
browser.browserAction.onClicked.addListener(() => {	
	browser.browserAction.openPopup();
});

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

/*
// inject at tab creation
(() => {

	function handle(tabId, changeInfo) {
		if (
			! userOptions.quickMenu
			|| changeInfo.status !== 'complete'
		) return;
		
		browser.tabs.executeScript(tabId, {
			code: '(typeof userOptions === "undefined");'
		}).then( (result) => {
			result = result.shift();
			if (!result) {
				console.log('quickmenu.js already added');
				return;
			}

			browser.tabs.executeScript(tabId, {	
				allFrames: true,
				file: 'quickmenu.js'
			}).then(() => {
				console.log('Adding quickmenu.js');
			});
		});
	}
	
	browser.tabs.onUpdated.addListener(handle);
})();
/*
function handleRemoved(tabId, removeInfo) {
	
 browser.tabs.get(tabId).then((tab) => {
	 console.log(tab);
 });
  console.log("Tab: " + tabId + " is closing");
  console.log("Window ID: " + removeInfo.windowId);
  console.log("Window is closing: " + removeInfo.isWindowClosing);  
  console.log(removeInfo);
}

browser.tabs.onRemoved.addListener(handleRemoved);

function handleCreated(tab) {
  console.log(tab);
}

browser.tabs.onCreated.addListener(handleCreated);
*/
/*

Maybe in FF 60+
browser.contexMenus.onShown.addListener(async function(info, tab) {
	console.log('onShown');
	if (!info.selectionText) return;
	console.log('has selected text');
	browser.menus.remove("add_engine");
	// Note: Not waiting for returned promise.
	browser.menus.refresh();
  
  
});

/*
console.log(encodeCharset("blahbla blah blah & blah", 'utf-8'));
console.log(encodeCharset("ツ 日本語用コンテ blah blah", 'euc-jp'));
console.log(encodeCharset("try this", 'windows-1251'));
console.log(encodeCharset('一般来说，URL只能使用英文字母、阿拉伯数字和某些标点符号，不能使用其他文字和符号。比如，世界上有英文字母的网址"http://www.abc.com"，但是没有希腊字母的网址"http://www.aβγ.com"（读作阿尔法-贝塔-伽玛.com）。这是因为网络标准RFC 1738做了硬性规定', 'GB2312'));
//'euc-jp' ядрами и графическое
*/
