function notify(message) {
	
	switch(message.action) {
		
		case "loadSearchEngines":
			loadSearchEngines();
			break;
			
		case "loadUserOptions":
			loadUserOptions();
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
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	var getting = browser.storage.local.get("userOptions");
	getting.then(onGot, onError);
}

function buildContextMenu() {

	browser.contextMenus.removeAll();	

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
		
		// replace OpenSearch params
		var q = searchEngines[info.menuItemId].query_string
			.replace(/{searchTerms}/g, info.selectionText)
			.replace(/{count}/g, "50")
			.replace(/{startIndex}/g, "1")
			.replace(/{startPage}/g, "1")
			.replace(/{language}/g, navigator.language || navigator.userLanguage)
			.replace(/{inputEncoding}/g, document.characterSet)
			.replace(/{outputEncoding}/g, document.characterSet)
			.replace(/{.+?\?}/g,"") // optionals
			.replace(/{moz:.+?}/g, "") // moz specific
			.replace(/{.+?}/g, ""); // all others

		// get array of open search tabs async. and find right-most tab
		getOpenSearchTabs(tab.id, (openSearchTabs) => {
			
			if (shift) {	// open in new window
			
				var creating = browser.windows.create({
					url: encodeURI(q)
				//	focused: (ctrl) ? false : true // not available in FF
				});
				creating.then();
				
			} else {	// open in new tab
			
				// rightMostSearchTabIndex = tab.index if openSearchTabs is empty or right-most search tab is left of tab
				var rightMostSearchTabIndex = (openSearchTabs.length > 0 && openSearchTabs[openSearchTabs.length -1].index > tab.index) ? openSearchTabs[openSearchTabs.length -1].index : tab.index;
				
				var creating = browser.tabs.create({
					url: encodeURI(q),
					active: (ctrl || userOptions.backgroundTabs) ? false : true,
					index: rightMostSearchTabIndex + 1,
					openerTabId: tab.id
				});
				creating.then();
				
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

var userOptions = {
	backgroundTabs: false,
	swapKeys: false
};
var searchEngines = [];

browser.runtime.onMessage.addListener(notify);
loadSearchEngines();
loadUserOptions();