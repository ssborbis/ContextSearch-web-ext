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

		if (i18n("ContextSearchMenu") === "ContextSearch Menu") return _uo;
		
		console.log("-> 1.6.0");
		
		browser.bookmarks.search({title: "ContextSearch Menu"}).then( bookmarks => {

			if (bookmarks.length === 0) return _uo;

			console.log('New locale string for bookmark name. Attempting to rename');
			return browser.bookmarks.update(bookmarks[0].id, {title: i18n("ContextSearchMenu")}).then(() => {
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

		if ( !_uo.searchEngines ) return _uo;
		
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

		if ( !_uo.searchEngines ) return _uo;
		
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

		if ( !_uo.searchEngines ) return _uo;
		
		// delete se.query_string in a future release
		// if ( !_uo.searchEngines.find( se => se.query_string ) ) return _uo;

		let flag = false;
		
		_uo.searchEngines.forEach( (se,index,arr) => {
			if ( se.query_string ) {
				
				if ( se.query_string.length > se.template.length) {
					console.log("replacing template with query_string", se.template, se.query_string);
					arr[index].template = arr[index].query_string;
				}
				
				arr[index].query_string = arr[index].template;

				delete se.query_string;

				flag = true;
			}
		});

		if ( flag ) console.log("-> 1.27");

		return _uo;	
	}).then( _uo => {

		// replace hotkeys for sidebar ( quickMenuHotkey ) and findbar
		if ( 'quickMenuHotkey' in _uo ) {
			let enabled = _uo.quickMenuOnHotkey;
			let key = _uo.quickMenuHotkey;

			if ( 'key' in key ) {
				key.id = 4;
				key.enabled = enabled;

				console.log('userShortcuts', _uo.userShortcuts);

				let us_index = _uo.userShortcuts.findIndex(s => s.id === 4 );
				if ( us_index !== -1 ) _uo.userShortcuts[us_index] = key;
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

		// groupFolder object changed from true/false to false/inline/block
		findNodes(_uo.nodeTree, n => {

			if ( !n.groupFolder ) return;

			if ( n.groupFolder === true ) {
				n.groupFolder = "inline";
				console.log(n.title, "groupFolder changed to inline");
			} else if ( n.groupFolder === "none" ) {
				n.groupFolder = false;
				console.log(n.title, "groupFolder changed to false");
			}
		});

		return _uo;
	}).then( _uo => {

		// 1.32
		if ( _uo.searchBarIcon.indexOf('icon48.png') )
			_uo.searchBaricon = 'icons/icon.svg'
		return _uo;

	}).then( _uo => {

		if ( _uo.hasOwnProperty("forceOpenReultsTabsAdjacent") ) {
			_uo.forceOpenResultsTabsAdjacent = _uo.forceOpenReultsTabsAdjacent;
			delete _uo.forceOpenReultsTabsAdjacent;
		}
		return _uo;

	}).then( _uo => {

		findNodes(_uo.nodeTree, n => {
			if ( ['folder', 'separator', 'bookmark'].includes(n.type) ) return;

			if ( !n.hasOwnProperty('contexts') )
				n.contexts = 32; // selection)
		})
		return _uo;

	}).then( _uo => {

		if ( _uo.rightClickMenuOnMouseDownFix )
			_uo.quickMenuMoveContextMenuMethod = "dblclick";

		delete _uo.rightClickMenuOnMouseDownFix;
		return _uo;
	}).then( _uo => {
		let els = _uo.quickMenuDomLayout.split(",");

		if ( !els.includes("contextsBar") && !els.includes("!contextsBar") ) {
			els.push("!contextsBar");
			_uo.quickMenuDomLayout = els.join(",");
		}
		return _uo;
	}).then( _uo => {
		if ( _uo.hasOwnProperty("quickMenuUseOldStyle") ) {
			_uo.quickMenuDefaultView = _uo.quickMenuUseOldStyle ? 'text' : 'grid';
			delete _uo.quickMenuUseOldStyle;
		}

		if ( _uo.hasOwnProperty("_uo.searchBarUseOldStyle") ) {
			_uo.searchBarDefaultView = _uo.searchBarUseOldStyle ? 'text' : 'grid';
			delete _uo.searchBarUseOldStyle;
		}

		return _uo;
	}).then( _uo => { // final cleanup

		// remove duplicates
		_uo.searchBarHistory = [...new Set([..._uo.searchBarHistory].reverse())].reverse();

		// set version
		_uo.version = browser.runtime.getManifest().version;
		return _uo;

	}).then( _uo => {
		if ( _uo.version < "1.47" ) { // version to compare should be the unified nodeTree release

			// test for unified node tree
			if ( _uo.searchEngines.length === 0 && findNode(_uo.nodeTree, n => n.type === 'searchEngine') ) {
				console.log('repairing searchEngines array');
				_uo = deunifyNodeTree(_uo);
			}

			if ( browser.search && browser.search.get ) {
				browser.search.get().then(ffses => {
					findNodes(_uo.nodeTree, n => n.type === 'oneClickSearchEngine' && !n.icon ).forEach(n => {
						let ffse = ffses.find(ffs => ffs.name === n.title);
						if ( ffse ) n.icon = ffse.favIconUrl;
					});
				});
			}
		}
		return _uo;
	}).then( _uo => {
		if ( true ) {
			_uo = unifyNodeTree(_uo);

			// rebuild searchEngines array after unifying for a few versions
			_uo = deunifyNodeTree(_uo);

			// check for bad node icons
			findNodes(_uo.nodeTree, n => {
				if ( !n.icon && (n.icon_url || n.icon_base64String) ) {
					n.icon = n.icon || n.icon_url || n.icon_base64String;
					n.iconCache = n.icon_base64String || "";
					delete n.icon_url;
					delete n.icon_base64String;
				}
			});
		}
		return _uo;
	}).then( _uo => {
		console.log('Done ->', _uo.version, Date.now() - start);
		return _uo;
	});

}

function deunifyNodeTree(_uo) {

	if ( _uo.searchEngines && _uo.searchEngines.length ) {
		console.log('searchEngines array exists. Aborting.');
		return _uo;
	}

	_uo.searchEngines = [];

	findNodes(_uo.nodeTree, n => n.type === 'searchEngine').forEach(n => {
		let se = JSON.parse(JSON.stringify(n));
		se.icon_url = n.icon || n.iconCache || "";
		se.icon_base64String = n.iconCache || "";

		delete se.icon;
		delete se.iconCache;
		delete se.parentNode;

		_uo.searchEngines.push(se);
	});

	return _uo;
}

function unifySearchEngineNode(se, n) {

	debug("Merging: " + se.title);
	for ( const key in se ) {
		if ( key in n && se[key] !== n[key] ) {
			debug(`Key values diverged for '${key}': (${se[key]}) -> (${n[key]})`);
		}
	}

	n.icon = n.icon || se.icon_url || se.icon_base64String || "";
	n.iconCache = se.icon_base64String || "";

	se.hidden = ("hidden" in n ) ? n.hidden : (se.hidden || false);
	Object.assign(n, se);

	return n;
}

function unifyNodeTree(_uo) {

	const uo = JSON.parse(JSON.stringify(_uo));

	let ses = uo.searchEngines;

	if ( !ses ) {
		console.log("No search engines array. Node tree may already be unified");
		return uo;
	}

	for ( const se of ses ) {
		let associatedNodes = findNodes(uo.nodeTree, n => n.id === se.id );

		associatedNodes.forEach((an, index) => {

			an = unifySearchEngineNode(se, an);

			// subsequent nodes are copies with a new id
			if ( index !== 0 )
				an.id =  gen();
		});
	}

	delete uo.searchEngines;
	return uo;
}

