const contexts = ["audio", "frame", "image", "link", "page", "selection", "video"];
const contextCodes = [1,2,4,8,16,32,64];
const ROOT_MENU = "root_menu";

function hasContext(contextText, contextCode) {
	let power = contexts.indexOf(contextText);
	let code = Math.pow(2, power);

	return ( (contextCode & code ) === code );
}

function filterContexts(root, context) {

	let filteredNodeTree = JSON.parse(JSON.stringify(root));

	traverseNodesDeep(filteredNodeTree, ( node, parent ) => {
		if ( !['folder', 'searchEngine'].includes(node.type) )
			removeNode( node, parent );

		if ( node.type === 'searchEngine' ) {
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			if ( se && (!se.contexts || !hasContext(context, se.contexts)) )
				removeNode( node, parent );
		}

		if ( node.type === 'folder' && node.children.length === 0 )
			if ( parent ) removeNode( node, parent );
	})

	return filteredNodeTree;
}

async function buildContextMenu(searchTerms) {
	
	function onCreated() {

		if (browser.runtime.lastError) {
			if ( browser.runtime.lastError.message.indexOf("ID already exists") === -1 ) console.log(browser.runtime.lastError);
		}
	}
	
	function addMenuItem( createOptions ) {

		createOptions.contexts = createOptions.contexts || contexts;

		try {
			browser.contextMenus.create( createOptions, onCreated);
		} catch (error) { // non-Firefox
			delete createOptions.icons;
			browser.contextMenus.create( createOptions, onCreated);
		}
	}

	function traverse(node, parentId, context) {

		let context_prefix = ( context ) ? context + "_" : "";
		
		if (node.hidden) return;
		
		let getTitleWithHotkey = (n) => {
			if ( userOptions.contextMenuHotkeys ) 
				return n.title + (n.hotkey ? ` (&${keyTable[n.hotkey].toUpperCase()})` : "");
			else 
				return n.title;
		}

		if ( node.type === 'searchEngine' ) {

			let se = userOptions.searchEngines.find(se => se.id === node.id);
			
			if (!se) {
				console.log('no search engine found for ' + node.id);
				return;
			}

			if ( !se.hasOwnProperty('contexts') )
				se.contexts = 32; // selection
			
			let _id = se.id + '_' + count++;

			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: context_prefix + _id,	
				icons: {
					"16": se.icon_base64String || se.icon_url || "/icons/logo_notext.svg"
				}
			});

			if ( /{selectdomain}/.test( se.template ) ) {
				
				let pathIds = [];
				
				domainPaths.forEach( path => {
					
					let pathId = '__selectDomain__' + se.id + '_' + count++ + "_" + btoa(path);
					
					addMenuItem({
						parentId: context_prefix + _id,
						title: path,
						id: context_prefix + pathId,
						icons: {
							"16": tab.favIconUrl || se.icon_base64String || se.icon_url || "/icons/logo_notext.svg"
						}
					});
					
					pathIds.push(pathId);
				});

			}
			
		}
		
		if (node.type === 'bookmarklet') {
			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: node.id + '_' + count++,	
				icons: {
					"16": node.icon || browser.runtime.getURL("/icons/code.svg")
				}
			});
		}
		
		if (node.type === 'oneClickSearchEngine') {
			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: node.id + '_' + count++,
				icons: {
					"16": node.icon
				}
			});
		}
		
		if (node.type === 'separator' /* firefox */) {
			browser.contextMenus.create({
				parentId: parentId,
				type: "separator"
			});
		}
		
		if ( node.type === 'folder' ) {
			
			let _id = "folder" + ++id

			// special case for regex matching
			if ( node.id === '___matching___') {

				// prepend context if using contextual menus
				if ( contexts.includes(parentId) )
					_id = parentId + node.id;
				else
					_id = node.id;
			}
			
			addMenuItem({
				parentId: parentId,
				id: _id,
				title: getTitleWithHotkey(node),
				icons: {
					"16": node.icon || "/icons/folder-icon.svg"
				}
			});
			
			// add menu item to search entire folder
			if ( userOptions.contextMenuShowFolderSearch && node.children.length ) {

				// skip special folders
				if ( node.id !== "___recent___") {
				
					addMenuItem({
						parentId: _id,
						id: node.id + "_" + id,
						title: browser.i18n.getMessage("SearchAll"),
						icons: {
							"16": "icons/search.svg"
						}
					});

				}
			}
			
			for (let child of node.children) {
				traverse(child, _id, context);
			}
		}
		
	}

	function addOptions(context, root) {

		if ( !userOptions.contextMenuShowSettingsFolder ) return;

		context = context || "";
		root = root || "";

		let context_prefix = ( context ) ? context + "_" : "";

		addMenuItem({
			parentId: root,
			title: browser.i18n.getMessage('settings'),
			id: context_prefix + "___settings___",
			icons: {
				"16": browser.runtime.getURL('icons/settings.svg')
			}
		});

		addMenuItem({
			title: "Contextual",
			id: context_prefix + "contextMenuUseContextualLayout",
			parentId: context_prefix + "___settings___",
			type: "checkbox",
			checked: userOptions.contextMenuUseContextualLayout
		});

		addMenuItem({
			title: "Open Options",
			id: context_prefix + "openOptions",
			parentId: context_prefix + "___settings___"
		});
	}

	// catch android
	if ( !browser.contextMenus ) return;
	
	await browser.contextMenus.removeAll();
	
	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	let domainPaths = getDomainPaths(tab.url);

	if (!userOptions.contextMenu) return false;

	if (userOptions.contextMenuShowAddCustomSearch) {
		let createProperties = {
			id: "add_engine",
			title: browser.i18n.getMessage("AddCustomSearch"),
			contexts: ["editable"],
			icons: { "16": browser.runtime.getURL('icons/logo_notext.svg') },
			visible: false
		}

		// Waterfox Classic fix
		try {
			addMenuItem(createProperties);
		} catch ( error ) {
			delete createProperties.visible;
			addMenuItem(createProperties);
		}
	}

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	if (!root.children) return;

	let id = 0;
	delete root.id;

	// add incremental menu ids to avoid duplicates
	let count = 0;

	let buildContextually = async () => {
			
		if ( userOptions.syncWithFirefoxSearch ) {
			let ses = await browser.search.get();
			
			ses.forEach(se => {
				let node = findNode(userOptions.nodeTree, _node => _node.title === se.name && (_node.type === "oneClickSearchEngine" || _node.type === "searchEngine") );
				
				if ( !node ) console.log(se);

				addMenuItem({
					title: se.name,
					id: node.id + '_' + count++,
					icons: {
						"16": se.favIconUrl || browser.runtime.getURL('icons/search.svg')
					}
				});
			});
			
			return;
		}

		contexts.forEach( ( context, index ) => {

			// create node tree for context
			let filteredNodeTree = filterContexts(root, context);

			// skip empty contexts
			if ( !filteredNodeTree.children.length ) return;

			// flatten
			let seNodes = findNodes(filteredNodeTree, n => n.type === 'searchEngine');
			if ( seNodes.length < userOptions.contextMenuContextualLayoutFlattenLimit ) {
				filteredNodeTree.children = seNodes;
			}

			browser.contextMenus.create({
				id: context,
				title: browser.i18n.getMessage("SearchForContext", browser.i18n.getMessage(context).toUpperCase()),
				contexts: [context]
			});

			// recently used engines
			if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

				let folder = recentlyUsedListToFolder();
				
				if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
					traverse(folder, context, context);
				} else {
				//	root.children.unshift({type: "separator"});
					folder.children.forEach( c => c.title = "🕒 " + c.title);		
					folder.children.forEach( c => traverse(c, context, context));
				}

				// traverse(folder, context, context);
			}

			// matching regex engines
			 if ( userOptions.contextMenuRegexMatchedEngines ) {
			 	let folder = matchingEnginesToFolder(searchTerms || "");
			 	traverse(folder, context, context);
			}

			filteredNodeTree.children.forEach( child => traverse(child, context, context) );

			addOptions(context, context);
		});
	}

	let buildLegacy = async () => {
		let contexts = ["selection"];

		if ( userOptions.contextMenuOnImages) contexts.push("image");
		if ( userOptions.contextMenuOnLinks) contexts.push("link");

		if ( userOptions.contextMenuUseInnerText ) contexts.push("page");
		
		// recently used engines
		if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

			let folder = recentlyUsedListToFolder();
			
			if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
				root.children.unshift(folder);
			} else {
				root.children.unshift({type: "separator"});
				folder.children.forEach( c => c.title = "🕒 " + c.title);		
				root.children = folder.children.concat(root.children);
			}
		}

		// matching regex engines
		 if ( userOptions.contextMenuRegexMatchedEngines ) {
		 	let folder = matchingEnginesToFolder(searchTerms || "");

		 	root.children.unshift(folder);
		}

		browser.contextMenus.create({
			id: ROOT_MENU,
			title: contextMenuTitle(""),
			contexts: contexts
		});

		if ( userOptions.syncWithFirefoxSearch ) {
			let ses = await browser.search.get();
			
			ses.forEach(se => {
				let node = findNode(userOptions.nodeTree, _node => _node.title === se.name && (_node.type === "oneClickSearchEngine" || _node.type === "searchEngine") );
				
				if ( !node ) console.log(se);

				addMenuItem({
					parentId: ROOT_MENU,
					title: se.name,
					id: node.id + '_' + count++,
					icons: {
						"16": se.favIconUrl || browser.runtime.getURL('icons/search.svg')
					}
				});
			});
			
			return;
		}

		root.children.forEach( child => traverse(child, ROOT_MENU) );

		addOptions("", ROOT_MENU);

	}

	if ( userOptions.contextMenuUseContextualLayout )
		buildContextually();
	else
		buildLegacy();
}


function contextMenuTitle(searchTerms, context) {

	if (searchTerms.length > 18) 
		searchTerms = searchTerms.substring(0,15) + "...";
	
	let hotkey = ''; 
	if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';		

	let title = hotkey + (userOptions.contextMenuTitle || browser.i18n.getMessage("SearchFor")).replace("%1", "%s").replace("%s", searchTerms);
	
	if ( !searchTerms ) {
		title = hotkey + (userOptions.contextMenuTitle || browser.i18n.getMessage("SearchWith")).replace("%1", "%s");
	//	if ( context === 'selection')
	//		title = (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + ( userOptions.contextMenuMessage || browser.i18n.getMessage("SearchForWithVariable") );
	}

	// if ( context === 'link' ) 
	// 	title = 'Search for URL';
	// else if ( context === 'image')
	// 	title = 'Search for IMAGE';

	//let title = hotkey + (userOptions.contextMenuTitle || browser.i18n.getMessage("SearchFor")).replace("%1", searchTerms);

	return title;

}

function updateMatchRegexFolders(s) {
	console.log('updateMatchRegexFolders');

	window.contextMenuMatchRegexMenus.forEach( menu => browser.contextMenus.remove( menu ));
	window.contextMenuMatchRegexMenus = [];
	contexts.forEach( context => updateMatchRegexFolder(s, context));
}

function updateMatchRegexFolder(s, context) {

	context = context || "";

	let folder = matchingEnginesToFolder(s);
	
	// only remove if non-contextual
	if ( ! context ) {
		window.contextMenuMatchRegexMenus.forEach( menu => browser.contextMenus.remove( menu ));
		window.contextMenuMatchRegexMenus = [];
	}
			
	// create a new unique iterator
	let count = Date.now();
				
	folder.children.forEach( node => {
		
		let id = node.id + '_' + count++;

		let createOptions = {
			parentId: context + folder.id,
			title: node.title,
			id: id,
			icons: {
				"16": getIconFromNode(node)
			}
		};

		try {
			browser.contextMenus.create(createOptions);
		} catch (error) { // non-Firefox
			delete createOptions.icons;
			try {
				browser.contextMenus.create(createOptions);
			} catch ( error ) { console.log(error)}
		}

		window.contextMenuMatchRegexMenus.push(id);
	});
}

function contextMenuSearch(info, tab) {

	// check for context prefix
	let context = "";
	for ( c of contexts ) {
		if ( info.menuItemId.startsWith(c + "_") ) {
			context = c;
			info.menuItemId = info.menuItemId.replace(/^[a-zA-Z0-9]+_/, "");
			break;
		}
	}

	if ( info.menuItemId === 'contextMenuUseContextualLayout' ) {
		userOptions.contextMenuUseContextualLayout = !userOptions.contextMenuUseContextualLayout;
		notify({action: "saveUserOptions", userOptions: userOptions});
		return buildContextMenu();
	}

	if ( info.menuItemId === 'openOptions' ) {
		return notify({action: "openOptions", hashurl: "#contextMenu"});
	}

	console.log(context, info.menuItemId);

	// remove incremental menu ids
	info.menuItemId = info.menuItemId.replace(/_\d+$/, "");
	
	let node = findNode(userOptions.nodeTree, n => n.id === info.menuItemId);
		
	// clicked Add Custom Search
	if (info.menuItemId === 'add_engine') {
		return browser.tabs.sendMessage(tab.id, {action: "openCustomSearch"}, {frameId: 0});		
	}
	
	// if searchEngines is empty, open Options
	if (userOptions.searchEngines.length === 0 && userOptions.nodeTree.children.length === 0 ) {	
		return browser.runtime.openOptionsPage();	
	}
	
	// get modifier keys
	let openMethod;
	if ( info.modifiers && info.modifiers.includes("Shift") )
		openMethod = userOptions.contextMenuShift;
	else if ( info.modifiers && info.modifiers.includes("Ctrl") )
		openMethod = userOptions.contextMenuCtrl;
	else if ( info.button ) {
		if ( info.button === 0 ) openMethod = userOptions.contextMenuClick;
		if ( info.button === 1 ) openMethod = userOptions.contextMenuMiddleClick;
		if ( info.button === 2 ) openMethod = userOptions.contextMenuRightClick;
	}
	else
		openMethod = userOptions.contextMenuClick;

	var searchTerms;
	if ( info.selectionText )
		searchTerms = info.selectionText.trim();
	else if ( info.srcUrl )
		searchTerms = info.srcUrl;
	else if ( info.linkUrl ) {
		if ( [info.linkUrl, info.linkText].includes(window.searchTerms) ) // if content_script updated the window.searchTerms var properly, use that
			searchTerms = window.searchTerms;
		else
			searchTerms = userOptions.contextMenuSearchLinksAs === 'url' ? info.linkUrl : info.linkText || window.searchTerms;		
	} else if ( userOptions.contextMenuUseInnerText && window.searchTerms.trim() )
		searchTerms = window.searchTerms.trim();

	// if using contextual layout, set the search terms according to context
	switch ( context ) {
		case "selection":
			searchTerms = info.selectionText.trim();
			break;
		case "link":
			searchTerms = info.linkUrl;
			break;
		case "page":
			searchTerms = tab.url;
			break;
		case "frame":
			searchTerms = info.frameUrl;
			break;
		case "image":
		case "video":
		case "audio":
			searchTerms = info.srcUrl;
			break;
	}

	if ( !searchTerms ) return;

	if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith("__selectDomain__") ) {

		let groups = /__selectDomain__(.*?)_\d+_(.*)$/.exec(info.menuItemId);
		info.menuItemId = groups[1];
		info.domain = atob(groups[2]);	
	}

	info.searchTerms = searchTerms;
	info.openMethod = openMethod;
	info.tab = tab;
	info.node = node;
	
	if ( node && node.type === "folder" ) return folderSearch(info);

	openSearch(info);
	// domain: info.domain || new URL(tab.url).hostname
}

// rebuild menu every time a tab is activated to updated selectdomain info
browser.tabs.onActivated.addListener( async tabInfo => buildContextMenu());

browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
	
	function onFound(tabs) {
		let tab = tabs[0];
		
		if ( tab && tab.id && tabId === tab.id && tabInfo.url && tabInfo.url !== "about:blank" && tab.active)
			buildContextMenu();
	}
	
	function onError(err) { console.error(err) }

	if ( changeInfo.status !== 'complete' ) return;
	
	browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);	
	
});