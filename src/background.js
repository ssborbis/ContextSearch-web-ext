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

	switch(message.action) {

		case "saveUserOptions":
			userOptions = message.userOptions;
			return browser.storage.local.set({"userOptions": userOptions}).then(() => {
				notify({action: "updateUserOptions"});
			});
			break;
			
		case "updateUserOptions":
			let tabs = await getAllOpenTabs();
			for (let tab of tabs) {
				browser.tabs.sendMessage(tab.id, {"userOptions": userOptions}).catch( error => {/*console.log(error)*/});	
			}
			buildContextMenu();
			break;
			
		case "openOptions":
			let optionsPageURL = browser.runtime.getURL("/options.html");
			let optionsPage = await browser.tabs.query({url: optionsPageURL + "*"});

			optionsPage = optionsPage.shift();

			if ( optionsPage ) {
				browser.tabs.update(optionsPage.id, { active: true });
				browser.tabs.reload(optionsPage.id);
				return;

			}
			browser.tabs.create({
				url: browser.runtime.getURL("/options.html" + (message.hashurl || "")) 
			});
			break;
			
		case "quickMenuSearch":
			message.info.tab = sender.tab;
			return quickMenuSearch(message.info);
			break;
			
		case "enableContextMenu":
			userOptions.contextMenu = true;
			buildContextMenu();
			break;
			
		case "getUserOptions":
			return userOptions;
			break;
			
		case "getDefaultUserOptions":
			return defaultUserOptions;
			break;

		case "getSearchEngineById":
			if ( !message.id) return;

			return {"searchEngine": userOptions.searchEngines.find(se => se.id === message.id)};
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

		case "toggleLockQuickMenu":
			onFound = () => {}
			onError = () => {}

			return browser.tabs.executeScript(sender.tab.id, {
				code: 'if ( quickMenuObject.locked ) unlockQuickMenu(); else lockQuickMenu();',
				allFrames:false
			}).then(onFound, onError);
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
				
				let tabs = await getAllOpenTabs();
				return Promise.all(tabs.map( tab => {
					return browser.tabs.sendMessage(tab.id, ( tab.id !== sender.tab.id ) ? _message : message, {frameId: 0});
				}));
				
			} else
				return sendMessageToTopFrame();
			break;
			
		case "closeFindBar":
			if ( userOptions.highLight.findBar.openInAllTabs ) {
				
				let tabs = await getAllOpenTabs();
				return Promise.all(tabs.map( tab => {
					return browser.tabs.sendMessage(tab.id, message, {frameId: 0});
				}));
				
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
			onFound = () => {}
			onError = () => {}
			return browser.tabs.executeScript(sender.tab.id, {
				code: "getFindBar() ? true : false;"
			}).then(onFound, onError);
			break;

		case "mark":
			if ( message.findBarSearch && userOptions.highLight.findBar.searchInAllTabs ) {
				let tabs = await getAllOpenTabs();
				return Promise.all(tabs.map( tab => browser.tabs.sendMessage(tab.id, message)));
			} else {
				return sendMessageToAllFrames();
			}

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
		
		case "openSideBar":
		case "sideBarHotkey":
			return sendMessageToTopFrame();
			break;
			
		case "getOpenSearchLinks":

			onFound = results => results.shift();
			onError = results => null;
		
			return await browser.tabs.executeScript( sender.tab.id, {
				code: `
					(() => {
						let oses = document.querySelectorAll('link[type="application/opensearchdescription+xml"]');
						if ( oses ) return [...oses].map( ose => {return {title: ose.title || document.title, href: ose.href }})
					})()`
			}).then(onFound, onError);

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
				try {
					browser.contextMenus.update("search_engine_menu", {visible:false});
				} catch (err) {}
				break;
			}
			
			if (searchTerms.length > 18) 
				searchTerms = searchTerms.substring(0,15) + "...";
			
			let hotkey = ''; 
			if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';
			
			let title = hotkey + browser.i18n.getMessage("SearchFor").replace("%1", searchTerms);
			try {
				browser.contextMenus.update("search_engine_menu", {visible: true, title: title});
			} catch (err) {}

			break;
			
		case "getFirefoxSearchEngineByName":
			if ( !browser.search || !browser.search.get ) return [];
			let engines = await browser.search.get();
			return engines.find(e => e.name === message.name);
			break;
			
		case "addSearchEngine":
			let url = message.url;

			if ( browser.runtime.getBrowserInfo && browser.search && browser.search.get ) {

				// skip for Firefox version < 78 where window.external.AddSearchProvider is available
				let info = await browser.runtime.getBrowserInfo();	
				if ( parseFloat(info.version) < 78 ) return;
				
				let match = /SHORTNAME=(.*?)&DESCRIPTION/.exec(url);	
				
				if (!match[1]) return;

				let title = decodeURIComponent(match[1]);
				
				let engines = await browser.search.get();
				
				if ( engines.find(e => e.name === title) ) {
					await browser.tabs.executeScript(sender.tab.id, {
						code: `alert(browser.i18n.getMessage("FFEngineExists", "${title}"));`
					});
					return;
				}

				await browser.tabs.executeScript(sender.tab.id, {
					file: "/addSearchProvider.js"
				});
				
				// check for existing opensearch engine of the same name					
				let exists = await browser.tabs.executeScript(sender.tab.id, {
					code: `getSearchProviderUrlByTitle("${title}")`
				});

				exists = exists.shift();

				if ( exists ) {
					console.log('OpenSearch engine with name ' + title + ' already exists on page');

					let oldURL = new URL(exists);
					let newURL = new URL(url);

					if ( oldURL.href == newURL.href ) {
						console.log('exists but same url');
					} else {
						console.log('open new tab to include fresh opensearch link');
						
						let favicon = sender.tab.favIconUrl;
						
						let tab = await browser.tabs.create({
							active:true,
							url: browser.runtime.getURL('addSearchProvider.html')
						});

						await browser.tabs.executeScript(tab.id, {
							code: `
								var userOptions = {};

								browser.runtime.sendMessage({action: "getUserOptions"}).then( uo => {
									userOptions = uo;
								});
								
								setFavIconUrl("${favicon}");`
						});
						
						// some delay needed
						await new Promise(r => setTimeout(r, 500));

						notify({action: "addSearchEngine", url: url});
						return;
					}
				}
				
				await browser.tabs.executeScript(sender.tab.id, {
					code: `addSearchProvider("${url}");`
				});
					
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

			let parentNode = message.folderId ? findNode(userOptions.nodeTree, n => n.id === message.folderId) : userOptions.nodeTree;
						
			userOptions.searchEngines.push(se);

			let node = {
				type: "searchEngine",
				title: se.title,
				id: se.id,
				hidden: false
			}
			parentNode.children.push(node);

			notify({action: "saveOptions", userOptions:userOptions});
			return node;
			
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
			return {lastSearch: sessionStorage.getItem("lastSearch")};
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
						
						se.template = newUrl;

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
			try {
				await navigator.clipboard.writeText(message.msg);
				return true;
			} catch (error) {
				return false;
			}

			break;
			
		case "hasBrowserSearch":
			return typeof browser.search !== 'undefined' && typeof browser.search.get !== 'undefined';
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
			onFound = () => {}
			onError = () => {}

			return browser.tabs.executeScript(sender.tab.id, {
				code: `showNotification("${message.msg}")`
			}).then(onFound, onError);
			break;
			
		case "getTabQuickMenuObject":
			onFound = () => {}
			onError = () => {}

			return browser.tabs.executeScript(sender.tab.id, {
				code: `quickMenuObject;`
			}).then(onFound, onError);;
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
			if (userOptions.searchBarHistory.length >= userOptions.searchBarHistoryLength)
				userOptions.searchBarHistory.shift();
			
			// add new term
			userOptions.searchBarHistory.push(terms);
			
			// ignore duplicates
			userOptions.searchBarHistory = [...new Set([...userOptions.searchBarHistory].reverse())].reverse();
			
			// update prefs
			notify({action: "saveUserOptions", "userOptions": userOptions});
			
			console.info('adding to history', terms);
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
			onFound = () => {}
			onError = () => {}

			if ( userOptions.quickMenu ) {
				await browser.tabs.executeScript(sender.tab.id, {
					file: "/inject_quickmenu.js",
					frameId: sender.frameId
				}).then(onFound, onError);
				
				console.log("injected quickmenu");
			}
			
			if ( userOptions.pageTiles.enabled ) {
				await browser.tabs.executeScript(sender.tab.id, {
					file: "/inject_pagetiles.js",
					frameId: sender.frameId
				}).then(onFound, onError);
				
				console.log("injected pagetiles");
			}
			
			break;
			
		case "getFirefoxSearchEngines":
			if ( browser.search && browser.search.get ) return browser.search.get();
			break;
			
		case "setLastUsed":
			lastSearchHandler(message.id);
			break;
			
		case "getSelectedText":
			onFound = () => {}
			onError = () => {}

			return browser.tabs.executeScript(sender.tab.id, {
				code: "getSelectedText(document.activeElement);"
			}).then(onFound, onError);	
			break;

		case "addUserStyles":
			if ( !userOptions.userStylesEnabled ) return false;

			console.log('adding user styles');

			let style = message.global ? userOptions.userStylesGlobal : userOptions.userStyles;

			if ( !style.trim() ) return false;

			return browser.tabs.insertCSS( sender.tab.id, {
				code: style,
				frameId: message.global ? null : sender.frameId
			});
			
			break;

		case "editQuickMenu":
			sendMessageToTopFrame();
			break;

		case "addStyles":
			return browser.tabs.insertCSS( sender.tab.id, {
				file: message.file,
				frameId: sender.frameId
			});
			break;

		case "closePageTiles":
			return sendMessageToTopFrame();
			break;

		case "openBrowserAction":
			console.log('openBrowserAction')
			browser.browserAction.openPopup();
			return;

		case "openPageTiles":
			await browser.tabs.executeScript(sender.tab.id, {
				file: "/inject_pagetiles.js"
			}).catch(e => {});

			return sendMessageToTopFrame();
			break;

		case "minifySideBar":
			console.log('bg');
			return sendMessageToTopFrame();
			break;

		case "getZoom":
			return browser.tabs.getZoom(sender.tab.id);
			break;

		case "sideBarOpenedOnSearchResults":

			onFound = results => results;
			onError = results => null;
			
			return await browser.tabs.executeScript(sender.tab.id, {
				code: `(() => {
					let result = window.openedOnSearchResults;
					delete window.openedOnSearchResults;
					return result;
				})();`
			}).then( onFound, onError);

			break;

		case "injectContentScripts":
			injectContentScripts(sender.tab);
			break;

		case "openCustomSearch":
			sendMessageToTopFrame();
			break;
	}
}

function updateUserOptionsObject(uo) {
	// Update default values instead of replacing with object of potentially undefined values
	function traverse(defaultobj, userobj) {
		for (let key in defaultobj) {
			userobj[key] = (userobj[key] !== undefined && userobj[key] == userobj[key] ) ? userobj[key] : defaultobj[key];

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
	return getting.then(onGot, onError);
}

async function buildContextMenu() {

	window.contextMenuSelectDomainMenus = [];

	let contexts = ["selection", "page"];

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

	if (!userOptions.contextMenu) return false;
	
	let hotkey = ''; 
	if (userOptions.contextMenuKey) hotkey = '(&' + keyTable[userOptions.contextMenuKey].toUpperCase() + ') ';

	browser.contextMenus.create({
		id: "search_engine_menu",
		title: (userOptions.searchEngines.length === 0) ? browser.i18n.getMessage("AddSearchEngines") : hotkey + browser.i18n.getMessage("SearchWith"),
		contexts: contexts
	});

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	if (!root.children) return;

	let id = 0;
	delete root.id;

	// add incremental menu ids to avoid duplicates
	let count = 0;
	
	// recently used engines
	if ( userOptions.contextMenuShowRecentlyUsed && userOptions.recentlyUsedList.length ) {
		
		if ( userOptions.contextMenuShowRecentlyUsedAsFolder ) {
			let folder = {
				type: "folder",
				id: "___recent___",
				title: browser.i18n.getMessage('Recent'),
				children: []
			}	

			userOptions.recentlyUsedList.forEach( (id,index) => {
				if ( index > userOptions.recentlyUsedListLength -1 ) return;
				let lse = findNode(userOptions.nodeTree, node => node.id === id);
				folder.children.push(Object.assign({}, lse));
			});
			
			root.children.unshift(folder);
		} else {
			let recent = [];
			userOptions.recentlyUsedList.forEach( (id,index) => {
				if ( index > userOptions.recentlyUsedListLength -1 ) return;
				let lse = findNode(userOptions.nodeTree, node => node.id === id);
				recent.push(Object.assign({}, lse));
			});
			
			root.children.unshift({type: "separator"});			
			root.children = recent.concat(root.children);
		}
	}
	
	if ( userOptions.syncWithFirefoxSearch ) {
		let ses = await browser.search.get();
		
		let count = 0;
		ses.forEach(se => {
			let node = findNode(userOptions.nodeTree, _node => _node.title === se.name && (_node.type === "oneClickSearchEngine" || _node.type === "searchEngine") );
			
			if ( !node ) console.log(se);

			addMenuItem({
				parentId: "search_engine_menu",
				title: se.name,
				id: node.id + '_' + count++,
				icons: {
					"16": se.favIconUrl || browser.runtime.getURL('icons/search.svg')
				}
			});
		});
		
		return;
	}
	
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
	
	root.children.forEach( child => traverse(child, "search_engine_menu") );

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
		
		if ( tab && tab.id && tabId === tab.id && changeInfo.url && changeInfo.url !== "about:blank" ) 
			updateSelectDomainMenus(tab);
	}
	
	function onError(err) { console.error(err) }
	
	browser.tabs.query({currentWindow: true, active: true}).then(onFound, onError);	
	
});

browser.contextMenus.onClicked.addListener(contextMenuSearch);

function openWithMethod(o) {
	if ( !o.url ) return;
	
	o.openerTabId = o.openerTabId || null;
	
	switch (o.openMethod) {
		case "openCurrentTab":
			return openCurrentTab();
			break;
		case "openNewTab":
			return openNewTab(false);
			break;
		case "openNewWindow":
			return openNewWindow(false);
			break;
		case "openNewIncognitoWindow":
			return openNewWindow(true);
			break;
		case "openBackgroundTab":
		case "openBackgroundTabKeepOpen":
			return openNewTab(true);
			break;
		case "openSideBarAction":
			return openSideBarAction(o.url);
			break;
	}
	
	function openCurrentTab() {
		
		return browser.tabs.update({
			url: o.url,
			openerTabId: o.openerTabId
		});
	} 
	function openNewWindow(incognito) {	// open in new window

		return browser.windows.create({
			url: o.url,
			incognito: incognito
		});
	} 
	function openNewTab(inBackground) {	// open in new tab

		return browser.tabs.create({
			url: o.url,
			active: !inBackground,
			openerTabId: ( userOptions.openFoldersAfterLastTab ) ? null : o.openerTabId
			//openerTabId: (info.folder ? null : openerTabId)
		});

	}	

	async function openSideBarAction(url) {

		if ( !browser.sidebarAction ) return;
		
		await browser.sidebarAction.setPanel( {panel: null} ); // firefox appears to ignore subsequent calls to setPanel if old url = new url, even in cases of differing #hash
		
		await browser.sidebarAction.setPanel( {panel: url} );
			
		if ( !await browser.sidebarAction.isOpen({}) )
			notify({action: "showNotification", msg: browser.i18n.getMessage('NotificationOpenSidebar')}, {});
	}
}

function executeBookmarklet(info) {
	
	if (!browser.bookmarks) {
		console.error('No bookmarks permission');
		return;
	}
	// run as bookmarklet
	browser.bookmarks.get(info.menuItemId).then( bookmark => {
		bookmark = bookmark.shift();
		
		if (!bookmark.url.startsWith("javascript")) { // assume bookmark
		
			openWithMethod({
				openMethod: info.openMethod, 
				url: bookmark.url,
				openerTabId: userOptions.disableNewTabSorting ? null : info.tab.id
			});
				
		//	console.error('bookmark not a bookmarklet');
			return false;
		}
		
		// console.log(window.searchTerms, info.selectionText);

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

	let searchTerms = info.searchTerms;
	let openMethod = info.openMethod;
	let openerTabId = userOptions.disableNewTabSorting ? null : info.tab.id;
	
	notify({action: "addToHistory", searchTerms: searchTerms});

	async function searchAndHighlight(tab) {

		browser.search.search({
			query: searchTerms,
			engine: info.node.title,
			tabId: tab.id
		});

		browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, __tab) {
			
			if ( tabId !== tab.id ) return;
		
			if ( changeInfo.status !== 'complete' || changeInfo.url === 'about:blank' ) return;
			
			highlightSearchTermsInTab(__tab, searchTerms);
			browser.tabs.onUpdated.removeListener(listener);
		});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	if ( openMethod === "openSideBarAction" ) {
		return console.log("one-click search engines cannot be used with sidebaraction");
	}
	
	openWithMethod({
		openMethod: openMethod, 
		url: "about:blank",
		openerTabId: openerTabId
	}).then( tab => {
		// if new window
		if (tab.tabs) tab = tab.tabs[0];
		searchAndHighlight(tab);
	}, onError);

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

function lastSearchHandler(id) {

	let node = findNode(userOptions.nodeTree, n => n.id === id );
	
	if ( !node ) return;
	
	userOptions.lastUsedId = id;
	
	if ( node.type !== "folder" ) {
		userOptions.recentlyUsedList.unshift(userOptions.lastUsedId);
		userOptions.recentlyUsedList = [...new Set(userOptions.recentlyUsedList)].slice(0, userOptions.recentlyUsedListLength);
	}
	
	notify({action: "saveUserOptions", userOptions: userOptions});
}

function isValidHttpUrl(string) {
	let url;

	try {
		url = new URL(string);
	} catch (_) {
		return false;  
	}

	return url.protocol === "http:" || url.protocol === "https:";
}

function quickMenuSearch(info) {
	
	let node = findNode(userOptions.nodeTree, n => n.id === info.menuItemId) || null;
	
	info.node = node;
	info.searchTerms = info.selectionText;
	
	if ( node && node.type === "folder" ) return folderSearch(info);

// -	node: node,
// -	searchEngineId: info.menuItemId, 
// -	searchTerms: info.selectionText,
// -	openMethod: info.openMethod, 
// -	tab: tab,
// -	openUrl: info.openUrl || null,
// -	folder: info.folder,
// -	domain: info.domain,
// -	temporarySearchEngine: info.temporarySearchEngine || null

	return openSearch(info);
}

function openSearch(info) {
	
	if (!info.folder) delete window.folderWindowId;
	
	if ( !info.temporarySearchEngine && !info.folder && !info.openUrl) 
		lastSearchHandler(info.menuItemId);
	
	// check for multiple engines (v1.27+)
	let node = info.node || findNode(userOptions.nodeTree, n => n.id === info.menuItemId) || null;
	if ( 
		( node && node.type === "searchEngine" ) ||
		( info.temporarySearchEngine && !info.noMultiURL ) // allow temporary, but not subsequent multiurl templates
	 ) {
		let se = info.temporarySearchEngine || userOptions.searchEngines.find(_se => _se.id === node.id );
		if (!se) return;
		
		// check for arrays
		try { 		
			let arr = JSON.parse(se.template);

			arr.forEach( (url, index) => {

				// make sure id != node id
				if ( url === node.id ) return;

				let _info = Object.assign({noMultiURL: true}, info);
				_info.openMethod = index ? "openBackgroundTab" : _info.openMethod;
				
				// if url and not ID
				if ( isValidHttpUrl(url) ) {
					
					_info.temporarySearchEngine = Object.assign({}, se);
					_info.temporarySearchEngine.template = url;

					// parse encoding for multi-URLs
					let matches = /{encoding=(.*?)}/.exec(url);
		
					if ( matches && matches[1] )
						_info.temporarySearchEngine.queryCharset = matches[1];

				} else if ( findNode(userOptions.nodeTree, n => n.id === url )) {
					_info.menuItemId = url;
				} else {
					console.log('url invalid', url);
					return;
				}
				
				openSearch(_info);
			});
			
			notify({action: "addToHistory", searchTerms: info.searchTerms});
			return;
			
		} catch (error) {
		//	console.log(error);
		}
	}
	
	if ( node && node.type === "oneClickSearchEngine" ) {
		console.log("oneClickSearchEngine");
		executeOneClickSearch(info);
		return false;
	}
	
	//if (browser.bookmarks !== undefined && !userOptions.searchEngines.find( se => se.id === info.menuItemId ) && !info.openUrl ) {
	if ( node && node.type === "bookmarklet" ) {
		console.log("bookmarklet");
		executeBookmarklet(info);
		return false;
	}

	var searchEngineId = info.searchEngineId || info.menuItemId || null;
	var searchTerms = (info.searchTerms) ? info.searchTerms.trim() : "";
	var openMethod = info.openMethod || "openNewTab";
	var tab = info.tab || null;
	var openUrl = info.openUrl || false;
	var temporarySearchEngine = info.temporarySearchEngine || null; // unused now | intended to remove temp engine
	var domain = info.domain || null;

	if ( !temporarySearchEngine && searchEngineId === null ) return false;
	
	if (!tab) tab = {url:"", id:0}
	
	var openerTabId = userOptions.disableNewTabSorting ? null : tab.id;
	
	var se;
	
	if ( !openUrl && !temporarySearchEngine )
		notify({action: "addToHistory", searchTerms: searchTerms});

	if (!openUrl) {

		// if temp engine exists, use that
		se = temporarySearchEngine || userOptions.searchEngines.find(se => se.id === searchEngineId);

		// must be invalid
		if ( !se || !se.template) return false;

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
		
		var q = replaceOpenSearchParams({template: se.template, searchterms: encodedSearchTermsObject.uri, url: tab.url, domain: domain});

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
	
	openWithMethod({
		openMethod: openMethod, 
		url: q, 
		openerTabId: openerTabId
	}).then(onCreate, onError);
	
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
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}

}

async function folderSearch(info, allowFolders) {

	let node = info.node;

	let messages = [];
	
	if ( ["openNewWindow", "openNewIncognitoWindow"].includes(info.openMethod) ) {
		
		let win = await browser.windows.create({
			url: "about:blank",
			incognito: info.openMethod === "openNewIncognitoWindow" ? true : false
		});
		
		info.tab = win.tabs[0];
		info.openMethod = "openCurrentTab";	
	}

	// track index outside forEach to avoid incrementing on skipped nodes
	let index = 0;

	node.children.forEach( _node => {
		
		if ( _node.hidden) return;
		if ( _node.type === "separator" ) return;
		if ( _node.type === "folder" && !allowFolders ) return;

		let _info = Object.assign({}, info);
		
		_info.openMethod = index ? "openBackgroundTab" : _info.openMethod;
		_info.folder = index++ ? true : false;
		_info.menuItemId = _node.id;
		_info.searchTerms = info.selectionText;
		_info.node = _node;

		if ( _node.type === "folder" && allowFolders )
			messages.push( async() => await folderSearch(_info) );
		else
			messages.push( async() => await openSearch(_info) );
	});

	async function runPromisesInSequence(promises) {
		for (let promise of promises) 
			await promise();
		
		// if ( !keepMenuOpen(e, true))
			// closeMenuRequest();
		
		lastSearchHandler(node.id);
	}

	return runPromisesInSequence(messages);
}

function escapeDoubleQuotes(str) {
	if ( !str ) return str;
	return str.replace(/\\([\s\S])|(")/g,"\\$1$2");
}

var highlightTabs = [];

async function highlightSearchTermsInTab(tab, searchTerms) {
	
	if ( !tab ) return;

	if ( userOptions.sideBar.openOnResults ) {
		await browser.tabs.executeScript(tab.id, {
			code: `openSideBar({noSave: true, minimized: ${userOptions.sideBar.openOnResultsMinimized}, openedOnSearchResults: true})`,
			runAt: 'document_idle'
		});
	}

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

	await browser.tabs.executeScript(tab.id, {
		code: `document.dispatchEvent(new CustomEvent("CS_markEvent", {detail: {type: "searchEngine", searchTerms: "`+ escapeDoubleQuotes(searchTerms) + `"}}));`,
		runAt: 'document_idle',
		allFrames: true
	});

	if ( userOptions.highLight.followDomain || userOptions.highLight.followExternalLinks ) {
		
		let url = new URL(tab.url);

		let obj = {tabId: tab.id, searchTerms: searchTerms, domain: url.hostname};
		
		if ( ! highlightTabs.find( ht => JSON.stringify(obj) === JSON.stringify(ht) ) )
			highlightTabs.push(obj);
	}
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

	let start = Date.now();

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
		
		// remove campaign ID from ebay template ( mozilla request )
		
		let index = _uo.searchEngines.findIndex( se => se.query_string === "https://rover.ebay.com/rover/1/711-53200-19255-0/1?ff3=4&toolid=20004&campid=5338192028&customid=&mpre=https://www.ebay.com/sch/{searchTerms}" );
		
		if ( index === -1 ) return _uo;

		console.log("-> 1.14");
		
		_uo.searchEngines[index].query_string = "https://www.ebay.com/sch/i.html?_nkw={searchTerms}";

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
		
		// delete se.query_string in a future release
		// if ( !_uo.searchEngines.find( se => se.query_string ) ) return _uo;

		console.log("-> 1.27");
		
		_uo.searchEngines.forEach( (se,index,arr) => {
			if ( se.query_string ) {
				
				if ( se.query_string.length > se.template.length) {
					console.log("replacing template with query_string", se.template, se.query_string);
					arr[index].template = arr[index].query_string;
				}
				
				arr[index].query_string = arr[index].template;
			}
		});

		return _uo;	
	}).then( _uo => {

		// replace hotkeys for sidebar ( quickMenuHotkey ) and findbar
		if ( 'quickMenuHotkey' in _uo ) {
			let enabled = _uo.quickMenuOnHotkey;
			let key = _uo.quickMenuHotkey;

			if ( 'key' in key ) {
				key.id = 4;
				key.enabled = enabled;

				let us = _uo.userShortcuts.find(s => s.id === 4 );
				if ( us ) _uo.userShortcuts[_uo.userShortcuts.indexOf(us)] = key;
				else _uo.userShortcuts.push(key);
			}

		}

		if ( 'hotKey' in _uo.highLight.findBar ) {
			let enabled = _uo.highLight.findBar.enabled;
			let key = _uo.highLight.findBar.hotKey;

			if ( 'key' in key ) {
				key.id = 1;
				key.enabled = enabled;

				let us = _uo.userShortcuts.find(s => s.id === 1 );
				if ( us ) _uo.userShortcuts[_uo.userShortcuts.indexOf(us)] = key;
				else _uo.userShortcuts.push(key);
			}
			console.log("-> 1.29");
		}

		if ( !_uo.highLight.styles.find(s => s.background !== "#000000" && s.color !== "#000000") ) {
			console.log('resetting highLight.styles');
			_uo.highLight.styles = defaultUserOptions.highLight.styles; 
			_uo.highLight.activeStyle = defaultUserOptions.highLight.activeStyle; 
		}

		return _uo;

	}).then( _uo => {

		// groupFolder object changed from true/false to none/inline/block
		findNodes(_uo.nodeTree, n => {

			if ( !n.groupFolder ) return;

			if ( n.groupFolder === true ) {
				n.groupFolder = "inline";
				console.log(n.title, "groupFolder changed to inline");
			} else if ( n.groupFolder === false ) {
				n.groupFolder = "none";
				console.log(n.title, "groupFolder changed to none");
			}
		});

		return _uo;

	}).then( _uo => {

		_uo.version = browser.runtime.getManifest().version;

		return _uo;

	}).then( _uo => {
		console.log('Done', Date.now() - start);
		return _uo;
	});
}

var userOptions = {};

(async () => {
	await loadUserOptions();
	console.log("userOptions loaded. Updating objects");
	userOptions = await updateUserOptionsVersion(userOptions);
	await browser.storage.local.set({"userOptions": userOptions});
	await checkForOneClickEngines();
	await buildContextMenu();
	resetPersist();
	document.dispatchEvent(new CustomEvent("loadUserOptions"));
})();

function resetPersist() {
// turn off if persist = false 
	userOptions.quickMenuTools.forEach( (tool,index) => { 
		if ( tool.persist && tool.persist === false )
			userOptions.quickMenuTools[index].on = false;
	});
}

async function checkForOneClickEngines() {

	// not FF 63+
	if ( !browser.search || !browser.search.get ) return -1;
	
	// don't add before nodeTree is populated
	if ( !Object.keys(userOptions.nodeTree).length ) {
		console.log('empty nodeTree - aborting one-click check');
		return -1;
	}

	let engines = await browser.search.get();

	let newEngineCount = 0;
	engines.forEach( engine => {
		let found = findNode(userOptions.nodeTree, node => node.title === engine.name && ( node.type === "searchEngine" || node.type === "oneClickSearchEngine") );
		
		if ( found ) return;

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
		
	});
	
	return newEngineCount;
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
				url: browser.runtime.getURL("/options.html#highLight"),
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
				url: "/options.html#help"
			}).then(_tab => {
				browser.tabs.executeScript(_tab.id, {
					code: `cacheAllIcons()`
				});
			});
		}
	});
});

// trigger zoom event
browser.tabs.onZoomChange.addListener( zoomChangeInfo => {

	onFound = () => {}
	onError = () => {}

	browser.tabs.executeScript( zoomChangeInfo.tabId, {
		code: 'document.dispatchEvent(new CustomEvent("zoom"));'
	}).then(onFound, onError);
});

// note: returns a promise to loadRemoteIcons
function dataToSearchEngine(data) {
	
	// useful when using page_action to trigger custom search iframe
	if (!data) return null;

	let favicon_href = data.favicon_href || "";

	let template = "";
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
		template = data.action + ((data.action.indexOf('?') === -1) ? "?":"&") + param_str;	
		
	} else {
		// POST form.template = form.action
		template = data.action;
		
		if (data.query)
			params.unshift({name: data.query, value: "{searchTerms}"});

	}
	
	// build search engine from form data
	let se = {
		"searchForm": data.origin, 
		"icon_url": data.favicon_href || data.origin + "/favicon.ico",
		"title": data.name || data.title,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": "", 
		"method": data.method, 
		"params": params, 
		"template": template, 
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
	else return Promise.reject();
	
	let description = xml.documentElement.querySelector("Description");
	if (description) se.description = description.textContent;
	else return Promise.reject();
	
	let inputencoding = xml.documentElement.querySelector("InputEncoding");
	if (inputencoding) se.queryCharset = inputencoding.textContent.toUpperCase();
	
	let url = xml.documentElement.querySelector("Url[template]");
	if (!url) return Promise.reject();
	
	let template = url.getAttribute('template');
	if (template) se.template = template;
	
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
		se.template = se.template + ( (se.template.match(/[=&\?]$/)) ? "" : "?" ) + nameValueArrayToParamString(se.params);
	}
	
	se.id = gen();

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

	if ( changeInfo.status !== "complete" ) return;

	try {
		let url = new URL(tab.url);

		// test for pure hostname
		if ( userOptions.blockList.includes(url.hostname)) return;

		for ( let pattern of userOptions.blockList) {

			// skip blank
			if ( !pattern.trim() ) continue;

			// skip disabled
			if ( /^!|^#/.test(pattern) ) continue

			// test for pure regex
			try {
				let regex = new RegExp(pattern);
				if ( regex.test(url.href)) {
					console.log(url.href + " matches " + pattern);
					return;
				}
				continue;
			} catch( err ) {}
			
			// test for wildcards
			try {
				let regex = new RegExp(pattern.replace(/\*/g, "[^ ]*").replace(/\./g, "\\."));
				if ( regex.test(url.hostname) || regex.test(url.href)) {
					console.log(url.href + " matches " + pattern);
					return;
				}
				continue;
			} catch (err) {}
		}
	} catch (err) { console.log('bad url for tab', tabId)}

	injectContentScripts(tab);
})

function injectContentScripts(tab) {

	onFound = () => {}
	onError = () => {}
	[
		"/lib/browser-polyfill.min.js",
		"/lib/crossbrowser.js",
		"/inject.js",
		"/lib/mark.es6.min.js",
		"/inject_highlight.js",
		"/hotkeys.js",
		"/defaultShortcuts.js",
		"/dragshake.js"
	].forEach(js => browser.tabs.executeScript(tab.id, { file: js, allFrames: true, matchAboutBlank:false}).then(onFound, onError))
	browser.tabs.insertCSS(tab.id, {file: "/inject.css", allFrames: true, matchAboutBlank:false}).then(onFound, onError);

	[
		"/utils.js",
		"/nodes.js",
		"/opensearch.js",
		"/searchEngineUtils.js",
		"/dock.js",
		"/inject_sidebar.js",
		"/inject_customSearch.js",
		"/resizeWidget.js"
	].forEach(js => browser.tabs.executeScript(tab.id, { file: js, allFrames: false, matchAboutBlank:false}).then(onFound, onError))
	browser.tabs.insertCSS(tab.id, {file: "/inject_sidebar.css", allFrames: false, matchAboutBlank:false}).then(onFound, onError);
}