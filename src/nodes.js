function findNode(tree, callback) {
	
	function _traverse(node, parent) {
		
		if ( callback(node, parent) ) return node;
		
		if (node && node.children) {
			for (let child of node.children) {
				let found = _traverse(child, node);
				if ( found ) return found;
			}
		}
		
		return null;
	}
	
	return _traverse(tree, null);
}

function findNodes(tree, callback) {
		
	let results = [];
	
	function _traverse(node, parent) {
				
		if (node && node.children) {
			for ( let i=node.children.length-1;i>=0;i--)
				_traverse(node.children[i], node);
		}

		if ( callback(node, parent) ) results.push(node);
	}
	
	_traverse(tree, null);
	 
	return results;
}

function traverseNodes(tree, callback) {
			
	function _traverse(node, parent) {
				
		if (node && node.children) {
			for ( let i=node.children.length-1;i>=0;i--)
				_traverse(node.children[i], node);
		}

		callback(node, parent);
	}
	
	_traverse(tree, null);
}

function setParents(tree) {
	
	findNodes( tree, (node, parent) => {
	
		node.toJSON = function() {
			let o = {};
			
			// skip parent property
			Object.keys(this).forEach( key => {
				if (key !== "parent") o[key] = this[key];
				else if ( this[key]) o.parentId = this[key].id;
			}, this);

			return o;
		}
		node.parent = parent;
	  
	});
}

function removeNodesById(tree, id) {
	
	findNodes( tree, (node, parent) => {
		if (node.id == id) removeNode(node, parent);
	});
}

function removeNode(node, parent) {
	parent.children.splice(parent.children.indexOf(node), 1);
}

function sortNode(node, options = {}) {
	let nodeCopy = JSON.parse(JSON.stringify(node));

	const sortChildren = n => {

		if ( !n.children ) return;

		n.children.sort((a,b) => (a.title || "").localeCompare( (b.title || ""), undefined, {sensitivity: "base"}));

		if ( options.sortFoldersTop ) {
			n.children.sort((a,b) => {
				if (a.type === 'folder' && b.type !== 'folder') return -1;
				else if (a.type !== 'folder' && b.type === 'folder' ) return 1;
				else return 0;
			});
		}

	}

	if ( options.sortSubfolders ) {
		traverseNodes(nodeCopy, n => {
			sortChildren(n);
		});
	} else {
		sortChildren(nodeCopy);
	}

	return nodeCopy;
}

function repairNodeTree(tree, hide) {
	
	let repaired = false;
	
	// append orphans
	for (let se of userOptions.searchEngines) {

		if (!se.id || findNodes(tree, node => node.id === se.id).length === 0) {
			
			repaired = true;
			
			if (!se.id) {
				console.log(se.title + ' has no id. Generating...');
				se.id = gen();
			}
			
			console.log(se.id + " is not in node tree. Appending ...");
			tree.children.push({
				id: se.id,
				type: "searchEngine",
				hidden: hide,
				title: se.title,
				contexts:32
			});
		}
	}

	let nodesToRemove = findNodes(tree, (node, parent) => {
		
		if ( !node ) {
			node.parent = parent;
			console.log('removing null node');
			return true;
		}

		if ( node.type === 'searchEngine' && !userOptions.searchEngines.find( se => se.id === node.id ) ) {
			node.parent = parent;
			console.log('removing dead search engine node ' + node.title);
			return true;	
		}

		if ( node.type === 'siteSearchFolder') {
		//	node.parent = parent; // causes cyclic object
			delete node.children;
			node.type = "searchEngine";
			console.log('repairing siteSearchFolder ' + node.title);
			return false;
		}
	});
	
	if ( nodesToRemove.length ) repaired = true;
	
	nodesToRemove.forEach( node => removeNode(node, node.parent) );
	
	if ( browser.search && browser.search.get ) {
		
		return browser.search.get().then( ocses => {
			
			let nodesToRemove = findNodes(tree, (node, parent) => {
				
				if ( node.type === 'oneClickSearchEngine' && !ocses.find( ocse => ocse.name === node.title ) ) {
					node.parent = parent;
					console.log('removing dead one-click search engine node ' + node.title);
					return true;
				}
			});
			
			if ( nodesToRemove.length ) repaired = true;
			
			nodesToRemove.forEach( node => removeNode(node, node.parent) );
			
			return Promise.resolve(repaired);
			
		});
	} else {
		return Promise.resolve(repaired);
	}
}

function getIconFromNode(node) {

	let iconUrl = (() => {
	
		if ( node.type === "searchEngine" || node.type === "siteSearch" || node.type === "siteSearchFolder") {
			let se = userOptions.searchEngines.find( se => se.id === node.id );
			if ( !se ) return browser.runtime.getURL('icons/search.svg');
			if ( userOptions.cacheIcons ) return se.icon_base64String || se.icon_url || browser.runtime.getURL('icons/search.svg');
			else return se.icon_url || browser.runtime.getURL('icons/search.svg');
		} else if ( node.type === "bookmarklet" ) {
			return node.icon || browser.runtime.getURL('icons/code_color.svg');
		} else if ( node.type === "folder" ) {
			return node.icon || browser.runtime.getURL('icons/folder-icon.svg');	
		} else if ( node.type === "externalProgram" ) {
			return node.icon || browser.runtime.getURL('icons/terminal_color.svg');
		} else {
			return node.icon || "";
		}
	})();

	return iconUrl.replace(/http:\/\//, "https://");
}

function nodeCut(node, parent) {
	node.parent = node.parent || parent;
	return node.parent.children.splice(node.parent.children.indexOf(node), 1).shift();
}

function nodeInsertBefore(node, sibling) {
	node.parent = sibling.parent;
	node.parent.children.splice(node.parent.children.indexOf(sibling), 0, node);
}

function nodeInsertAfter(node, sibling) {
	node.parent = sibling.parent;
	node.parent.children.splice(node.parent.children.indexOf(sibling) + 1, 0, node);
}

function nodeAppendChild(node, parent) {
	node.parent = parent;
	node.parent.children.push(node);
}

function removeConsecutiveSeparators(tree) {
	// remove consecutive separators
	traverseNodes(tree, (n,p) => {
		if ( !p ) return;

		let index = p.children.indexOf(n);
		if ( n.type === 'separator' && index && p.children[index - 1].type === 'separator' )
			removeNode(n, p);
	});

	return tree;
}

const getSearchEngineById = id => userOptions.searchEngines.find(se => se.id === id);
const getSearchEngineByNode = n => getSearchEngineById(n.id);
const isFolder = n => n.type === 'folder';
const isSearchEngine = n => n.type === 'searchEngine';
const isOneClickSearchEngine = n => n.type === 'oneClickSearchEngine';
const isMultiSearchEngine = n => {

	if ( !isSearchEngine(n) ) return false;
	
	try {

		if ( !n.template ) {
			let se = userOptions.searchEngines.find( _se => _se.id == n.id );
			let ts = JSON.parse(se.template);
			return Array.isArray(ts);
		} else {
			let ts = JSON.parse(n.template);
			return Array.isArray(ts);
		}
	} catch (error) {}

	return false;
}

const specialFolderIds = ["___recent___", "___matching___", "___tools___"];

const isSpecialFolderChild = el => {
	return el.node && el.node.parent && specialFolderIds.includes(el.node.parent.id);
}

function createNode(type) {
	if ( type === "separator");
}

const nodeDefaults = {
	"folder": {
		"type": "folder",
		"children": [],
		"displayType": "",
		"groupColor": "#CED7FF",
		"groupColorText": "#444444",
		"groupFolder": "block",
		"groupHideMoreTile": false,
		"groupLimit": 2,
		"hotkey": null,
		"icon": "",
		"iconCache": "",
		"id": "",
		"parentId": "",
		"shortcut": null,
		"title": ""
	},
	"searchEngine": {
		"type": "searchEngine",
		"contexts": 32,
		"hidden": false,
		"id": "",
		"keyword": "",
		"parentId": "",
		"title": ""
	},
	"separator": {
		"type": "separator",
		"parentId": ""
	},
	"bookmarklet": {
		"type": "bookmarklet",
		"contexts": 32,
		"description": "",
		"icon": "",
		"iconCache": "",
		"id": "",
		"keyword": "",
		"parentId": "",
		"searchCode": "",
		"title": ""
	},
	"externalProgram": {
		"type": "externalProgram",
		"contexts": 32,
		"cwd": "",
		"description": "",
		"icon": "",
		"iconCache": "",
		"id": "",
		"parentId": "",
		"path": "",
		"postScript": "",
		"searchRegex": "",
		"title": ""
	}

}
	
