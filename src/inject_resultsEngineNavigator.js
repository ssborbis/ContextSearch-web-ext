console.log('inject_speedDial.js');

var current, previous, next, terms;

const nextResultsEngine = () => {
	browser.runtime.sendMessage({
		action: "search", 
		info: {
			menuItemId: next.id,
			selectionText: terms,
			openMethod: "openCurrentTab"
		}
	});
}

const previousResultsEngine = () => {
	browser.runtime.sendMessage({
		action: "search", 
		info: {
			menuItemId: previous.id,
			selectionText: terms,
			openMethod: "openCurrentTab"
		}
	});
}

(async () => {

	let tt = await browser.runtime.sendMessage({action: "getTabTerms"});

	if ( !tt ) return;

	let folder = findNode(userOptions.nodeTree, n => n.id === tt.folderId);
	let node = findNode(folder, n => n.id === tt.id);

	let array = [...new Set(folder.children.filter(c => {
		
		if ( !["searchEngine", "oneClickSearchEngine"/*, "bookmarklet", "externalProgram"*/].includes(c.type) ) return false;
		
		// filter multisearch
		try {
			se = userOptions.searchEngines.find(_se => _se.id === c.id);
			JSON.parse(se.template);
			return false;
		} catch (err) {}

		return true;
	}))];

	var len = array.length;
	var i = array.indexOf(node);

	current = array[i];
	previous = array[(i+len-1)%len];
	next = array[(i+1)%len];

	terms = tt.searchTerms;
})();

