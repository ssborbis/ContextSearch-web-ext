function notify(message) {
  loadEngines();
}

function loadEngines() {

	var getting = browser.storage.local.get("searchEngines");
	
	getting.then(function(item) { // onGot
		buildContextMenu(item.searchEngines || []);
	}, function(error) { // onError
		console.log(`Error: ${error}`);
		buildContextMenu([]);
	});
}

function buildContextMenu(searchEngines) {

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

	browser.contextMenus.onClicked.addListener((info, tab) => {
		if (searchEngines.length === 0) {
			var opening = browser.runtime.openOptionsPage();
			opening.then();
		} else {
			var creating = browser.tabs.create({
				url:encodeURI(searchEngines[info.menuItemId].query_string.replace("{searchTerms}",info.selectionText))
			});
			creating.then();
		}
	});
}

browser.runtime.onMessage.addListener(notify);
loadEngines();