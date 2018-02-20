function notify(message, sender, sendResponse) {
	
	switch(message.action) {
		
		case "updateUserOptions":
			loadUserOptions(() => {
				getAllOpenTabs((tabs) => {
					for (let tab of tabs)
						browser.tabs.sendMessage(tab.id, {"userOptions": userOptions});	
				});
			});
			break;
			
		case "nativeAppRequest":
			nativeApp();
			break;
			
		case "openOptions":
		//	browser.runtime.openOptionsPage();
			var creating = browser.tabs.create({
				url: browser.runtime.getURL("/options.html" + message.hashurl || "") 
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
			loadUserOptions();
			sendResponse({"userOptions": userOptions});
			break;
		
		case "openQuickMenu":
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "closeQuickMenuRequest":
			browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
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

	}
}

function loadUserOptions(callback) {
	
	callback = callback || function() {};
	function onGot(result) {
		if (!result.userOptions) return false;
		// Update default values instead of replacing with object of potentially undefined values
		for (let key in result.userOptions) {
			userOptions[key] = (result.userOptions[key] !== undefined) ? result.userOptions[key] : userOptions[key];
		}
		
		buildContextMenu();
		callback();
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
		buildContextMenu();
		callback();
	}
	
	var getting = browser.storage.local.get("userOptions");
	getting.then(onGot, onError);
}

function buildContextMenu() {

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
		browser.contextMenus.create({
			parentId: "search_engine_menu",
			id: i.toString(),
			title: userOptions.searchEngines[i].title,
			contexts: ["selection", "link"],
			icons: {
				"16": userOptions.searchEngines[i].icon_url || userOptions.searchEngines[i].icon_base64String || "",
				"32": userOptions.searchEngines[i].icon_url || userOptions.searchEngines[i].icon_base64String || ""
			}
		});
	}
	
	if (!browser.contextMenus.onClicked.hasListener(contextMenuSearch))
		browser.contextMenus.onClicked.addListener(contextMenuSearch);
	
}

function contextMenuSearch(info, tab) {
	var searchTerms = (info.linkUrl && !info.selectionText) ? info.linkUrl : info.selectionText.trim();
	
	// get modifier keys
	var shift = info.modifiers.includes("Shift");
	var ctrl = info.modifiers.includes("Ctrl");
	
	if (shift)
		openMethod = userOptions.contextMenuShift;
	else if (ctrl)
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
	
	console.log('openUrl = ' + openUrl);
	
	// if searchEngines is empty, open Options
	if (userOptions.searchEngines.length === 0) {	
		browser.runtime.openOptionsPage();
		return false;	
	}

	if (
		searchEngineIndex === null ||
		!searchTerms ||
		tab === null
	) return false;
	
	var searchEngine = userOptions.searchEngines[searchEngineIndex];
	
	// legacy fix
	searchEngine.queryCharset = searchEngine.queryCharset || "UTF-8";
	
	var encodedSearchTermsObject = encodeCharset(searchTerms, searchEngine.queryCharset);
	var q = replaceOpenSearchParams(searchEngine.query_string, encodedSearchTermsObject.uri);
	
	// if using Open As Link from quick menu
	if (openUrl) {
		q = searchTerms;
		if (searchTerms.match(/^.*:\/\//) === null)
			q = "http://" + searchTerms;
	}
	
	console.log(q);

	// get array of open search tabs async. and find right-most tab
	getOpenSearchTabs(tab.id, (openSearchTabs) => {
		
		if (typeof searchEngine.method !== 'undefined' && searchEngine.method === "POST") {
			let url = new URL(searchEngine.template);
			q = url.origin + url.pathname;
			
			console.log(q);
		}
		
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
			case "openBackgroundTab":
				openBackgroundTab();
				break;
			
		}
		
		function onCreate(_tab) {
			
			// code for POST engines
			if (typeof searchEngine.method === 'undefined' || searchEngine.method !== "POST") return;
			
			// if new window
			if (_tab.tabs) _tab = _tab.tabs[0];

			browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabInfo) {
		
				// new windows open to about:blank and throw extra complete event
				if (tabInfo.url === "about:blank") return;

				browser.tabs.onUpdated.removeListener(listener);
				
				browser.tabs.executeScript(_tab.id, {
					code: 'var _INDEX=' + searchEngineIndex + ', _SEARCHTERMS="' + /*encodedSearchTermsObject.ascii */ searchTerms + '"', 
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
			browser.tabs.update({
				url: q,
				openerTabId: tab.id
			});
			creating.then(onCreate, onError);
		} 
		function openNewWindow() {	// open in new window

			var creating = browser.windows.create({
				url: q
			});
			creating.then(onCreate, onError);
		} 
		function openNewTab(inBackground) {	// open in new tab
		
			inBackground = inBackground || false;
			// rightMostSearchTabIndex = tab.index if openSearchTabs is empty or right-most search tab is left of tab
			var rightMostSearchTabIndex = (openSearchTabs.length > 0 && openSearchTabs[openSearchTabs.length -1].index > tab.index) ? openSearchTabs[openSearchTabs.length -1].index : tab.index;
			
			var creating = browser.tabs.create({
				url: q,
				active: !inBackground,
				index: rightMostSearchTabIndex + 1,
				openerTabId: tab.id
			});
			creating.then(onCreate, onError);

		}	
		function openBackgroundTab() {
			openNewTab(true)
		}
	});
}

function getOpenSearchTabs(id, callback) {

	function onGot(tabs) {		
		var openSearchTabs = tabs.sort(function(a, b) {
			return (a.index < b.index) ? -1 : 1;
		});
		callback(openSearchTabs);
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var querying = browser.tabs.query({currentWindow: true, openerTabId: id});
	querying.then(onGot, onError);
}

function getAllOpenTabs(callback) {
	
	function onGot(tabs) {
		callback(tabs);
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var querying = browser.tabs.query({});
	querying.then(onGot, onError);
}

var userOptions = {
	searchEngines: [],
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
	contextMenu: true,
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
buildContextMenu();

browser.runtime.onMessage.addListener(notify);
browser.runtime.onInstalled.addListener(function updatePage() {
	
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
	
	if (userOptions.searchEngines.length !== 0 && typeof userOptions.searchEngines[0].method === 'undefined') {	
		var creating = browser.tabs.create({
			url: "/update.html"
		});
		creating.then();
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
			uri_string += (c.match(/[a-zA-Z0-9\-_.!~*'()]/) !== null) ? c : "%" + uint8.toString(16);
		}

		return {ascii: ascii_string, uri: uri_string};
	} catch (error) {
		console.log(error.message);
		return {ascii: string, uri: string};
	}
}


/*
console.log(encodeCharset("blahbla blah blah & blah", 'utf-8'));
console.log(encodeCharset("ツ 日本語用コンテ blah blah", 'euc-jp'));
console.log(encodeCharset("try this", 'windows-1251'));
console.log(encodeCharset('一般来说，URL只能使用英文字母、阿拉伯数字和某些标点符号，不能使用其他文字和符号。比如，世界上有英文字母的网址"http://www.abc.com"，但是没有希腊字母的网址"http://www.aβγ.com"（读作阿尔法-贝塔-伽玛.com）。这是因为网络标准RFC 1738做了硬性规定', 'GB2312'));
//'euc-jp' ядрами и графическое
*/
