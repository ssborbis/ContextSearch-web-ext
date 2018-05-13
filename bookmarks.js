class CSBookmarks {
	
	static create() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
	
		function onFulfilled(bookmarks) {
			
			if (bookmarks.length === 0) {
				browser.bookmarks.create({
					title: 'ContextSearch Menu',
					type: 'folder'
				}).then( (bm) => {
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
					
					console.log("ContextSearch Menu bookmark created");
					return;
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

		var gettingBookmarks = browser.bookmarks.search({title: "ContextSearch Menu"});
		gettingBookmarks.then(onFulfilled, onRejected);
	}
	
	static get() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return browser.bookmarks.search({title: "ContextSearch Menu"}).then((bookmarks) => {

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
				
				if (node.type === 'bookmark') names.push(node.title);
				
				if (node.type === 'folder') {
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
				
				if (node.type === 'bookmark' && node.title === str) return node.id;
				
				if (node.type === 'folder') {
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
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		this.getAll().then((bookmark) => {
				
			if (!bookmark) return false;

			bookmark = bookmark.shift();
			
			function traverse(node) {

				if (node.type === 'bookmark') {
			
					let index = userOptions.searchEngines.findIndex( (se) => {
						return se.title === node.title;
					});
					
					// skip renamed / orphaned bookmarks
					if (index === -1) return;
					
					let se = userOptions.searchEngines[index];
					
					browser.contextMenus.create({
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						title: se.title,
						id: index.toString(),
						contexts: ["selection", "link"],
						icons: {
							"16": se.icon_base64String || se.icon_url || "/icons/icon48.png",
							"32": se.icon_base64String || se.icon_url || "/icons/icon48.png"
						}
					});
				}
				
				if (node.type === 'separator') {
					browser.contextMenus.create({
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						type: "separator"
					});
				}
				
				if (node.type === 'folder') {
					browser.contextMenus.create({
						parentId: (node.parentId === bookmark.id) ? "search_engine_menu" : node.parentId,
						id: node.id,
						title: node.title,
						icons: {
							"16": "/icons/folder.png",
							"32": "/icons/folder.png"
						}
					});
					
					for (let child of node.children) traverse(child);
				}
				
			}
			
			for (let child of bookmark.children) 
				traverse(child);
		});
	}
}