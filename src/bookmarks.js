class CSBookmarks {
	
	static getType(node) { // for cross-browser compatibility
		if ( node.type === 'bookmark' || ( !node.type && node.url ) )
			return 'bookmark';
		
		if ( node.type === 'folder' || node.children )
			return 'folder';
		
		if ( node.type === 'separator' )
			return 'separator';
		
		return "";
	}

	static get() {
		
		if (browser.bookmarks === undefined) return Promise.resolve(false);
		
		return browser.bookmarks.search({title: browser.i18n.getMessage("ContextSearchMenu")}).then( bookmarks => {

			if (bookmarks.length === 0) return false;
			return bookmarks[0];
		});
	}
	
	static getAll() {
		
		if (browser.bookmarks === undefined) return Promise.resolve(false);
		
		return this.get().then( bookmark => {

			if (!bookmark) return false;
			
			return browser.bookmarks.getSubTree(bookmark.id);				
		});
	}

	static requestPermissions() {
		console.log('requesting permissions');
		
		function onResponse(response) {
			if (response) {
				console.log("Permission was granted");
				return true;
				
			} else {
				console.log("Permission was refused");
				return false;
			} 
		}
		
		return browser.permissions.request({permissions: ["bookmarks"]}).then(onResponse);
	}

	static treeToFolders(id) {
		
		if (browser.bookmarks === undefined) return Promise.resolve(false);
		
		let root = {};
		
		return this.getAll().then( tree => {
			
			if (!tree) return [];

			tree = tree.shift();
			
			root.title = tree.title;
			root.id = tree.id;
			root.children = [];
			root.type = "folder";
			root.title = "/";
			
			function traverse(node, target) {

				if ( CSBookmarks.getType(node) === 'bookmark' ) {
					
					let index = userOptions.searchEngines.findIndex( se => se.title === node.title);
					
					if ( index === -1 && !node.url.startsWith("javascript") ) return;
					
					if ( node.url.startsWith("javascript") ) {
						target.children.push({
							type: "bookmarklet",
							title: node.title,
							id: node.id,
							url: node.url
						});
						
						return;
					}

					target.children.push({
						type: "searchEngine",
						title: node.title,
						id: userOptions.searchEngines[index].id
					});
				}
				
				if ( CSBookmarks.getType(node) === 'folder' ) {
					
					let folder = {
						type: "folder",
						title: node.title,
						children: []
					}

					target.children.push(folder);
					
					node.children.forEach( child => traverse(child, folder) );
				}
				
				if (node.type === 'separator' /* firefox */) {
					target.children.push({
						type: "separator"
					});
				}
			}
			
			tree.children.forEach( child => traverse(child, root) );
			
			return root;
		});
	}
	
	static getPath() {
		
		if (browser.bookmarks === undefined) return Promise.resolve("");
		
		return this.getAll().then( b => {
			
			let paths = [];

			function p(bm) {
				paths.unshift(bm.title);

				if (bm.parentId) {
					return browser.bookmarks.get(bm.parentId).then( bm => {
						return p(bm.shift());
					});
				} else {
					return Promise.resolve(paths.join(' / '));
				}
			}
			
			b = b.shift();
			return p(b);

		});
	}
	
	static getAllBookmarklets() {
		if (browser.bookmarks === undefined) return Promise.resolve("");
		
		return browser.bookmarks.getTree().then( tree => {
			
			tree = tree.shift();
			
			let results = [];
			
			function traverse(node) {

				if ( CSBookmarks.getType(node) === 'folder' ) 
					node.children.forEach( child => traverse(child) );
				
				if ( CSBookmarks.getType(node) === 'bookmark' && node.url.startsWith("javascript") )
					results.push(node);
			}
			
			traverse(tree);
			
			return results;
		});
	}
		
}