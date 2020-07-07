let isFirefox = /Firefox/.test(navigator.userAgent);

async function notify(message, sender, sendResponse) {
	
	function sendMessageToTopFrame() {
		return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
	}
	
	function sendMessageToAllFrames() {
		return browser.tabs.sendMessage(sender.tab.id, message);
	}
	
	sender = sender || {};
	if ( !sender.tab ) { // page_action & browser_action popup has no tab, use current tab
		let onFound = tabs => sender.tab = tabs[0];
		let onError = err => console.error(err);
		
		await browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);
	}


	// await (() => {
		// sender = sender || {};
		// if ( !sender.tab ) { // page_action & browser_action popup has no tab, use current tab
			// let onFound = tabs => sender.tab = tabs[0];
			// let onError = err => console.error(err);
			
			// return browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);
		// } else
			// return Promise.resolve(true);
	// })();

	switch(message.action) {

		case "saveUserOptions":
			userOptions = message.userOptions;
			return browser.storage.local.set({"userOptions": userOptions}).then(() => {
				notify({action: "updateUserOptions"});
			});
			break;
			
		case "updateUserOptions":
			return Promise.resolve(async () => {
				let tabs = await getAllOpenTabs();
				for (let tab of tabs) {
					browser.tabs.sendMessage(tab.id, {"userOptions": userOptions}).catch( error => {/*console.log(error)*/});	
				}
				buildContextMenu();
			});
			break;
			
		case "openOptions":
			browser.tabs.create({
				url: browser.runtime.getURL("/options.html" + (message.hashurl || "")) 
			});
			break;
			
		case "quickMenuSearch":
			return quickMenuSearch(message.info, sender.tab);
			break;
			
		case "enableContextMenu":
			userOptions.contextMenu = true;
			buildContextMenu();
			break;
			
		case "getUserOptions":
			return Promise.resolve({"userOptions": userOptions});
			break;
			
		case "getDefaultUserOptions":
			return Promise.resolve({"defaultUserOptions": defaultUserOptions});
			break;

		case "getSearchEngineById":
			if ( !message.id) return;

			return Promise.resolve({"searchEngine": userOptions.searchEngines.find(se => se.id === message.id)});
			break;
			
		case "dispatchEvent":
			return browser.tabs.executeScript(sender.tab.id, {
				code: `document.dispatchEvent(new CustomEvent("${message.e}"));`,
				allFrames: true
			});
			break;

		case "openQuickMenu":
			return sendMessageToTopFrame();
			break;
			
		case "closeQuickMenuRequest":
			return sendMessageToTopFrame();
			break;
		
		case "quickMenuIframeLoaded":
			return sendMessageToTopFrame();
			break;
		
		case "updateQuickMenuObject":
			return sendMessageToAllFrames();
			break;
			
		case "lockQuickMenu":
			return sendMessageToTopFrame();
			break;
			
		case "unlockQuickMenu":
			return sendMessageToTopFrame();
			break;
			
		case "rebuildQuickMenu":
			return sendMessageToTopFrame();
			break;
			
		case "closeWindowRequest":
			return browser.windows.remove(sender.tab.windowId);
			break;
		
		case "closeCustomSearch":
			return sendMessageToTopFrame();
			break;
			
		case "openFindBar":
			if ( userOptions.highLight.findBar.openInAllTabs ) {
				let _message = Object.assign({}, message);
				
				if ( !userOptions.highLight.findBar.searchInAllTabs )
					_message.searchTerms = "";
				
				return new Promise(async (resolve) => {
					let tabs = await getAllOpenTabs();
					tabs.forEach( tab => {
						browser.tabs.sendMessage(tab.id, ( tab.id !== sender.tab.id ) ? _message : message, {frameId: 0});
					});
					resolve();
				});
			} else
				return sendMessageToTopFrame();
			break;
			
		case "closeFindBar":
			if ( userOptions.highLight.findBar.openInAllTabs ) {
				return new Promise(async(resolve) => {
					let tabs = await getAllOpenTabs();
					tabs.forEach( tab => browser.tabs.sendMessage(tab.id, message, {frameId: 0}));
					resolve();
				});
			} else
				return sendMessageToTopFrame();
			break;
			
		case "updateFindBar":
			return sendMessageToTopFrame();
			break;
			
		case "findBarNext":
			return sendMessageToTopFrame();
			break;
			
		case "findBarPrevious":
			return sendMessageToTopFrame();
			break;
		
		case "getFindBarOpenStatus":
			return browser.tabs.executeScript(sender.tab.id, {
				code: "getFindBar() ? true : false;"
			});
			break;

		case "mark":
			return new Promise( async (resolve) => {
				if ( message.findBarSearch && userOptions.highLight.findBar.searchInAllTabs ) {
					let tabs = await getAllOpenTabs();
					tabs.forEach( tab => browser.tabs.sendMessage(tab.id, message));
					resolve(true);
				} else {
					resolve(sendMessageToAllFrames());
				}
			});
			break;
			
		case "unmark":
			return sendMessageToAllFrames();
			break;
		
		case "findBarUpdateOptions":
			return sendMessageToTopFrame();
			break;

		case "markDone":
			return sendMessageToTopFrame();
			break;
			
		case "toggleNavBar":
			return sendMessageToTopFrame();
			break;
			
		case "closeSideBar":
			return sendMessageToTopFrame();
			break;
		
		case "sideBarHotkey":
			return sendMessageToTopFrame();
			break;
			
		case "getOpenSearchHref":
		
			return new Promise( async resolve => {
				let tab = await browser.tabs.query({currentWindow: true, active: true});
				let result = await browser.tabs.executeScript( tab.id, {
					code: "document.querySelector('link[type=\"application/opensearchdescription+xml\"]').href"
				});
				
				result = result.shift();
				resolve( result ? {href: result} : {} );
			});

			break;

		case "updateSearchTerms":
			window.searchTerms = message.searchTerms;
			
			if ( userOptions.autoCopy && message.searchTerms )
				notify({action: "copy", msg: message.searchTerms});
			
			return browser.tabs.sendMessage(sender.tab.id, message, {frameId: 0});
			break;
			
		case "updateContextMenu":
		
			var searchTerms = message.searchTerms;
			
			window.searchTerms = searchTerms;

			if (searchTerms === '') {
				browser.contextMenus.update("search_engine_menu", {visible:false});
				break;
			}
			
			if (searchTerms.length > 18) 
				searchTerms = searchTerms.substring(0,15) + "...";
			
			let hotkey = ''; 
			if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';
			
			let title = hotkey + browser.i18n.getMessage("SearchFor").replace("%1", searchTerms);

			browser.contextMenus.update("search_engine_menu", {visible: true, title: title});

			break;
			
		case "addSearchEngine":
			let url = message.url;

			if (true) {
				browser.tabs.executeScript(sender.tab.id, {
					file: "addSearchProvider.js",
					frameId:0
				}).then(() => {
					browser.tabs.executeScript(sender.tab.id, {
					code: `addSearchProvider("${url}");`,
					frameId:0
				});});
			}
			
			window.external.AddSearchProvider(url);
			break;
		
		case "addContextSearchEngine":
		
			let se = message.searchEngine;
			
			console.log(se);
			
			let index = userOptions.searchEngines.findIndex( se2 => se.title === se2.title );
			
			if (index !== -1) {
				sendResponse({errorMessage: 'Name must be unique. Search engine already exists'});
				return;
			}
			
			se.id = gen();

			userOptions.searchEngines.push(se);
			userOptions.nodeTree.children.push({
				type: "searchEngine",
				title: se.title,
				id: se.id,
				hidden: false
			});

			notify({action: "saveOptions", userOptions:userOptions});
			
			break;
			
		case "removeContextSearchEngine":

			if ( !message.id ) return;

			index = userOptions.searchEngines.findIndex( se => se.id === message.id );
			
			if (index === -1) {
				console.log('index not found');
				return;
			}
			
			userOptions.searchEngines.splice(index, 1);
	
			notify({action: "saveOptions", userOptions:userOptions});
			
			break;
			
		case "testSearchEngine":
			
			openSearch({
				searchTerms: message.searchTerms,
				tab: sender.tab,
				temporarySearchEngine: message.tempSearchEngine
			});

			break;
			
		case "enableAddCustomSearchMenu":

			if (!userOptions.contextMenuShowAddCustomSearch) return;

			browser.contextMenus.create({
				id: "add_engine",
				title: browser.i18n.getMessage("AddCustomSearch"),
				contexts: ["editable"]
			}, () => {
				if (browser.runtime.lastError)
					console.log(browser.runtime.lastError);
			});

			break;
		
		case "disableAddCustomSearchMenu":
			
			browser.contextMenus.remove("add_engine").then(() => {
			}, () => {
				if (browser.runtime.lastError)
					console.log(browser.runtime.lastError);
			});
			break;

		case "log":
			console.log(message.msg);
			break;
			
		case "focusSearchBar":
			browser.tabs.sendMessage(sender.tab.id, message);
			break;
			
		case "setLastSearch":
			sessionStorage.setItem("lastSearch", message.lastSearch);
			break;
			
		case "getLastSearch":
			return Promise.resolve({lastSearch: sessionStorage.getItem("lastSearch")});
			break;
			
		case "getCurrentTheme":
			browser.theme.getCurrent().then( theme => {
				console.log(theme);
			});
			break;
			
		case "executeTestSearch":

			var searchTerms = encodeURIComponent(message.searchTerms);
			var searchRegex = new RegExp(searchTerms + "|" + searchTerms.replace(/%20/g,"\\+") + "|" + searchTerms.replace(/%20/g,"_"), 'g');
			
			var timeout = Date.now();

			let urlCheckInterval = setInterval( () => {
				browser.tabs.get(sender.tab.id).then( tabInfo => {
					
					if (tabInfo.status !== 'complete') return;

					if ( searchRegex.test(tabInfo.url) ) {
						
						clearInterval(urlCheckInterval);
						
						let newUrl = tabInfo.url.replace(searchRegex, "{searchTerms}");
						
						let se = message.badSearchEngine;
						
						se.template = se.query_string = newUrl;

						browser.tabs.sendMessage(tabInfo.id, {action: "openCustomSearch", searchEngine: se}, {frameId: 0});
					}
					
					// No recognizable GET url. Prompt for advanced options
					if (Date.now() - timeout > 5000) {

						console.log('urlCheckInterval timed out');
						browser.tabs.sendMessage(tabInfo.id, {action: "openCustomSearch", timeout: true}, {frameId: 0});
						clearInterval(urlCheckInterval);
					}

				});
			}, 1000);
			
			return true;
			
			break;
			
		case "copy":
			return new Promise(async (r) => {
				try {
					await navigator.clipboard.writeText(message.msg);
					r(true);
				} catch (error) {
					r(false);
				}
			});
			break;
			
		case "hasBrowserSearch":
			return Promise.resolve(typeof browser.search !== 'undefined');
			break;
			
		case "checkForOneClickEngines":	
			return checkForOneClickEngines();
			break;
			
		case "getCurrentTabInfo": 
			return Promise.resolve(sender.tab);
			break;
		
		case "removeTabHighlighting":
		
			let tabId = message.tabId || sender.tab.id;
			highlightTabs.findIndex( (hl, i) => {
				if (hl.tabId === tabId) {
					highlightTabs.splice(i, 1);
					console.log('removing tabId ' + tabId + ' from array');
					return true;
				}
			});

			break;
			
		case "dataToSearchEngine":
			return dataToSearchEngine(message.formdata);
			break;
			
		case "openSearchUrlToSearchEngine":
			return readOpenSearchUrl(message.url).then( xml => {
				if ( !xml ) return false;
				
				return openSearchXMLToSearchEngine(xml);
			});
			break;
		
		case "showNotification":
			return browser.tabs.executeScript(sender.tab.id, {
				code: `showNotification("${message.msg}")`
			});
			break;
			
		case "getTabQuickMenuObject":
			return browser.tabs.executeScript(sender.tab.id, {
				code: `quickMenuObject;`
			});
			break;
		
		case "addToHistory":
	
			let terms = message.searchTerms.trim();
			
			if ( !terms ) return;

			// send last search to backgroundPage for session storage
			// browser.runtime.sendMessage({action: "setLastSearch", lastSearch: terms});
			notify({action: "setLastSearch", lastSearch: terms});
			
			// return if history is disabled
			if ( ! userOptions.searchBarEnableHistory ) return;
			
			// if (userOptions.searchBarHistory.includes(terms)) return;
			
			// remove first entry if over limit
			if (userOptions.searchBarHistory.length >= userOptions.searchBarHistoryLength) {
				userOptions.searchBarHistory.shift();
			}
			
			// add new term
			userOptions.searchBarHistory.push(terms);
			
			// ignore duplicates
			userOptions.searchBarHistory = [...new Set([...userOptions.searchBarHistory].reverse())].reverse();
			
			// update prefs
		//	browser.runtime.sendMessage({action: "saveUserOptions", "userOptions": userOptions});
			notify({action: "saveUserOptions", "userOptions": userOptions});
			return Promise.resolve(userOptions);
			break;
			
		case "setLastOpenedFolder":
			window.lastOpenedFolder = message.folderId;
			return true;
			break;
			
		case "getLastOpenedFolder":
			return window.lastOpenedFolder || null;
			break;
			
		case "injectComplete":
			if ( userOptions.quickMenu ) {
				browser.tabs.executeScript(sender.tab.id, {
					file: "inject_quickmenu.js",
					frameId: sender.frameId
				});
			}
			
			break;
	}
}

// async function injectHighlighting(tabId) {
	// let result = await browser.tabs.executeScript(tabId, {
		// code: "typeof CS_MARK_instance !== 'undefined';"
	// });
	
	// if ( !result ) return;
	
	// let hasInjected = result.shift();

	// if ( !hasInjected ) {
		// await browser.tabs.executeScript(tabId, {
			// file: "lib/mark.es6.min.js",
			// allFrames: true
		// });
		// await browser.tabs.executeScript(tabId, {
			// file: "inject_highlight.js",
			// allFrames: true
		// });
	// }
// }

function updateUserOptionsObject(uo) {
// Update default values instead of replacing with object of potentially undefined values
	function traverse(defaultobj, userobj) {
		for (let key in defaultobj) {
			userobj[key] = (userobj[key] !== undefined) ? userobj[key] : defaultobj[key];

			if ( defaultobj[key] instanceof Object && Object.getPrototypeOf(defaultobj[key]) == Object.prototype && key !== 'nodeTree' )
				traverse(defaultobj[key], userobj[key]);
		}
	}

	traverse(defaultUserOptions, uo);
	
	return uo;
}

function loadUserOptions() {
	
	function onGot(result) {
		
		// no results found, use defaults
		if ( !result.userOptions ) {
			userOptions = Object.assign({}, defaultUserOptions);
			return false;
		}

		userOptions = updateUserOptionsObject( result.userOptions );

		return true;
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.storage.local.get("userOptions");
	return getting.then(onGot, onError).then(buildContextMenu);
}

async function buildContextMenu() {
	
	window.contextMenuSelectDomainMenus = [];
	
	function onCreated() {

		if (browser.runtime.lastError) {
			if ( browser.runtime.lastError.message.indexOf("ID already exists") === -1 ) console.log(browser.runtime.lastError);
		}
	}
	
	function addMenuItem( createOptions ) {

		createOptions.contexts = createOptions.contexts || ["selection", "link", "image"];

		if (!isFirefox) delete createOptions.icons;

		browser.contextMenus.create( createOptions, onCreated);
	}
	
	await browser.contextMenus.removeAll();
	
	let tabs = await browser.tabs.query({currentWindow: true, active: true});
	let tab = tabs[0];

	if (!userOptions.contextMenu) return false;
	
	let hotkey = ''; 
	if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';

	browser.contextMenus.create({
		id: "search_engine_menu",
		title: (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + browser.i18n.getMessage("SearchWith"),
		contexts: ["selection", "link", "image"]
	});

	let root = Object.assign({}, userOptions.nodeTree);

	if (!root.children) return;

	let id = 0;
	delete root.id;

	// add incremental menu ids to avoid duplicates
	let count = 0;
	
	// last used engine
	let lse = findNode(userOptions.nodeTree, node => node.id === userOptions.lastUsedId);
	
	if ( lse ) {
		
		let icon = function() {
			switch (lse.type) {
				case "searchEngine":
					let se = userOptions.searchEngines.find(_se => _se.id === lse.id);
					return se.icon_base64String;
				case "oneClickSearchEngine":
					return lse.icon;
				default:
					return "";
			}
		}() || browser.runtime.getURL('icons/search.svg');

		addMenuItem({
			parentId: "search_engine_menu",
			title: lse.title + "    ⭮",
			id: lse.id,	
			icons: {
				"16": icon
			}
		});

		browser.contextMenus.create({
			parentId: "search_engine_menu",
			type: "separator"
		});
	}
	
	function traverse(node, parentId) {
		
		if (node.hidden) return;

		if ( node.type === 'searchEngine' ) {

			let se = userOptions.searchEngines.find(se => se.id === node.id);
			
			if (!se) {
				console.log('no search engine found for ' + node.id);
				return;
			}
			
			let _id = se.id + '_' + count++;

			addMenuItem({
				parentId: parentId,
				title: se.title,
				id: _id,	
				icons: {
					"16": se.icon_base64String || se.icon_url || "/icons/icon48.png"
				}
			});

			if ( /{selectdomain}/.test( se.template ) ) {
				
				let pathIds = [];
				
				getDomainPaths(tab.url).forEach( path => {
					
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
				title: node.title,
				id: node.id + '_' + count++,	
				icons: {
					"16": node.icon || browser.runtime.getURL("/icons/code.svg")
				}
			});
		}
		
		if (node.type === 'oneClickSearchEngine') {
			addMenuItem({
				parentId: parentId,
				title: node.title,
				id: "__oneClickSearchEngine__" + node.id + '_' + count++,
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
			
			addMenuItem({
				parentId: parentId,
				id: _id,
				title: node.title,
				icons: {
					"16": "/icons/folder-icon.png"
				}
			});
			
			for (let child of node.children) {
				traverse(child, _id);
			}
		}
		
	}
	
	root.children.forEach( child => traverse(child, "search_engine_menu") );

}

function updateSelectDomainMenus(tab) {
	
	if (!window.contextMenuSelectDomainMenus ) return;
	
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
				contexts: ["selection", "link", "image"]
			};

			if (!isFirefox) delete createOptions.icons;

			browser.contextMenus.create( createOptions );
		});
	});
}

// rebuild menu every time a tab is activated to updated selectdomain info
browser.tabs.onActivated.addListener( async tabInfo => {
	let tab = await browser.tabs.get( tabInfo.tabId );
	updateSelectDomainMenus(tab);
	
	// reset the root menu
	let hotkey = ''; 
	if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';
	
	browser.contextMenus.update("search_engine_menu", {
		title: (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + browser.i18n.getMessage("SearchWith")
	});
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
	
	function onFound(tabs) {
		let tab = tabs[0];
		
		if ( tabId === tab.id && changeInfo.url && changeInfo.url !== "about:blank" ) 
			updateSelectDomainMenus(tab);
	}
	
	function onError(err) { console.error(err) }
	
	browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);	
	
});

browser.contextMenus.onClicked.addListener(contextMenuSearch);

function executeBookmarklet(info, tab) {
	
	if (!browser.bookmarks) {
		console.error('No bookmarks permission');
		return;
	}
	// run as bookmarklet
	browser.bookmarks.get(info.menuItemId).then( bookmark => {
		bookmark = bookmark.shift();
		
		if (!bookmark.url.startsWith("javascript")) { // assume bookmark
			switch (info.openMethod) {
				case "openCurrentTab":
					browser.tabs.getCurrent().then( tab => {
						browser.tabs.update(tab.id, { url: bookmark.url });
					});
					break;
				case "openNewTab":
					return browser.tabs.create({
						active: true,
						url: bookmark.url
					});
					break;
				case "openNewWindow":
					return browser.windows.create({
						incognito: false,
						url: bookmark.url
					});
					break;
				case "openNewIncognitoWindow":
					return browser.windows.create({
						incognito: true,
						url: bookmark.url
					});
					break;
				case "openBackgroundTab":
				case "openBackgroundTabKeepOpen":
					return browser.tabs.create({
						active: false,
						url: bookmark.url
					});
					break;
				case "openSideBarAction":
					async function openSideBarAction() {
				
						if ( !browser.sidebarAction ) return;
						
						await browser.sidebarAction.setPanel( {panel: bookmark.url} );
							
						if ( !await browser.sidebarAction.isOpen({}) )
							notify({action: "showNotification", msg: browser.i18n.getMessage('NotificationOpenSidebar')}, {});
							
					}
					openSideBarAction();
					break;
			}
	
		//	console.error('bookmark not a bookmarklet');
			return false;
		}
		
		console.log(window.searchTerms, info.selectionText);

		browser.tabs.query({currentWindow: true, active: true}).then( async tabs => {
			let code = decodeURI(bookmark.url);
			
			await browser.tabs.executeScript(tabs[0].id, {
				code: 'CS_searchTerms = `' + ( window.searchTerms || escapeDoubleQuotes(info.selectionText) ) + '`;'
			});
			
			await browser.tabs.executeScript(tabs[0].id, {
				code: code
			});
		});

	}, error => {
		console.error(error);
	});
}

function executeOneClickSearch(info) {

	let searchTerms = info.selectionText;
	let openMethod = info.openMethod;
		
	let engineId = info.menuItemId.replace("__oneClickSearchEngine__", "");
	let engineName = findNodes( userOptions.nodeTree, node => node.id === engineId )[0].title;
	
	function searchAndHighlight(tab) {
		browser.search.search({
			query: searchTerms,
			engine: engineName,
			tabId: tab.id
		});
		
		browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, __tab) {
			
			if ( tabId !== tab.id ) return;
		
			if ( changeInfo.status !== 'complete' || changeInfo.url === 'about:blank' ) return;
			
			highlightSearchTermsInTab(__tab, searchTerms);
			browser.tabs.onUpdated.removeListener(listener);
		});
	}
	
	switch (openMethod) {
		case "openCurrentTab":
			browser.tabs.getCurrent().then( tab => {
				searchAndHighlight(tab);
			});
			break;
		case "openNewTab":
			return browser.tabs.create({
				active: true,
				url: browser.runtime.getURL("blank.html")
			}).then( (tab) => {
				searchAndHighlight(tab);
			});
			break;
		case "openNewWindow":
			return browser.windows.create({
				incognito: false
			}).then( (tab) => {
				
				// if new window
				if (tab.tabs) tab = tab.tabs[0];
				
				searchAndHighlight(tab);
			});
			break;
		case "openNewIncognitoWindow":
			return browser.windows.create({
				incognito: true
			}).then( (tab) => {
				
				// if new window
				if (tab.tabs) tab = tab.tabs[0];
				
				searchAndHighlight(tab);
			});
			break;
		case "openBackgroundTab":
		case "openBackgroundTabKeepOpen":
			return browser.tabs.create({
				active: false,
				url: browser.runtime.getURL("blank.html")
			}).then( (tab) => {
				searchAndHighlight(tab);
			});
			break;
		case "openSideBarAction":
			console.log("one-click search engines cannot be used with sidebaraction");
			break;
	}

}

function contextMenuSearch(info, tab) {
	
	// remove incremental menu ids
	info.menuItemId = info.menuItemId.replace(/_\d+$/, "");
	
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
	if (!info.selectionText && info.srcUrl)
		searchTerms = info.srcUrl;
	else if (info.linkUrl && !info.selectionText)
		searchTerms = userOptions.contextMenuSearchLinksAs === 'url' ? info.linkUrl : info.linkText || window.searchTerms;
	else 
		searchTerms = info.selectionText.trim();
	
	if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith("__oneClickSearchEngine__") ) {
		info.selectionText = searchTerms;
		info.openMethod = openMethod;
		executeOneClickSearch(info);
		
		userOptions.lastUsedId = info.menuItemId.replace("__oneClickSearchEngine__", "");
		buildContextMenu();
		return false;
	}
	
	if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith("__selectDomain__") ) {
		let groups = /__selectDomain__(.*?)_\d+_(.*)$/.exec(info.menuItemId);
		info.menuItemId = groups[1];
		info.domain = atob(groups[2]);	
	}
	
	// run as bookmarklet
	if (browser.bookmarks !== undefined && !userOptions.searchEngines.find( se => se.id === info.menuItemId ) ) {
		executeBookmarklet(info);
		return false;
	}

	openSearch({
		searchEngineId: info.menuItemId, 
		searchTerms: searchTerms,
		openMethod: openMethod, 
		tab: tab,
		domain: info.domain || new URL(tab.url).hostname
	});
	
	userOptions.lastUsedId = info.menuItemId;
	buildContextMenu();
}

function quickMenuSearch(info, tab) {
	
	// run as one-click search
	if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith("__oneClickSearchEngine__") ) {
		executeOneClickSearch(info);
		return false;
	}
	
	// run as bookmarklet
	if (browser.bookmarks !== undefined && !userOptions.searchEngines.find( se => se.id === info.menuItemId ) && !info.openUrl ) {
		executeBookmarklet(info, tab);
		return Promise.resolve(false);
	}
	
	return openSearch({
		searchEngineId: info.menuItemId, 
		searchTerms: info.selectionText,
		openMethod: info.openMethod, 
		tab: tab,
		openUrl: info.openUrl || null,
		folder: info.folder,
		domain: info.domain
	});
}

function openSearch(details) {
	
	if (!details.folder) delete window.folderWindowId;
	
	console.log(details);
	var searchEngineId = details.searchEngineId || null;
	var searchTerms = (details.searchTerms) ? details.searchTerms.trim() : "";
	var openMethod = details.openMethod || "openNewTab";
	var tab = details.tab || null;
	var openUrl = details.openUrl || false;
	var temporarySearchEngine = details.temporarySearchEngine || null; // unused now | intended to remove temp engine
	var domain = details.domain || null;

	if ( !temporarySearchEngine && searchEngineId === null ) return false;

	if (!tab) tab = {url:"", id:0}
	
	var se;

	if (!openUrl) {

		// if temp engine exists, use that
		se = temporarySearchEngine || userOptions.searchEngines.find(se => se.id === searchEngineId);

		// must be invalid
		if ( !se || !se.query_string) return false;

		// legacy fix
		se.queryCharset = se.queryCharset || "UTF-8";
		
		if (se.searchRegex && !openUrl) {
			try {
				let lines = se.searchRegex.split(/\n/);
				lines.forEach( line => {
					let parts = JSON.parse('[' + line.trim() + ']');
					let _find = new RegExp(parts[0], parts[2] || 'g');
					let _replace = parts[1];
					let newSearchTerms = searchTerms.replace(_find, _replace);
					
					console.log("regex", searchTerms + " -> " + newSearchTerms);
					searchTerms = newSearchTerms;
				});
			} catch (error) {
				console.error("regex replace failed");
			}
		}

		var encodedSearchTermsObject = encodeCharset(searchTerms, se.queryCharset);
		
		var q = replaceOpenSearchParams({template: se.query_string, searchterms: encodedSearchTermsObject.uri, url: tab.url, domain: domain});
		
		// set landing page for POST engines
		if ( 
			!searchTerms || // empty searches should go to the landing page also
			(typeof se.method !== 'undefined' && se.method === "POST") // post searches should go to the lander page
		) {
			
			if ( se.searchForm )
				q = se.searchForm;
			else {
				let url = new URL(se.template);
				q = url.origin + url.pathname;
			}
			
		}
	}
	
	// if using Open As Link from quick menu
	if (openUrl) {
		q = searchTerms;
		if (searchTerms.match(/^.*:\/\//) === null)
			q = "http://" + searchTerms;
	}
	
	switch (openMethod) {
		case "openCurrentTab":
			return openCurrentTab();
			break;
		case "openNewTab":
			return openNewTab();
			break;
		case "openNewWindow":
			return openNewWindow();
			break;
		case "openNewIncognitoWindow":
			return openNewWindow(true);
			break;
		case "openBackgroundTab":
		case "openBackgroundTabKeepOpen":
			return openBackgroundTab();
			break;
		case "openSideBarAction":
			openSideBarAction();
			break;
	}
	
	function executeSearchCode(tabId) {
		if ( !se.searchCode ) return;
		
		browser.tabs.executeScript(tabId, {
			code: `searchTerms = "${escapeDoubleQuotes(searchTerms)}"; ${se.searchCode}`,
			runAt: 'document_idle'
		});
	}
	
	function onCreate(_tab) {

		// if new window
		if (_tab.tabs) {
			window.folderWindowId = _tab.id;
			_tab = _tab.tabs[0];
			
			console.log('window created');
		}

		browser.tabs.onUpdated.addListener(async function listener(tabId, changeInfo, __tab) {
			
			if ( tabId !== _tab.id ) return;
	
			let landing_url = new URL(q);
			let current_url = new URL(__tab.url);
			
			if (current_url.hostname !== landing_url.hostname) return;

			// non-POST should wait to complete
			if (typeof se.method === 'undefined' || se.method !== "POST" || !searchTerms) {

				if ( changeInfo.status !== 'complete' ) return;
				
				highlightSearchTermsInTab(__tab, searchTerms);
				browser.tabs.onUpdated.removeListener(listener);
				
				executeSearchCode(_tab.id);
				
				return;
			}
			
			browser.tabs.onUpdated.removeListener(listener);

			let promises = ['/lib/browser-polyfill.min.js', '/opensearch.js', '/post.js'].map( async (file) => {
				await browser.tabs.executeScript(_tab.id, {
					file: file,
					runAt: 'document_start'
				});
			});
			
			await Promise.all(promises);
			
			let _se = temporarySearchEngine || userOptions.searchEngines.find(__se => __se.id === searchEngineId )
				
			browser.tabs.executeScript(_tab.id, {
				code: `
					let se = ${JSON.stringify(_se)};
					let _SEARCHTERMS = "${escapeDoubleQuotes(searchTerms)}";
					post(se.template, se.params);
					`,
				runAt: 'document_start'
			});
	
			// listen for the results to complete
			browser.tabs.onUpdated.addListener(function _listener(_tabId, _changeInfo, _tabInfo) {
					
				if ( _tabId !== _tab.id ) return;

				if ( _tabInfo.status !== 'complete' ) return;
				browser.tabs.onUpdated.removeListener(_listener);
				
				// send new tab based on results tabId
				highlightSearchTermsInTab(_tabInfo, searchTerms);
				
				executeSearchCode(_tabId);
			});
		});
	}
	
	function onError() {
		console.log(`Error: ${error}`);
	}
			
	function openCurrentTab() {
		
		var creating = browser.tabs.update({
			url: q,
			openerTabId: tab.id
		});
		return creating.then(onCreate, onError);
	} 
	function openNewWindow(incognito) {	// open in new window

		var creating = browser.windows.create({
			url: q,
			incognito: incognito || false
		});
		return creating.then(onCreate, onError);
	} 
	function openNewTab(inBackground) {	// open in new tab
	
		inBackground = inBackground || false;

		var creating = browser.tabs.create({
			url: q,
			active: !inBackground,
			openerTabId: (details.folder ? null : (tab.id || null))
		});

		return creating.then(onCreate, onError);

	}	
	function openBackgroundTab() {
		return openNewTab(true);
	}
	async function openSideBarAction() {

		if ( !browser.sidebarAction ) return;
		
		await browser.sidebarAction.setPanel( {panel: null} ); // forefox appears to ignore subsequent calls to setPanel if old url = new url, even in cases of differing #hash
		
		await browser.sidebarAction.setPanel( {panel: q} );
			
		if ( !await browser.sidebarAction.isOpen({}) )
			notify({action: "showNotification", msg: browser.i18n.getMessage('NotificationOpenSidebar')}, {});
	}
}

function escapeDoubleQuotes(str) {
	if ( !str ) return str;
	return str.replace(/\\([\s\S])|(")/g,"\\$1$2");
}

var highlightTabs = [];

function highlightSearchTermsInTab(tab, searchTerms) {
	
	if ( !tab ) return;

	if ( !userOptions.highLight.enabled ) return;
	
	// show the page_action for highlighting
	if ( browser.pageAction ) {
		browser.pageAction.show(tab.id);
		browser.pageAction.onClicked.addListener( tab => {
			notify({action: "unmark"});
			notify({action: "removeTabHighlighting", tabId: tab.id});
			browser.pageAction.hide(tab.id);
		});
	}

	return browser.tabs.executeScript(tab.id, {
		code: `document.dispatchEvent(new CustomEvent("CS_markEvent", {detail: {type: "searchEngine", searchTerms: "`+ escapeDoubleQuotes(searchTerms) + `"}}));`,
		runAt: 'document_idle',
		allFrames: true
	}).then( () => {
		if ( userOptions.highLight.followDomain || userOptions.highLight.followExternalLinks ) {
			
			let url = new URL(tab.url);

			let obj = {tabId: tab.id, searchTerms: searchTerms, domain: url.hostname};
			
			if ( ! highlightTabs.find( ht => JSON.stringify(obj) === JSON.stringify(ht) ) )
				highlightTabs.push(obj);
		}
	});
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

	if ( !userOptions.highLight.followDomain && !userOptions.highLight.followExternalLinks ) return;

	if ( changeInfo.status !== 'complete' || tab.url === 'about:blank') return;
	
	// console.log(highlightTabs);
	
	let url = new URL(tab.url);

	let highlightInfo = highlightTabs.find( ht => ( ht.tabId === tabId || ht.tabId === tab.openerTabId ) && ( ( userOptions.highLight.followExternalLinks && ht.domain !== url.hostname ) || ( userOptions.highLight.followDomain && ht.domain === url.hostname ) ) );
	
	if ( highlightInfo ) {
		console.log('found openerTabId ' + tab.openerTabId + ' in hightlightTabs');
		highlightSearchTermsInTab(tab, highlightInfo.searchTerms);
	}
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
	notify({action: "removeTabHighlighting", tabId: tabId});
});

function getAllOpenTabs() {
	
	function onGot(tabs) { return tabs; }
	function onError(error) { console.log(`Error: ${error}`); }

	var querying = browser.tabs.query({});
	return querying.then(onGot, onError);
}

function encodeCharset(string, encoding) {

	try {
		
		if ( encoding.toLowerCase() === "none" )
			return {ascii: string, uri: string};
		
		if (encoding.toLowerCase() === 'utf-8') 
			return {ascii: string, uri: encodeURIComponent(string)};
		
		let uint8array = new TextEncoder(encoding, { NONSTANDARD_allowLegacyEncoding: true }).encode(string);
		let uri_string = "", ascii_string = "";
		
		for (let uint8 of uint8array) {
			let c = String.fromCharCode(uint8);
			ascii_string += c;
			uri_string += (c.match(/[a-zA-Z0-9\-_.!~*'()]/) !== null) ? c : "%" + uint8.toString(16).toUpperCase();
		}

		return {ascii: ascii_string, uri: uri_string};
	} catch (error) {
		console.log(error.message);
		return {ascii: string, uri: string};
	}
}

function updateUserOptionsVersion(uo) {

	// v1.1.0 to v 1.2.0
	return browser.storage.local.get("searchEngines").then( result => {
		if (typeof result.searchEngines !== 'undefined') {
			console.log("-> 1.2.0");
			uo.searchEngines = result.searchEngines || uo.searchEngines;
			browser.storage.local.remove("searchEngines");
		}
		
		return uo;
	}).then( _uo => {
	
		// v1.2.4 to v1.2.5
		if (_uo.backgroundTabs !== undefined && _uo.swapKeys !== undefined) {
			
			console.log("-> 1.2.5");
			
			if (_uo.backgroundTabs) {
				_uo.contextMenuClick = "openBackgroundTab";
				_uo.quickMenuLeftClick = "openBackgroundTab";
			}
			
			if (_uo.swapKeys) {
				_uo.contextShift = [_uo.contextCtrl, _uo.contextCtrl = _uo.contextShift][0];
				_uo.quickMenuShift = [_uo.quickMenuCtrl, _uo.quickMenuCtrl = _uo.quickMenuShift][0];
			}
			
			delete _uo.backgroundTabs;
			delete _uo.swapKeys;
			
		}
		
		return _uo;
		
	}).then( _uo => {
	
		//v1.5.8
		if (_uo.quickMenuOnClick !== undefined) {
			
			console.log("-> 1.5.8");
			
			if (_uo.quickMenuOnClick)
				_uo.quickMenuOnMouseMethod = 'click';
			
			if (_uo.quickMenuOnMouse)
				_uo.quickMenuOnMouseMethod = 'hold';
			
			if (_uo.quickMenuOnClick || _uo.quickMenuOnMouse)
				_uo.quickMenuOnMouse = true;
			
			delete _uo.quickMenuOnClick;
		}
		
		return _uo;

	}).then( _uo => {
		
		if (browser.bookmarks === undefined) return _uo;

		if (browser.i18n.getMessage("ContextSearchMenu") === "ContextSearch Menu") return _uo;
		
		console.log("-> 1.6.0");
		
		browser.bookmarks.search({title: "ContextSearch Menu"}).then( bookmarks => {

			if (bookmarks.length === 0) return _uo;

			console.log('New locale string for bookmark name. Attempting to rename');
			return browser.bookmarks.update(bookmarks[0].id, {title: browser.i18n.getMessage("ContextSearchMenu")}).then(() => {
				console.log(bookmarks[0]);
			}, error => {
				console.log(`An error: ${error}`);
			});

		});
		
		return _uo;
	}).then( _uo => {

		// version met
		if (_uo.nodeTree.children) return _uo;
	
		console.log("-> 1.8.0");
	
		function buildTreeFromSearchEngines() {
			let root = {
				title: "/",
				type: "folder",
				children: [],
				hidden: false
			}

			for (let se of _uo.searchEngines) {
				root.children.push({
					type: "searchEngine",
					title: se.title,
					hidden: se.hidden || false,
					id: se.id
				});
			}
			
			return root;
		}

		// generate unique id for each search engine
		for (let se of _uo.searchEngines)
			se.id = gen();

		// neither menu uses bookmarks, build from search engine list
		if (!_uo.quickMenuBookmarks && !_uo.contextMenuBookmarks) {
			let root = buildTreeFromSearchEngines();
			_uo.nodeTree = root;
			return _uo;
		}  	
		
		// both menus use bookmarks, build from bookmarks
		else if (_uo.quickMenuBookmarks && _uo.contextMenuBookmarks) {
			return CSBookmarks.treeToFolders().then( root => {
				_uo.nodeTree = root;
				return _uo;
			});
		}

		else {

			return CSBookmarks.treeToFolders().then( (bmTree) => {
				let seTree = buildTreeFromSearchEngines();

				if (_uo.quickMenuBookmarks) {
					console.log("BM tree + SE tree");
					bmTree.children = bmTree.children.concat({type:"separator"}, seTree.children);

					_uo.nodeTree = bmTree;
					
				} else {
					console.log("SE tree + BM tree");
					seTree.children = seTree.children.concat({type:"separator"}, bmTree.children);

					_uo.nodeTree = seTree;
				}
				
				return _uo;

			});
				
		}

	}).then( _uo => {
		
		if ( _uo.quickMenuItems == undefined ) return _uo;
		
		// fix for 1.8.1 users
		if ( _uo.quickMenuItems != undefined && _uo.quickMenuRows != undefined) {
			console.log('deleting quickMenuItems for 1.8.1 user');
			delete _uo.quickMenuItems;
			return _uo;
		}
		// convert items to rows
		let toolCount = _uo.quickMenuTools.filter( tool => !tool.disabled ).length;
		
		// any position but top is safe to ignore
		if (_uo.quickMenuToolsPosition === 'hidden')
			toolCount = 0;
		
		let totalTiles = toolCount + _uo.quickMenuItems;
		
		let rows = Math.ceil(totalTiles / _uo.quickMenuColumns);
		
		if ( _uo.quickMenuUseOldStyle )
			rows = totalTiles;

		_uo.quickMenuRows = rows;
		
		return _uo;
	}).then( _uo => {
		
		if (!_uo.searchEngines.find(se => se.hotkey) ) return _uo;
		
		console.log("-> 1.8.2");
		
		_uo.searchEngines.forEach( se => {
			if (se.hotkey) {
				let nodes = findNodes(_uo.nodeTree, node => node.id === se.id);
				nodes.forEach(node => {
					node.hotkey = se.hotkey;
				});
				
				delete se.hotkey;
			}
		});
		
		return _uo;
		
	}).then( _uo => {
		
		if ( !_uo.sideBar.type ) return _uo;
		
		console.log("-> 1.9.7");
		
		_uo.sideBar.windowType = _uo.sideBar.type === 'overlay' ? 'undocked' : 'docked';
		delete _uo.sideBar.type;
		
		_uo.sideBar.offsets.top = _uo.sideBar.widget.offset;

		return _uo;
		
	}).then( _uo => {
		
		// remove campaign ID from ebay query_string ( mozilla request )
		
		let index = _uo.searchEngines.findIndex( se => se.query_string === "https://rover.ebay.com/rover/1/711-53200-19255-0/1?ff3=4&toolid=20004&campid=5338192028&customid=&mpre=https://www.ebay.com/sch/{searchTerms}" );
		
		if ( index === -1 ) return _uo;

		console.log("-> 1.14");
		
		_uo.searchEngines[index].query_string = "https://www.ebay.com/sch/i.html?_nkw={searchTerms}";
		_uo.searchEngines[index].template = "https://www.ebay.com/sch/";
		return _uo;	
		
	}).then( _uo => {
		
		if ( _uo.nodeTree.id ) return _uo;
		
		console.log("-> 1.19");
		
		findNodes(_uo.nodeTree, node => {
			if ( node.type === "folder" && !node.id )
				node.id = gen();
		});

		return _uo;	
	}).then( _uo => {
		console.log('done');
		return _uo;
	});
}

const defaultUserOptions = {
	searchEngines: defaultEngines || [],
	nodeTree: {},
	lastUsedId: null,
	hiddenEngines: "",
	defaultGroupColor: "#CED7FF",
	quickMenu: true,
	quickMenuColumns: 6,
	quickMenuRows: 1,
	quickMenuRowsSingleColumn: 6,
	quickMenuKey: 0,
	quickMenuOnKey: false,
	quickMenuOnHotkey: false,
	quickMenuHotkey: [17, 192],
	quickMenuOnMouse: true,
	quickMenuSearchOnMouseUp: false,
	quickMenuOnMouseMethod: "hold",
	quickMenuMouseButton: 3,
	quickMenuAuto: false,
	quickMenuAutoTimeout: 1000,
	quickMenuAutoOnInputs: false,
	quickMenuOnLinks: true,
	quickMenuOnImages: true,
	quickMenuOnSimpleClick: {
		enabled: false,
		button: 1,
		alt: false,
		ctrl: true,
		shift: false
	},
	quickMenuScale: 1,
	quickMenuIconScale: 1,
	quickMenuPosition: "top center",
	quickMenuOffset: {x:0, y:-20},
	quickMenuCloseOnScroll: false,
	quickMenuCloseOnClick: true,
	quickMenuCloseOnEdit: false,
	quickMenuTrackingProtection: true,
	quickMenuSearchBar: "hidden",
	quickMenuSearchBarFocus: false,
	quickMenuSearchBarSelect: true,
	quickMenuUseOldStyle: false,
	quickMenuAllowContextMenu: false,
	contextMenu: true,
	contextMenuKey: 0,
	contextMenuShowAddCustomSearch: true,
	contextMenuBookmarks: false,
	quickMenuBookmarks: false,
	quickMenuTools: [
		{name: 'lastused', disabled: false},
		{name: 'toggleview', disabled: false},
		{name: 'disable', 	disabled: true},
		{name: 'close', 	disabled: true},
		{name: 'copy', 		disabled: false},
		{name: 'link', 		disabled: false},
		{name: 'lock',		disabled: true},
		{name: 'repeatsearch', disabled: true}
	],
	quickMenuToolsPosition: "top",
	quickMenuToolsAsToolbar: true,
	contextMenuClick: "openNewTab",
	contextMenuMiddleClick: "openBackgroundTab",
	contextMenuRightClick: "openCurrentTab",
	contextMenuShift: "openNewWindow",
	contextMenuCtrl: "openBackgroundTab",
	contextMenuSearchLinksAs: "text",
	quickMenuLeftClick: "openNewTab",
	quickMenuRightClick: "openCurrentTab",
	quickMenuMiddleClick: "openBackgroundTab",
	quickMenuShift: "openNewWindow",
	quickMenuCtrl: "openBackgroundTab",
	quickMenuAlt: "keepMenuOpen",
	quickMenuFolderLeftClick: "openFolder",
	quickMenuFolderRightClick: "noAction",
	quickMenuFolderMiddleClick: "openBackgroundTab",
	quickMenuFolderShift: "openNewWindow",
	quickMenuFolderCtrl: "noAction",
	quickMenuFolderAlt: "noAction",
	quickMenuSearchHotkeys: "noAction",
	quickMenuAutoMaxChars: 0,
	quickMenuOpeningOpacity: 1,
	quickMenuTheme: "lite",
	quickMenuAlwaysShowMenuBar: false,
	searchBarSuggestions: true,
	searchBarEnableHistory: true,
	searchBarHistory: [],
	searchBarDisplayLastSearch: true,
	searchBarUseOldStyle: false,
	searchBarColumns: 6,
	searchBarCloseAfterSearch: true,
	searchBarTheme: "lite",
	sideBar: {
		enabled: true,
		columns: 6,
		height: 400,
		singleColumn: false,
		startOpen: false,
		hotkey: [],
		widget: {
			enabled: false,
			position: "right",
			offset: 100
		},
		position: "right",
		windowType: "undocked",
		offsets: {
			top:0,
			left:Number.MAX_SAFE_INTEGER,
			right:0,
			bottom:Number.MAX_SAFE_INTEGER
		},
		closeAfterSearch: false
	},
	highLight: {
		enabled: true,
		followExternalLinks: false,
		followDomain: true,
		showFindBar: false,
		flashSelected: true,
		markOptions: {
			separateWordSearch: true,
			accuracy: "exactly",
			ignorePunctuation: true,
			caseSensitive: false
		},
		highlightStyle: 'underline',
		styles: [
			{color: '#ffffff',background:'#ff00ff'},
			{color: '#000000',background:'#FFA500'},
			{color: '#ffffff',background:'#428bca'},
			{color: '#000000',background:'#FFFF00'}		
		],
		opacity:1,
		activeStyle: {color:'#ffffff', background:'#65FF00'},
		navBar: {
			enabled: false
		},
		findBar: {
			enabled: false,
			startOpen: false,
			showNavBar: false,
			hotKey: [17, 16, 70],
			position: 'top',
			windowType: 'docked',
			openInAllTabs: false,
			searchInAllTabs: false,
			offsets: {
				top:0,
				left:0,
				right:null,
				bottom:null
			},
			keyboardTimeout: 200,
			markOptions: {
				separateWordSearch: true,
				accuracy: "partially",
				ignorePunctuation: true,
				caseSensitive: false
			}
		}
	},
	userStyles: 
`/* add custom styles to menus here */
/* .tile { width:64px; } */
`,
	userStylesGlobal: "",
	userStylesEnabled: false,
	enableAnimations: true,
	
	searchBarHistoryLength: 1024,
	searchBarSuggestionsCount: 20,
	groupLabelMoreTile: false,
	groupFolderRowBreaks: false,
	autoCopy: false,
	rememberLastOpenedFolder: false,
	autoPasteFromClipboard: false,
	allowHotkeysWithoutMenu: false,
	quickMenuHoldTimeout: 250,
	exportWithoutBase64Icons: false
};

var userOptions = {};

(async () => {
	await loadUserOptions();
	console.log("userOptions loaded. Updating objects");
	userOptions = await updateUserOptionsVersion(userOptions);
	await browser.storage.local.set({"userOptions": userOptions});
	await checkForOneClickEngines();
	await buildContextMenu();
	document.dispatchEvent(new CustomEvent("loadUserOptions"));
})();

// turn off repeatsearch if persist = false 
document.addEventListener("loadUserOptions", () => {
	userOptions.quickMenuTools.find( (tool,index) => { 
		if ( tool.name === "repeatsearch" && tool.persist === false ) {
			userOptions.quickMenuTools[index].on = false;
			return true;
		}
	});
});

function checkForOneClickEngines() {

	// not FF 63+
	if ( !browser.search ) return Promise.resolve(-1);
	
	// don't add before nodeTree is populated
	if ( userOptions.nodeTree === {} ) {
		console.log('empty nodeTree - aborting one-click check');
		return Promise.resolve(-1);
	}

	return browser.search.get().then( engines => {

		let newEngineCount = 0;
		engines.forEach( engine => {
			if ( findNodes(userOptions.nodeTree, node => node.title === engine.name && ( node.type === "searchEngine" || node.type === "oneClickSearchEngine") ).length === 0 ) {

				let node = {
					type: "oneClickSearchEngine",
					title: engine.name,
					icon: engine.favIconUrl || browser.runtime.getURL('icons/search.svg'),
					hidden: false,
					id: gen()
				}

				console.log('adding One-Click engine ' + engine.name);
				userOptions.nodeTree.children.push(node);
				
				newEngineCount++;
			}
		});
		
		return newEngineCount;
	});
}

browser.runtime.onMessage.addListener(notify);

browser.runtime.onInstalled.addListener( details => {

	 
		// details.reason = 'install';
	// Show new features page
	
	document.addEventListener('loadUserOptions', () => {

	/*
		if (
			details.reason === 'update' 
			&& details.previousVersion < "1.9.4"
		) {
			browser.tabs.create({
				url: browser.runtime.getURL("/options.html?tab=highLightTab"),
				active: false
				
			}).then(_tab => {
				browser.tabs.executeScript(_tab.id, {
					file: browser.runtime.getURL("/update/update.js")
				});
			});
		}
		
	//	Show install page
*/			if ( 
			details.reason === 'install'
		) {
			browser.tabs.create({
				url: "/options.html?tab=helpTab"
			}).then(_tab => {
				// browser.tabs.executeScript(_tab.id, {
					// file: browser.runtime.getURL("/install/install.js")
				// });
			});
		}
	});
});

// trigger zoom event
browser.tabs.onZoomChange.addListener( zoomChangeInfo => {
	browser.tabs.executeScript( zoomChangeInfo.tabId, {
		code: 'document.dispatchEvent(new CustomEvent("zoom"));'
	});
});

// note: returns a promise to loadRemoteIcons
function dataToSearchEngine(data) {
	
	// useful when using page_action to trigger custom search iframe
	if (!data) return null;

	let favicon_href = data.favicon_href || "";

	let query_string = "";
	let params = [];
	
	// convert single object to array
	for (let k in data.params)
		params.push({name: k, value: data.params[k]});

	if (data.method === "GET" && data.query) {
		
		let param_str = data.query + "={searchTerms}";

		for (let i in data.params) {
			param_str+="&" + i + "=" + data.params[i];
		}
		// If the form.action already contains url parameters, use & not ?
		query_string = data.action + ((data.action.indexOf('?') === -1) ? "?":"&") + param_str;	
		
	} else {
		// POST form.template = form.action
		query_string = data.action;
		
		if (data.query)
			params.unshift({name: data.query, value: "{searchTerms}"});

	}
	
	// build search engine from form data
	let se = {
		"searchForm": data.origin, 
		"query_string":query_string,
		"icon_url": data.favicon_href || data.origin + "/favicon.ico",
		"title": data.title,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": "", 
		"method": data.method, 
		"params": params, 
		"template": data.action, 
		"queryCharset": data.characterSet.toUpperCase(),
		"description": data.description,
		"id": gen()
	};

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}

function readOpenSearchUrl(url) {
	return new Promise( async (resolve, reject) => {
		
		let t = setTimeout(() => {
			console.error('Error fetching ' + url + " This may be due to Content Security Policy https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP");
			
			reject(false);
		}, 2000);
		
		let resp = await fetch(url);
		let text = await resp.text();
		
		let parsed = new DOMParser().parseFromString(text, 'application/xml');

		if (parsed.documentElement.nodeName=="parsererror") {
			console.log('xml parse error');
			clearTimeout(t);
			resolve(false);
		}
		
		clearTimeout(t);
		resolve(parsed);
	});
}

function openSearchXMLToSearchEngine(xml) {
		
	let se = {};

	let shortname = xml.documentElement.querySelector("ShortName");
	if (shortname) se.title = shortname.textContent;
	else reject();
	
	let description = xml.documentElement.querySelector("Description");
	if (description) se.description = description.textContent;
	else reject();
	
	let inputencoding = xml.documentElement.querySelector("InputEncoding");
	if (inputencoding) se.queryCharset = inputencoding.textContent.toUpperCase();
	
	let url = xml.documentElement.querySelector("Url[template]");
	if (!url) reject();
	
	let template = url.getAttribute('template');
	if (template) se.template = se.query_string = template;
	
	let searchform = xml.documentElement.querySelector("moz\\:SearchForm");
	if (searchform) se.searchForm = searchform.textContent;
	else if (template) se.searchForm = new URL(template).origin;
	
	let image = xml.documentElement.querySelector("Image");
	if (image) se.icon_url = image.textContent;
	else se.icon_url = new URL(template).origin + '/favicon.ico';
	
	let method = url.getAttribute('method');
	if (method) se.method = method.toUpperCase() || "GET";

	let params = [];
	for (let param of url.getElementsByTagName('Param')) {
		params.push({name: param.getAttribute('name'), value: param.getAttribute('value')})
	}
	se.params = params;
	
	if (se.params.length > 0 && se.method === "GET") {
		se.query_string = se.template + ( (se.template.match(/[=&\?]$/)) ? "" : "?" ) + nameValueArrayToParamString(se.params);
	}
	
	se.id = gen();

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}
