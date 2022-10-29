browser.omnibox.setDefaultSuggestion({
  description: "ContextSearch"
});

function getDefaultNodes() {
	// return either the last used engine or the first engine with a keyword or hotkey
	if ( userOptions.omniboxDefaultToLastUsedEngine && userOptions.omniboxLastUsedIds.length ) {
		let nodes = findNodes(userOptions.nodeTree, n => userOptions.omniboxLastUsedIds.includes(n.id));
		return [...new Set(nodes)];
	} else
		return [findNode(userOptions.nodeTree, n => n.hotkey || n.keyword)];
}

function getNodesFromHotkeys(hotkeys) {
	let nodes = [];

	if ( !hotkeys ) return getDefaultNodes();

	let keywordNode = findNode(userOptions.nodeTree, n => n.keyword && n.keyword === hotkeys.join(''));
	if ( keywordNode ) return [keywordNode];

	hotkeys.forEach( k => {
		let node = findNode(userOptions.nodeTree, n => k.toLowerCase() == String.fromCharCode(n.hotkey).toLowerCase());
		if ( node ) nodes.push(node);
	});
	
	return nodes;
}

function parseOmniboxInput(input) {

	if ( userOptions.omniboxPseudoDisabled )
		return {hotkeys: null, searchTerms:input}

	let partial_match = /(\w+)$/.exec(input);
	let full_match = /(\w+)\s+(.*)/.exec(input);
	
	if ( full_match ) 
		return { hotkeys: full_match[1].split(''), searchTerms: full_match[2] };
	
	if ( partial_match ) 
		return { searchTerms: partial_match[1]}
	
	return null;	
}

browser.omnibox.onInputChanged.addListener((text, suggest) => {

	let input = parseOmniboxInput(text);
	
	let parsedNodes = getNodesFromHotkeys(input.hotkeys);

	let nodes = findNodes(userOptions.nodeTree, n => n.hotkey || n.keyword );

	let defaultDescriptions = parsedNodes.map( n => n.title );

	browser.omnibox.setDefaultSuggestion({
		description: defaultDescriptions.join(" | ")
	});

	let suggestions = [];

	[...new Set(parsedNodes.concat(nodes))].forEach(n => {
		suggestions.push({
			content: (n.keyword || String.fromCharCode(n.hotkey).toLowerCase() ) + " " + input.searchTerms,
			description: n.title
		});
	});

	suggest(suggestions);

});

browser.omnibox.onInputEntered.addListener( async(text, disposition) => {

	let input = parseOmniboxInput(text);

	if ( userOptions.omniboxPseudoDisabled )
		input.searchTerms = 'cs ' + input.searchTerms;

	if ( !input ) return;
	
	let nodes = getNodesFromHotkeys(input.hotkeys);

	if ( userOptions.omniboxPseudoDisabled )
		nodes = [findNode(userOptions.nodeTree, n => ["searchEngine", "oneClickSearchEngine"].includes(n.type))]

	let tab = await browser.tabs.query({currentWindow: true, active: true});

	// get disposition but only override 'currentTab' with searchAction
	let method;
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

	let folderNode = {
		type: "folder",
		id: gen(),
		children: nodes
	}
	
	let info = {
		folder: true,
		openMethod: ( method === 'openCurrentTab' ) ? userOptions.omniboxSearch : method,
		tab: tab,
		searchTerms: input.searchTerms,
		selectionText: input.searchTerms,
		node: folderNode
	}

	folderSearch(info, true); // allowFolders = true

	// save last used engine(s)
	userOptions.omniboxLastUsedIds = nodes.map(n => n.id);
	notify({action: "saveUserOptions", "userOptions": userOptions, source: "omnibox"});	
});