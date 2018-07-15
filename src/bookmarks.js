window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

class CSBookmarks {
	
	static getType(node) {
		if ( node.type === 'bookmark' || ( !node.type && node.url ) )
			return 'bookmark';
		
		if ( node.type === 'folder' || node.children )
			return 'folder';
		
		if ( node.type === 'separator' )
			return 'separator';
		
		return "";
	}
	
	static create() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
	
		function onFulfilled(bookmarks) {
			
			if (bookmarks.length === 0) {
				
				let createOptions = {
					title: browser.i18n.getMessage("ContextSearchMenu")
				}
				
				if (browser.bookmarks.BookmarkTreeNodeType)
					createOptions.type = 'folder';
				
				return browser.bookmarks.create( createOptions ).then( (bm) => {
					return bm;
				}).then((bm) => {
					
					for (let i=userOptions.searchEngines.length-1;i>-1;i--) {
						let se = userOptions.searchEngines[i];
						browser.bookmarks.create({
							parentId: bm.id,
							title: se.title,
							url: se.template
						});
					}
					
					// userOptions.contextMenuBookmarksFolderId = bm.id;
					// notify({action: "saveUserOptions", userOptions:userOptions});
					
					console.log("ContextSearch Menu bookmark created with id=" + bm.id);
					return bm;
				});
			} else {
				console.log("ContextSearch Menu bookmark exists");
				browser.bookmarks.getChildren(bookmarks[0].id).then((children) => {
					console.log(children);
				});
			}

		}

		function onRejected(error) {
			console.log(`An error: ${error}`);	
		}

		var gettingBookmarks = browser.bookmarks.search({title: browser.i18n.getMessage("ContextSearchMenu")});
		return gettingBookmarks.then(onFulfilled, onRejected);
	}
	
	static get() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return browser.bookmarks.search({title: browser.i18n.getMessage("ContextSearchMenu")}).then((bookmarks) => {

			if (bookmarks.length === 0) return false;
			return bookmarks[0];
		});
	}
	
	static getAll() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.get().then( (bookmark) => {

			if (!bookmark) return false;
			
			return browser.bookmarks.getSubTree(bookmark.id);				
		});
	}
	
	static getNames() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.getAll().then((tree) => {
			
			if (!tree) return [];
			
			let names = [];
			
			tree = tree.shift();
			
			function traverse(node) {
				
				if ( CSBookmarks.getType(node) === 'bookmark' ) names.push(node.title);
				
				if ( CSBookmarks.getType(node) === 'folder' ) {
					for (let child of node.children)
						traverse(child);
				}
			}
			
			traverse(tree);
			
			return names;
		});
	}

	static find(str) {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.getAll().then((tree) => {
			
			if (!tree) return -1;
			
			tree = tree.shift();
			
			function traverse(node) {
				
				if ( CSBookmarks.getType(node) === 'bookmark' && node.title === str) return node.id;
				
				if ( CSBookmarks.getType(node) === 'folder' ) {
					for (let child of node.children) {
							
						let id = traverse(child);
						if ( id !== -1)
							return id;
					}
				}
				
				return -1;
			}
			
			return traverse(tree);
		});
	}
	
	static remove(str) {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		this.find(str).then( (result) => {
			if (result === -1) return false;
			
			console.log('removing bookmark ' + result);
			return browser.bookmarks.remove(result);
		});
	}
	
	static removeAll() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		this.getAll().then( (tree) => {
			tree = tree.shift();
			
			console.log('removing all bookmarks');
			for (let child of tree.children)
				browser.bookmarks.removeTree(child.id);	
		});
	}
	
	static add(se) {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.find(se.title).then( (result) => {
			if (result !== -1) return false;
			
			return this.get().then( (bm) => {
				
				if (!bm) return false;
				
				console.log('adding bookmark');
				
				return browser.bookmarks.create({
					parentId: bm.id,
					title: se.title,
					url: se.template
				});
	
			});
		});
	}
	
	static rename(oldName, newName) {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.find(oldName).then( (result) => {
						
			if (result === -1) return false;
			
			console.log('renaming bookmark');

			return browser.bookmarks.update(result, {
				title: newName
			});
		});
	}
	
	static requestPermissions() {
		console.log('requesting permissions');
		
		function onResponse(response) {
			if (response) {
				console.log("Permission was granted");
				CSBookmarks.create();
				return true;
				
			} else {
				console.log("Permission was refused");
				return false;
			} 
		}
		
		return browser.permissions.request({permissions: ["bookmarks"]}).then(onResponse);
	}
	
	static buildContextMenu() {
		
		console.log('buildBookmarks');
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});

		this.getAll().then((bookmark) => {
				
			if (!bookmark) return false;

			bookmark = bookmark.shift();
			
			function traverse(node) {

				if ( CSBookmarks.getType(node) === 'bookmark' ) {
			
					let index = userOptions.searchEngines.findIndex( (se) => {
						return se.title === node.title;
					});
					
					// skip renamed / orphaned bookmarks
					// if (index === -1) return;
					
					// bookmarklets
					if (index === -1 && node.url.match(/^javascript/) === null) return;

					let se = userOptions.searchEngines[index] || {title: node.title}; // bookmarklets
					
					let createOptions = {
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						title: se.title,
						id: (index !== -1) ? index.toString() : node.id, // bookmarklets
						contexts: ["selection", "link", "image"]	
					}
					
					if (browser.bookmarks.BookmarkTreeNodeType) {
						createOptions.icons = {
							"16": se.icon_base64String || se.icon_url || "/icons/icon48.png",
							"32": se.icon_base64String || se.icon_url || "/icons/icon48.png"
						}
					}

					browser.contextMenus.create( createOptions );
				}
				
				if (node.type === 'separator' /* firefox */) {
					browser.contextMenus.create({
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						type: "separator"
					});
				}
				
				if ( CSBookmarks.getType(node) === 'folder' ) {
					
					let createOptions = {
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						id: node.id,
						title: node.title,
						contexts: ["selection", "link", "image"]
					}
					
					if (browser.bookmarks.BookmarkTreeNodeType) {
						createOptions.icons = {
							"16": "/icons/folder.png",
							"32": "/icons/folder.png"
						}
					}

					browser.contextMenus.create( createOptions );
					
					for (let child of node.children) traverse(child);
				}
				
			}
			
			for (let child of bookmark.children) 
				traverse(child);
		});
	}
	
	static isDescendent(id) {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});

		return this.getAll().then((tree) => {
			
			tree = tree.shift();
			
			function traverse(node) {

				if ( CSBookmarks.getType(node) === 'folder' ) {
					for (let child of node.children) {
						let found = traverse(child);
						if (found) return true;
					}
				}
				
				if (node.id === id) return true;
			}
			
			return traverse(tree);	
		});
	}
}