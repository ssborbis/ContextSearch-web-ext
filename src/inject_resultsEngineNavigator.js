let folder, current, previous, next, terms;

const resultsSearch = node => {
	sendMessage({
		action: "search", 
		info: {
			menuItemId: node.id,
			selectionText: terms,
			openMethod: "openCurrentTab"
		}
	});
}

const nextResultsEngine = async () => {
	if ( killswitch ) return;

	if ( !terms ) await init();

	if ( userOptions.resultsNavigatorSkipMenu )
		return resultsSearch(next);

	resetCarousel(folder, next);
	showNextEngine(current); 
	return;
}

const previousResultsEngine = async () => {
	if ( killswitch ) return;

	if ( !terms ) await init();

	if ( userOptions.resultsNavigatorSkipMenu )
		return resultsSearch(previous);

	resetCarousel(folder, previous);
	showNextEngine(current); 
	return;
}

const resetCarousel = (folder, node) => {
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
}

const showNextEngine = async node => {

	let icon = getIconFromNode(node);

	// defaultEngines icons are not web accessible
	if (icon.startsWith("/defaultEnginesIcons")) {
		icon = await sendMessage({action: "fetchURI", url: icon});
	}
	
	let img = new Image();
	img.src = icon;

	let id = "CS_resultsEngineIconDialog";
	let dialog = getShadowRoot().getElementById(id);
	
	if ( !dialog ) {
		dialog = document.createElement('dialog');
		dialog.id = id;
		getShadowRoot().appendChild(dialog);
		dialog.showModal();
	}

	dialog.innerHTML = null
	dialog.appendChild(img);

	let label = document.createElement('div');
	label.innerText = node.title;
	dialog.appendChild(label);

	dialog.addEventListener('keypress', e => {
		if ( e.key === "Enter") resultsSearch(node);
	});
}

const init = async () => {

	let tt = await sendMessage({action: "getTabTerms"});

	if ( !tt ) return;

	folder = findNode(userOptions.nodeTree, n => n.id === tt.folderId);
	let node = findNode(folder, n => n.id === tt.id);

	resetCarousel(folder, node);

	terms = tt.searchTerms;
}

