const contexts = ["audio", "frame", "image", "link", "page", "selection", "video"];
const contextCodes = [1,2,4,8,16,32,64];
const contextsLabels = ["Search for AUDIO", "Search for FRAME", "Search for IMAGE", "Search for URL", "Search for PAGE", "Search for %s", "Search for VIDEO"];

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

async function buildContextMenuContextually(searchTerms) {

	let start = Date.now();

	// catch android
	if ( !browser.contextMenus ) return;

	window.contextMenuSelectDomainMenus = [];
	
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

	function addRecentlyUsed() {

	}
	
	await browser.contextMenus.removeAll();
	
	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	let domainPaths = getDomainPaths(tab.url);

	if (!userOptions.contextMenu) return false;
	
	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	if (!root.children) return;

	let id = 0;
	delete root.id;

	// add incremental menu ids to avoid duplicates
	let count = 0;

	// // create root folders based on context
	// let contextualRootFolders = [];
	// contexts.forEach( context => {
	// 	let f = filterContexts(root, context);
	// 	if ( f.children && f.children.length ) contextualRootFolders.push({context: context, folder: f})
	// });
	
	if ( userOptions.syncWithFirefoxSearch ) {
		let ses = await browser.search.get();
		
		let count = 0;
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

		// if ( context === 'all' ) {
		// //	root.children.forEach( child => traverse(child, null) );
		// 	return;
		// }

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
			title: contextsLabels[index],
			contexts: [context]
		});

		// recently used engines
		if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

			let folder = recentlyUsedListToFolder();
			
			if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
				
			} else {
				
			} 

			traverse(folder, context);
		}

		// matching regex engines
		 if ( userOptions.contextMenuRegexMatchedEngines ) {
		 	let folder = matchingEnginesToFolder(searchTerms || "");

		 //	folder.id = context + folder.id;

		 	traverse(folder, context);
		}

		filteredNodeTree.children.forEach( child => traverse(child, context) );
		//root.children.forEach( child => traverse(child, context) );
	});
	
	console.log(Date.now() - start);
	
	function traverse(node, parentId) {
		
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
				se.contexts = 32;
			
			let _id = se.id + '_' + count++;

			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: _id,	
				icons: {
					"16": se.icon_base64String || se.icon_url || "/icons/icon48.png"
				}
			});

			if ( /{selectdomain}/.test( se.template ) ) {
				
				let pathIds = [];
				
				domainPaths.forEach( path => {
					
					let pathId = '__selectDomain__' + se.id + '_' + count++ + "_" + btoa(path);
					
					addMenuItem({
						parentId: _id,
						title: path,
						id: pathId,
						icons: {
							"16": tab.favIconUrl || se.icon_base64String || se.icon_url || "/icons/icon48.png"
						}
					});
					
					pathIds.push(pathId);
				});
				
				window.contextMenuSelectDomainMenus.push( {id: _id, se: se, pathIds: pathIds} );
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
				_id = parentId + node.id;
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
				
				addMenuItem({
					parentId: _id,
					id: node.id + "_" + id,
					title: browser.i18n.getMessage("SearchAll"),
					icons: {
						"16": "icons/search.svg"
					}
				});
			}
			
			for (let child of node.children) {
				traverse(child, _id);
			}
		}
		
	}
}


function contextMenuTitle(searchTerms, context) {

	if (searchTerms.length > 18) 
	searchTerms = searchTerms.substring(0,15) + "...";
	
	let hotkey = ''; 
	if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';		

	let title = hotkey + (userOptions.contextMenuTitle || browser.i18n.getMessage("SearchFor")).replace("%1", searchTerms);
	
	if ( !searchTerms ) {
	//	if ( context === 'selection')
			title = (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + ( userOptions.contextMenuMessage || browser.i18n.getMessage("SearchForWithVariable") );
	}

	// if ( context === 'link' ) 
	// 	title = 'Search for URL';
	// else if ( context === 'image')
	// 	title = 'Search for IMAGE';

	//let title = hotkey + (userOptions.contextMenuTitle || browser.i18n.getMessage("SearchFor")).replace("%1", searchTerms);

	return title;

}

async function buildContextMenu(searchTerms) {

	if ( userOptions.contextMenuUseContextualLayout )
		return buildContextMenuContextually(searchTerms);

	let start = Date.now();

	// catch android
	if ( !browser.contextMenus ) return;

	window.contextMenuSelectDomainMenus = [];

	let contexts = ["selection"];

	if ( userOptions.contextMenuOnImages) contexts.push("image");
	if ( userOptions.contextMenuOnLinks) contexts.push("link");
	
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
	
	await browser.contextMenus.removeAll();
	
	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	let domainPaths = getDomainPaths(tab.url);

	if (!userOptions.contextMenu) return false;
	
	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	if (!root.children) return;

	let id = 0;
	delete root.id;

	// add incremental menu ids to avoid duplicates
	let count = 0;

	// recently used engines
	if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

		let folder = recentlyUsedListToFolder();
		
		if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
			root.children.unshift(folder);
		} else {
			root.children.unshift({type: "separator"});			
			root.children = folder.children.concat(root.children);
		}
	}

	// matching regex engines
	 if ( userOptions.contextMenuRegexMatchedEngines ) {
	 	let folder = matchingEnginesToFolder(searchTerms || "");

	 	root.children.unshift(folder);
	}

	browser.contextMenus.create({
		id: "root_menu",
		title: contextMenuTitle(""),
		contexts: contexts
	});
	
	if ( userOptions.syncWithFirefoxSearch ) {
		let ses = await browser.search.get();
		
		let count = 0;
		ses.forEach(se => {
			let node = findNode(userOptions.nodeTree, _node => _node.title === se.name && (_node.type === "oneClickSearchEngine" || _node.type === "searchEngine") );
			
			if ( !node ) console.log(se);

			addMenuItem({
				parentId: "root_menu",
				title: se.name,
				id: node.id + '_' + count++,
				icons: {
					"16": se.favIconUrl || browser.runtime.getURL('icons/search.svg')
				}
			});
		});
		
		return;
	}

	root.children.forEach( child => traverse(child, "root_menu") );
	console.log(Date.now() - start);
	
	function traverse(node, parentId) {
		
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
			
			let _id = se.id + '_' + count++;

			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: _id,	
				icons: {
					"16": se.icon_base64String || se.icon_url || "/icons/icon48.png"
				}
			});

			if ( /{selectdomain}/.test( se.template ) ) {
				
				let pathIds = [];
				
				domainPaths.forEach( path => {
					
					let pathId = '__selectDomain__' + se.id + '_' + count++ + "_" + btoa(path);
					
					addMenuItem({
						parentId: _id,
						title: path,
						id: pathId,
						icons: {
							"16": tab.favIconUrl || se.icon_base64String || se.icon_url || "/icons/icon48.png"
						}
					});
					
					pathIds.push(pathId);
				});
				
				window.contextMenuSelectDomainMenus.push( {id: _id, se: se, pathIds: pathIds} );
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
				
				addMenuItem({
					parentId: _id,
					id: node.id + "_" + id,
					title: browser.i18n.getMessage("SearchAll"),
					icons: {
						"16": "icons/search.svg"
					}
				});
			}
			
			for (let child of node.children) {
				traverse(child, _id);
			}
		}
		
	}
}

function updateSelectDomainMenus(tab) {
	
	if (!window.contextMenuSelectDomainMenus ) return;
	
	window.contextMenuSelectDomainMenus = [...new Set(window.contextMenuSelectDomainMenus)];
	
	window.contextMenuSelectDomainMenus.forEach( menu => {
		
		menu.pathIds.forEach( pathId => browser.contextMenus.remove( pathId ) );
		
		menu.pathIds = [];
		
		// create a new unique iterator
		let count = Date.now();
				
		getDomainPaths(tab.url).forEach( path => {
			
			let pathId = '__selectDomain__' + menu.se.id + '_' + count++ + "_" + btoa(path);
			
			menu.pathIds.push(pathId);
			
			let createOptions = {
				parentId: menu.id,
				title: path,
				id: pathId,
				icons: {
					"16": tab.favIconUrl || menu.se.icon_base64String || menu.se.icon_url || "/icons/icon48.png"
				},
				contexts: ["selection", "link", "image", "page"]
			};

			try {
				browser.contextMenus.create( createOptions);
			} catch (error) { // non-Firefox
				delete createOptions.icons;
				browser.contextMenus.create( createOptions);
			}
		});
	});
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

	//console.log(context, folder);
	
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
			browser.contextMenus.create( createOptions);
		} catch (error) { // non-Firefox
			delete createOptions.icons;
			try {
				browser.contextMenus.create( createOptions);
			} catch ( error ) { console.log(error)}
		}

		window.contextMenuMatchRegexMenus.push(id);
	});
}

function contextMenuSearch(info, tab) {

	// remove incremental menu ids
	info.menuItemId = info.menuItemId.replace(/_\d+$/, "");
	
	let node = findNode(userOptions.nodeTree, n => n.id === info.menuItemId);
	
	if (info.menuItemId === 'showSuggestions') {
		userOptions.searchBarSuggestions = info.checked;
		notify({action: "saveOptions", userOptions:userOptions});
		return;
	}
	
	if (info.menuItemId === 'clearHistory') {
		userOptions.searchBarHistory = [];
		notify({action: "saveOptions", userOptions:userOptions});
		return;
	}
	
	// clicked Add Custom Search
	if (info.menuItemId === 'add_engine') {
		browser.tabs.sendMessage(tab.id, {action: "openCustomSearch"}, {frameId: 0});		
		return false;
	}
	
	// if searchEngines is empty, open Options
	if (userOptions.searchEngines.length === 0 && userOptions.nodeTree.children.length === 0 ) {	
		browser.runtime.openOptionsPage();
		return false;	
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

	// buildContextMenu();
}

// rebuild menu every time a tab is activated to updated selectdomain info
browser.tabs.onActivated.addListener( async tabInfo => buildContextMenu());

browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
	
	function onFound(tabs) {
		let tab = tabs[0];
		
		if ( tab && tab.id && tabId === tab.id && changeInfo.url && changeInfo.url !== "about:blank" && tab.active)
			buildContextMenu();
	}
	
	function onError(err) { console.error(err) }

	if ( changeInfo.status !== 'complete' ) return;
	
	browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);	
	
});