function findNodes(tree, callback) {
		
	let results = [];
	
	function _traverse(node, parent) {
				
		if (node && node.children) {

		//	for (let child of node.children) {
			for ( let i=node.children.length-1;i>=0;i--) {
				_traverse(node.children[i], node);
			}
		}

		if ( callback(node, parent) ) results.push(node);
	}
	
	_traverse(tree, null);
	 
	return results.reverse();
}

function findNode(tree, callback) {
	
	function _traverse(node, parent) {

		if (node && node.children) {

		//	for (let child of node.children) {
			for ( let i=node.children.length-1;i>=0;i--) {
				let found = _traverse(node.children[i], node);
				if ( found ) return found;
			}
		}

		if ( callback(node, parent) ) return node;
		
		// if ( callback(node, parent) ) return node;
		
		// if (node && node.children) {
		// 	for (let child of node.children) {
		// 		let found = _traverse(child, node);
		// 		if ( found ) return found;
		// 	}
		// }
		
		return null;
	}
	
	return _traverse(tree, null);
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

function repairNodeTree(tree) {
	
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
				hidden: true,
				title: se.title
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
			node.parent = parent;
			console.log('removing siteSearchFolder ' + node.title);
			return true;
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
			return se.icon_base64String || se.icon_url || browser.runtime.getURL('icons/search.svg');
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
	node.parent = parent || node.parent;
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

