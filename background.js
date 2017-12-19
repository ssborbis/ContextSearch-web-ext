function notify(message, sender, sendResponse) {
	
	function updateAllTabs() {
		getAllOpenTabs((tabs) => {
			for (var i=0;i<tabs.length;i++) {
				browser.tabs.sendMessage(tabs[i].id, {"userOptions": userOptions, "searchEngines": searchEngines});	
			}
		});
	}
	
	switch(message.action) {
		
		case "loadSearchEngines":
			loadSearchEngines();
			updateAllTabs();
			break;
			
		case "loadUserOptions":
			loadUserOptions();
			updateAllTabs();
			break;
			
		case "openOptions":
			var opening = browser.runtime.openOptionsPage();
			opening.then();
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
			
		case "getSearchEngines":
			loadSearchEngines();
			sendResponse({"searchEngines": searchEngines});
			break;
			
		case "closeQuickMenuRequest":
			browser.tabs.sendMessage(sender.tab.id, {action: "closeQuickMenu"});
			break;
			
		case "closeWindowRequest":
			browser.windows.remove(sender.tab.windowId);
			break;

	}
}

function loadSearchEngines() {
	
	function onGot(item) {
		searchEngines = item.searchEngines || searchEngines;
		buildContextMenu();
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
		buildContextMenu();
	}
	
	var getting = browser.storage.local.get("searchEngines");	
	getting.then(onGot, onError);
}

function loadUserOptions() {
	
	function onGot(result) {
		userOptions = result.userOptions || userOptions;
		buildContextMenu();
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
		title: (searchEngines.length === 0) ? "+ Add search engines" : "Search with",
		contexts: ["selection"]
	});

	for (var i=0;i<searchEngines.length;i++) {
		browser.contextMenus.create({
			parentId: "search_engine_menu",
			id: i.toString(),
			title: searchEngines[i].title,
			contexts: ["selection"],
			icons: {
				"16": searchEngines[i].icon_url || "",
				"32": searchEngines[i].icon_url || ""
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
	
	if (searchEngines.length === 0) {
		
		// if searchEngines is empty, open Options
		var opening = browser.runtime.openOptionsPage();
		opening.then();
		
	} else {
		
		var searchTerms = info.selectionText.trim();
		searchEngines[info.menuItemId].queryCharset = searchEngines[info.menuItemId].queryCharset || "UTF-8";
		
		if (searchEngines[info.menuItemId].queryCharset === 'EUC-JP' || searchEngines[info.menuItemId].queryCharset === 'SHIFT_JS' || searchEngines[info.menuItemId].queryCharset === 'JIS') 
			searchTerms = Encoding.urlEncode(Encoding.convert(searchTerms, searchEngines[info.menuItemId].queryCharset));
		else
			searchTerms = encodeURIComponent(searchTerms);
		
		var q = replaceOpenSearchParams(searchEngines[info.menuItemId].query_string, searchTerms);
		
		console.log(q);
		// get array of open search tabs async. and find right-most tab
		getOpenSearchTabs(tab.id, (openSearchTabs) => {
			
			if (typeof searchEngines[info.menuItemId].method !== 'undefined' && searchEngines[info.menuItemId].method === "POST")
				q = searchEngines[info.menuItemId].template;

			function onCreate(_tab) {
				
				// code for POST engines
				if (typeof searchEngines[info.menuItemId].method === 'undefined' || searchEngines[info.menuItemId].method !== "POST") return;
				
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
						code: 'var _INDEX=' + info.menuItemId + ', _SEARCHTERMS="' + searchTerms + '"',
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
	backgroundTabs: false,
	swapKeys: false,
	quickMenu: false,
	quickMenuColumns: 4,
	quickMenuItems: 100,
	quickMenuKey: 0,
	quickMenuOnKey: false,
	quickMenuOnMouse: true,
	quickMenuMouseButton: 3,
	contextMenu: true
};

var searchEngines = [];

browser.runtime.onMessage.addListener(notify);
loadSearchEngines();
loadUserOptions();
browser.runtime.onInstalled.addListener(function updatePage() {
	if (searchEngines.length !== 0 && typeof searchEngines[0].method === 'undefined') {	
		var creating = browser.tabs.create({
			url: "/update.html"
		});
		creating.then();
	}
});

browser.browserAction.onClicked.addListener(() => {

	var creating = browser.windows.create({
		url: browser.runtime.getURL("/options.html#quickload"),
		type: "popup",
		height: 100,
		width: 400
	});
	creating.then((windowInfo) => {
	});

});

