function notify(message, sender, sendResponse) {
	
	function updateAllTabs() {
		getAllOpenTabs((tabs) => {
			for (var i=0;i<tabs.length;i++) {
				browser.tabs.sendMessage(tabs[i].id, {"userOptions": userOptions});	
			}
		});
	}
	
	switch(message.action) {
		
		case "updateUserOptions":
			loadUserOptions();
			updateAllTabs();
			break;
			
		case "openOptions":
			browser.runtime.openOptionsPage();
			break;
			
		case "openTab":
			openSearchTab(message.info, sender.tab);
			break;
			
		case "enableContextMenu":
			userOptions.contextMenu = true;
			buildContextMenu();
			break;
			
		case "getUserOptions":
			loadUserOptions();
			sendResponse({"userOptions": userOptions});
			break;
			
		case "closeQuickMenuRequest":
			browser.tabs.sendMessage(sender.tab.id, {action: "closeQuickMenu"});
			break;
			
		case "closeWindowRequest":
			browser.windows.remove(sender.tab.windowId);
			break;

	}
}

function loadUserOptions() {
	
	function onGot(result) {
		userOptions = result.userOptions || userOptions;
		browser.storage.local.get("searchEngines").then((r2) => {
			if (typeof r2.searchEngines !== 'undefined') {
				console.log('found separate searchEngines array in local storage.  Copying to userOptions and removing');
				userOptions.searchEngines = r2.searchEngines || userOptions.searchEngines;
				browser.storage.local.remove("searchEngines");
				browser.storage.local.set({"userOptions": userOptions});
			}
			buildContextMenu();
		}, () => {
			console.log('error getting searchEngines from localStorage');
			buildContextMenu();
		});
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
		buildContextMenu();
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
		contexts: ["selection"]
	});

	for (var i=0;i<userOptions.searchEngines.length;i++) {
		browser.contextMenus.create({
			parentId: "search_engine_menu",
			id: i.toString(),
			title: userOptions.searchEngines[i].title,
			contexts: ["selection"],
			icons: {
				"16": userOptions.searchEngines[i].icon_url || userOptions.searchEngines[i].icon_base64String || "",
				"32": userOptions.searchEngines[i].icon_url || userOptions.searchEngines[i].icon_base64String || ""
			}
		});
	}
	
	if (!browser.contextMenus.onClicked.hasListener(openSearchTab))
		browser.contextMenus.onClicked.addListener(openSearchTab);
	
}

function openSearchTab(info, tab) {
	
	// get modifier keys
	var shift = info.modifiers.includes("Shift");
	var ctrl = info.modifiers.includes("Ctrl");
	
	// swap modifier keys if option set
	if (userOptions.swapKeys)
		shift = [ctrl, ctrl=shift][0];
	
	if (userOptions.searchEngines.length === 0) {
		
		// if searchEngines is empty, open Options
		var opening = browser.runtime.openOptionsPage();
		opening.then();
		
	} else {
	
		var searchTerms = info.selectionText.trim();
		userOptions.searchEngines[info.menuItemId].queryCharset = userOptions.searchEngines[info.menuItemId].queryCharset || "UTF-8";

		var encodedSearchTermsObject = encodeCharset(searchTerms, userOptions.searchEngines[info.menuItemId].queryCharset);
		var q = replaceOpenSearchParams(userOptions.searchEngines[info.menuItemId].query_string, encodedSearchTermsObject.uri);
		
//		console.log(q);
		// get array of open search tabs async. and find right-most tab
		getOpenSearchTabs(tab.id, (openSearchTabs) => {
			
			if (typeof userOptions.searchEngines[info.menuItemId].method !== 'undefined' && userOptions.searchEngines[info.menuItemId].method === "POST")
				q = userOptions.searchEngines[info.menuItemId].template;

			function onCreate(_tab) {
				
				// code for POST engines
				if (typeof userOptions.searchEngines[info.menuItemId].method === 'undefined' || userOptions.searchEngines[info.menuItemId].method !== "POST") return;
				
				// if new window
				if (shift) _tab = _tab.tabs[0];
	
				browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabInfo) {
			
					// new windows open to about:blank and throw extra complete event
					if (tabInfo.url !== q) return;
					browser.tabs.onUpdated.removeListener(listener);

					browser.tabs.executeScript(_tab.id, {
						code: 'window.stop();',
						runAt: 'document_start'
					}).then(() => {
					browser.tabs.executeScript(_tab.id, {
						code: 'var _INDEX=' + info.menuItemId + ', _SEARCHTERMS="' + /*encodedSearchTermsObject.ascii*/ searchTerms + '"', 
						runAt: 'document_idle'
					}).then(() => {
					browser.tabs.executeScript(_tab.id, {
						file: '/execute.js',
						runAt: 'document_idle'
					});});});
				
				});
			}
			
			function onError() {
				console.log(`Error: ${error}`);
			}

			if (shift) {	// open in new window

				var creating = browser.windows.create({
					url: q
				});
				creating.then(onCreate, onError);
				
			} else {	// open in new tab
			
				// rightMostSearchTabIndex = tab.index if openSearchTabs is empty or right-most search tab is left of tab
				var rightMostSearchTabIndex = (openSearchTabs.length > 0 && openSearchTabs[openSearchTabs.length -1].index > tab.index) ? openSearchTabs[openSearchTabs.length -1].index : tab.index;
				
				var creating = browser.tabs.create({
					url: q,
					active: (ctrl || userOptions.backgroundTabs) ? false : true,
					index: rightMostSearchTabIndex + 1,
					openerTabId: tab.id
				});
				creating.then(onCreate, onError);
	
			}
		});
	}
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
	backgroundTabs: false,
	swapKeys: false,
	quickMenu: false,
	quickMenuColumns: 4,
	quickMenuItems: 100,
	quickMenuKey: 0,
	quickMenuOnKey: false,
	quickMenuOnMouse: true,
	quickMenuMouseButton: 3,
	quickMenuAuto: false,
	contextMenu: true
};

loadUserOptions();
browser.runtime.onMessage.addListener(notify);
browser.runtime.onInstalled.addListener(function updatePage() {
	if (userOptions.searchEngines.length !== 0 && typeof userOptions.searchEngines[0].method === 'undefined') {	
		var creating = browser.tabs.create({
			url: "/update.html"
		});
		creating.then();
	}
});

browser.browserAction.onClicked.addListener(() => {
	
//	browser.browserAction.setPopup({popup: "/options.html#quickload"});

	var creating = browser.windows.create({
		url: browser.runtime.getURL("/options.html#quickload"),
		type: "popup",
		height: 100,
		width: 400
	});
	creating.then((windowInfo) => {
	});

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
