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
		searchEngines = item.searchEngines || [];
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
		userOptions = result.userOptions || {};
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
	
	// check for click modifiers
	var active = true, move = false;
	for (var m=0;m<info.modifiers.length;m++) {
		if (info.modifiers[m] === "Shift")
			active = false;
		else if (info.modifiers[m] === "Ctrl")
			move = true;
	}
	
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
		
		var creating = browser.tabs.create({
			url: encodeURI(q),
			active: (!active || userOptions.backgroundTabs) ? false : true,
			index: (move || userOptions.adjacentTabs) ? tab.index + 1 : null		
		});
		
		creating.then();
	}
}

var userOptions = {};
var searchEngines = [];
browser.runtime.onMessage.addListener(notify);
loadSearchEngines();
loadUserOptions();