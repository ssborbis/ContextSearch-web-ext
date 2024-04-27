const ROOT_MENU = "root_menu";
var currentContextMenuContexts = [];

function addMenuItem( createOptions ) {

	createOptions.contexts = createOptions.contexts || contexts;

	try {
		browser.contextMenus.create( createOptions, onCreated);
	} catch (error) { // non-Firefox
		delete createOptions.icons;
		try {
			browser.contextMenus.create( createOptions, onCreated);
		} catch( _error) {
			debug(_error);
		}
	}
}

function onCreated() {

	if (browser.runtime.lastError) {
		if ( browser.runtime.lastError.message.indexOf("ID already exists") === -1 ) debug(browser.runtime.lastError);
	}
}

async function buildContextMenu(searchTerms) {

	debug("buildContextMenu");

	// track selectDomain menus to update later
	window.contextMenuSelectDomainRoots = [];
	window.contextMenuSelectDomainChildren = [];

	// context menu entries need to be tracked to be updated
	window.contextMenuMatchRegexMenus = [];
		
	function traverse(node, parentId, context) {

		let context_prefix = ( context ) ? context + "_" : "";
		
		if (node.hidden) return;
		
		let getTitleWithHotkey = (n) => {
			if ( userOptions.contextMenuHotkeys ) 
				return n.title + (n.hotkey ? ` (&${keyTable[n.hotkey].toUpperCase()})` : "");
			else 
				return n.title;
		}

		if ( node.type === 'searchEngine' || node.type === "siteSearchFolder" ) {

			let se = userOptions.searchEngines.find(se => se.id === node.id);
			
			if (!se) {
				console.log('no search engine found for ' + node.id);
				return;
			}
			
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

				window.contextMenuSelectDomainRoots.push(context_prefix + _id);
								
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
					
					window.contextMenuSelectDomainChildren.push(context_prefix + pathId);
				});

			}
			
		}
		
		if (node.type === 'bookmarklet') {
			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: context_prefix + node.id + '_' + count++,	
				icons: {
					"16": node.icon || browser.runtime.getURL("/icons/code.svg")
				}
			});
		}
		
		if (node.type === 'oneClickSearchEngine') {
			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: context_prefix + node.id + '_' + count++,
				icons: {
					"16": node.icon
				}
			});
		}
		
		if (node.type === 'separator') {
			addMenuItem({
				parentId: parentId,
				type: "separator",
				contexts: ["all"]
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
						id: context_prefix + node.id + "_" + id,
						title: i18n("SearchAll"),
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

		if (node.type === 'externalProgram') {
			addMenuItem({
				parentId: parentId,
				title: getTitleWithHotkey(node),
				id: context_prefix + node.id + '_' + count++,	
				icons: {
					"16": getIconFromNode(node)
				}
			});
		}
		
	}

	function addOptions(context, root) {

		if ( !userOptions.contextMenuShowSettingsFolder ) return;

		context = context || "";
		root = root || "";

		let context_prefix = ( context ) ? context + "_" : "";

		addMenuItem({
			parentId: root,
			title: i18n('settings'),
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
	
	try {
		await browser.contextMenus.removeAll();
	} catch (error) {
		console.log(error);
	}
	
	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	if ( !tab.url ) {
		console.log("Error reading active tab", tab);
	}

	let domainPaths = getDomainPaths(tab.url);

	if (userOptions.contextMenuShowAddCustomSearch) {
		let createProperties = {
			id: "add_engine",
			title: i18n("AddCustomSearch") + getMenuHotkey(),
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

	if (!userOptions.contextMenu) return false;

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
			let seNodes = findNodes(filteredNodeTree, n => ['searchEngine', 'externalProgram', 'oneClickSearchEngine'].includes(n.type) );
			if ( seNodes.length < userOptions.contextMenuContextualLayoutFlattenLimit ) {
				filteredNodeTree.children = seNodes;
			}

			try {

				browser.contextMenus.create({
					id: context,
					title: i18n("SearchForContext", i18n(context).toUpperCase()) + getMenuHotkey(),
					contexts: [context]
				}, onCreated);
			} catch (error) {
				console.log(error);
			}

			// recently used engines
			if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

				let folder = recentlyUsedListToFolder();
				
				if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
					traverse(folder, context, context);
				} else {
				//	root.children.unshift({type: "separator"});

					if ( userOptions.contextMenuShowRecentlyUsedIcon ) 
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

		if ( userOptions.contextMenuUseInnerText ) contexts.push("page", "frame");
		
		// recently used engines
		if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {

			let folder = recentlyUsedListToFolder();
			
			if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {		
				root.children.unshift(folder);
			} else {
				root.children.unshift({type: "separator"});
				if ( userOptions.contextMenuShowRecentlyUsedIcon ) 
					folder.children.forEach( c => c.title = "🕒 " + c.title);		
				root.children = folder.children.concat(root.children);
			}
		}

		// matching regex engines
		 if ( userOptions.contextMenuRegexMatchedEngines ) {
		 	let folder = matchingEnginesToFolder(searchTerms || "");

		 	root.children.unshift(folder);
		}

		try {
			browser.contextMenus.create({
				id: ROOT_MENU,
				title: contextMenuTitle(""),
				contexts: contexts
			}, onCreated);
		} catch (error) {
			console.log(error);
		}

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

	// add options to browser_action menu 
	addMenuItem({
		title: i18n("settings"),	
		icons: {
			"16": "icons/settings.svg"
		},
		contexts: ["browser_action"],
		id: "ba_openOptions"
	});
}

function contextMenuTitle(searchTerms, context) {

	if (searchTerms.length > 18) 
		searchTerms = searchTerms.substring(0,15) + "...";

	// escape &s because of shortcut keys
	searchTerms = searchTerms.replace("&", "&&");
	
	let hotkey = getMenuHotkey(); 

	let title = (userOptions.contextMenuTitle || i18n("SearchFor")).replace("%1", "%s").replace("%s", searchTerms) + hotkey;
	
	if ( !searchTerms ) {
		title = (userOptions.contextMenuTitle || i18n("SearchWith")).replace("%1", "%s") + hotkey;
	//	if ( context === 'selection')
	//		title = (userOptions.searchEngines.length === 0) ? i18n("AddSearchEngines") : hotkey + ( userOptions.contextMenuMessage || i18n("SearchForWithVariable") );
	}

	// if ( context === 'link' ) 
	// 	title = 'Search for URL';
	// else if ( context === 'image')
	// 	title = 'Search for IMAGE';

	//let title = hotkey + (userOptions.contextMenuTitle || i18n("SearchFor")).replace("%1", searchTerms);

	return title;

}

function getMenuHotkey() {
	return userOptions.contextMenuKey ? ` (&${keyTable[userOptions.contextMenuKey].toUpperCase()})` : "";
}

function updateMatchRegexFolders(s) {
	console.log('updateMatchRegexFolders');

	window.contextMenuMatchRegexMenus.forEach( menu => {
		try {
			browser.contextMenus.remove( menu );
		} catch (error) {
			console.log(error);
		}
	});
	window.contextMenuMatchRegexMenus = [];
	contexts.forEach( context => updateMatchRegexFolder(s, context));
}

function updateMatchRegexFolder(s, context) {

	onCreated = () => {
		if (browser.runtime.lastError) {
			if ( browser.runtime.lastError.message.indexOf("ID already exists") === -1 ) console.log(browser.runtime.lastError);
		}
	}

	context = context || "";

	let folder = matchingEnginesToFolder(s);
	
	// only remove if non-contextual
	if ( ! context ) {
		window.contextMenuMatchRegexMenus.forEach( menu => {
			try {
				browser.contextMenus.remove( menu, onCreated );
			} catch(err) {console.log(err)}
		});
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
			browser.contextMenus.create(createOptions, onCreated);
		} catch (error) { // non-Firefox
			delete createOptions.icons;
			try {
				browser.contextMenus.create(createOptions, onCreated);
			} catch ( error ) { console.log(error)}
		}

		window.contextMenuMatchRegexMenus.push(id);
	});
}

async function updateSelectDomains() {

	debug('updating selectDomains');

	// no selectDomain
	if ( !window.contextMenuSelectDomainChildren.length ) return;

	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	if ( !tab.url ) {
		return debug("Error reading active tab", tab);
	}

	let domainPaths = getDomainPaths(tab.url);

	// remove old menu children
	window.contextMenuSelectDomainChildren.forEach(id => browser.contextMenus.remove(id));
	window.contextMenuSelectDomainChildren = [];

	// const _add(parentId) {

	// increment ids
	let count = 0;

	window.contextMenuSelectDomainRoots.forEach(id => {

		debug('updating selectDomain', id);

		let obj = parseSelectDomainMenuId(id);

		if ( !obj ) return;

		let context_prefix = ( obj.context ) ? obj.context + "_" : "";

		let node = findNode(userOptions.nodeTree, n => n.id === obj.id);

		domainPaths.forEach( path => {
			
			let pathId = '__selectDomain__' + node.id + '_' + count++ + "_" + btoa(path);
			
			addMenuItem({
				parentId: id,
				title: path,
				id: context_prefix + pathId,
				icons: {
					"16": tab.favIconUrl || getIconFromNode(node)
				}
			});

			debug('adding selectDomain', context_prefix + pathId);
			
			window.contextMenuSelectDomainChildren.push(context_prefix + pathId);
		});
	});
}

function parseSelectDomainMenuId(id) {
	try {
		let groups = /(?:(.*)_:?)__selectDomain__(.*?)_\d+_(.*)$/.exec(id);
		return {context: groups[1], id: groups[2], domain: atob(groups[3])}
	} catch {}

	try {
		let groups = /(?:(.*)_:?)(\w+)_\d+/.exec(id);
		return {context: groups[1], id: groups[2], domain: null};
	} catch {}

	return null;
}

async function contextMenuSearch(info, tab) {

	// if chrome && get raw text if available
    try {
    	let result = await chrome.tabs.executeScript( {
    		code: "window.getSelection().toString();"
    	});

    	let selection = result[0];
    	if ( selection ) info.selectionText = selection;
    } catch (error) {}

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
		notify({action: "saveUserOptions", userOptions: userOptions, source: "contextMenuSearch"});
		return buildContextMenu();
	}

	if ( info.menuItemId === 'openOptions' ) {
		return notify({action: "openOptions", hashurl: "#contextMenu"});
	}

		if ( info.menuItemId.endsWith('openOptions') ) {
		return notify({action: "openOptions", hashurl: "#engines"});
	}

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

	// if content scripts have run, use window.searchTerms
	// else use fallback code ( not accurate with modifiers )

	let result = [];
	try {
		result = await browser.tabs.executeScript(tab.id, { code: "window.hasRun" });
	} catch (error) {
		console.log(error);
	}
	
	if ( result[0] ) {
		debug('content scripts have run', tab);
		searchTerms = (context ? window.searchTermsObject[context] : window.searchTerms) || window.searchTerms;;
	} else {

		console.error('content scripts have not run in this tab');

		if ( info.selectionText )
			searchTerms = info.selectionText.trim();
		else if ( info.srcUrl )
			searchTerms = info.srcUrl;
		else if ( info.linkUrl ) {
			if ( [info.linkUrl, info.linkText].includes(window.searchTerms) ) // if content_script updated the window.searchTerms var properly, use that
				searchTerms = window.searchTerms;
			else
				searchTerms = ( userOptions.contextMenuSearchLinksAs === 'url' && !window.ctrlKey ) ? info.linkUrl : info.linkText || window.searchTerms;		
		} else if ( userOptions.contextMenuUseInnerText && window.searchTerms.trim() )
			searchTerms = window.searchTerms.trim();
	

		// if using contextual layout, set the search terms according to context
		switch ( context ) {
			case "selection":
				searchTerms = info.selectionText || info.linkText || "";
				break;
			case "link":
				searchTerms = info.linkUrl;
		
				// fails in chrome
				// if ( info.modifiers.includes("Ctrl") && info.modifiers.length == 1) {
				// 	let method = userOptions.contextMenuSearchLinksAs;
				// 	method = method === 'url' ? 'text' : 'url';
				// 	if ( method === 'text') searchTerms = info.linkText;
				// } 
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
	}

	if ( !searchTerms ) return;

	// test for selectdomain
	let obj = parseSelectDomainMenuId(info.menuItemId);
	if ( obj ) {
		info.menuItemId = obj.id;
		info.domain = obj.domain;	
	}

	info.searchTerms = searchTerms;
	info.openMethod = openMethod;
	info.tab = tab;
	info.node = node;

	// check this in all branches
	// if ( !currentContextMenuContexts.length )
	// 	currentContextMenuContexts = [context];

	// filter searchAll children by context
	if ( userOptions.contextMenuUseContextualLayout && node.type === "folder" )
		info.node = filterContexts(node, context);
	
	openSearch(info);
	// domain: info.domain || new URL(tab.url).hostname
}

// update selectdomain info every time a tab is activated to updated
browser.tabs.onActivated.addListener( async tabInfo => {
	debounce(updateSelectDomains, 250, "updateSelectDomainsDebouncer");
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
	
	function onFound(tabs) {
		let tab = tabs[0];
		
		if ( tab && tab.id && tabId === tab.id && tabInfo.url && tabInfo.url !== "about:blank" && tab.active) {
			debounce(buildContextMenu, 250, "buildContextMenuDebouncer");
		}
	}
	
	function onError(err) { console.error(err) }

	if ( changeInfo.status !== 'complete' ) return;
	
	browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);	
	
});