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
			return bookmarks[0];
		});
	}
	
	static getAll() {
		
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.get().then( (bookmark) => {
			return browser.bookmarks.getSubTree(bookmark.id);
		});
	}
	
	static getNames() {
		if (browser.bookmarks === undefined) return new Promise(()=>{return false;},()=>{return false});
		
		return this.getAll().then((tree) => {
			
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
		
		this.find(se.title).then( (result) => {
			if (result !== -1) return false;
			
			this.get().then( (bm) => {

				browser.bookmarks.create({
					parentId: bm.id,
					title: se.title,
					url: se.template
				});
				
				console.log('adding bookmark');
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
}