browser.omnibox.setDefaultSuggestion({
  description: "ContextSearch ->"
});

function getNodesFromHotkeys(hotkeys) {
	let nodes = [];
	hotkeys.forEach( k => {
		let node = findNode(userOptions.nodeTree, n => k.toLowerCase() == String.fromCharCode(n.hotkey).toLowerCase());
		if ( node ) nodes.push(node);
	});
	
	return nodes;
}

function parseOmniboxInput(input) {
	let matches = /(\w+) (.*)/.exec(input);

	if ( !matches ) return null;

	return {
		hotkeys: matches[1].split(''),
		searchTerms: matches[2]
	}
}

browser.omnibox.onInputChanged.addListener((input, suggest) => {

	let nodes = [...new Set(findNodes(userOptions.nodeTree, n => n.hotkey))];
	let suggestions = [];
	nodes.forEach(n => {
		suggestions.push({
			content: String.fromCharCode(n.hotkey).toLowerCase(),
			description: n.title
		});
	});
	
	suggest(suggestions);
});

browser.omnibox.onInputEntered.addListener( async(text, disposition) => {

	let input = parseOmniboxInput(text);
	
	if ( !input ) return;

	let nodes = getNodesFromHotkeys(input.hotkeys);
	let tab = await browser.tabs.query({currentWindow: true, active: true});
	
	let method = "openBackgroundTab";
	switch (disposition) {
		case "currentTab":
			method = "openCurrentTab";
			break;
		case "newForegroundTab":
			method = "openNewTab";
			break;
		case "newBackgroundTab":
			method = "openBackgroundTab";
			break;
	}
	
	method = "openBackgroundTab";
	
	let folderNode = {
		type: "folder",
		id: gen(),
		children: nodes
	}
	
	let info = {
		folder: true,
		openMethod: method,
		tab: tab,
		searchTerms: input.searchTerms,
		selectionText: input.searchTerms,
		node: folderNode
	}

	folderSearch(info, true); // allowFolders = true
	
});