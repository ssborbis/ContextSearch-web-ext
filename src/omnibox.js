browser.omnibox.setDefaultSuggestion({
  description: "ContextSearch ->"
});

function getNodesFromHotkeys(hotkeys) {
	let nodes = [];

	let keywordNode = findNode(userOptions.nodeTree, n => n.keyword && n.keyword === hotkeys.join(''));
	if ( keywordNode ) return [keywordNode];

	hotkeys.forEach( k => {
		let node = findNode(userOptions.nodeTree, n => k.toLowerCase() == String.fromCharCode(n.hotkey).toLowerCase());
		if ( node ) nodes.push(node);
	});
	
	return nodes;
}

function parseOmniboxInput(input) {

	let partial_match = /(\w+)$/.exec(input);
	let full_match = /(\w+)\s+(.*)/.exec(input);
	
	if ( full_match ) 
		return { hotkeys: full_match[1].split(''), searchTerms: full_match[2] };
	
	if ( partial_match ) 
		return { searchTerms: partial_match[1] }
	
	return null;	
}

browser.omnibox.onInputChanged.addListener((input, suggest) => {
	
	parseOmniboxInput(input);

	// let nodes = [...new Set(findNodes(userOptions.nodeTree, n => n.hotkey))];
	// let suggestions = [];
	// nodes.forEach(n => {
		// suggestions.push({
			// content: String.fromCharCode(n.hotkey).toLowerCase(),
			// description: n.title
		// });
	// });
	
	// suggest(suggestions);
});

browser.omnibox.onInputEntered.addListener( async(text, disposition) => {

	let input = parseOmniboxInput(text);
	
	if ( !input ) return;
	
	if ( !input.hotkeys ) {
		let node = findNode(userOptions.nodeTree, n => n.hotkey);
		input.hotkeys = node ? [String.fromCharCode(node.hotkey).toLowerCase()] : [];
	}
	
	let nodes = getNodesFromHotkeys(input.hotkeys);
	let tab = await browser.tabs.query({currentWindow: true, active: true});
	
	let method = "openBackgroundTab";
	// switch (disposition) {
		// case "currentTab":
			// method = "openCurrentTab";
			// break;
		// case "newForegroundTab":
			// method = "openNewTab";
			// break;
		// case "newBackgroundTab":
			// method = "openBackgroundTab";
			// break;
	// }

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