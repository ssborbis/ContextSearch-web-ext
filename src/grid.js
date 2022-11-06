class Grid {

	constructor(o) {
		this.o = o;
	}

	saveGrid(o) {

		o = o || this.o;

		if ( !o ) return;

		let table = $(o.tableId);
		let grid_array = [...table.querySelectorAll('img')].map(i => i.nodeid);

		o.grid = grid_array;

		o.onSave(o);
		saveOptions();
	}

	static makeEmptyGridNode() {	
		return {
			id: null,
			type: "bookmarklet",
			icon: browser.runtime.getURL('/icons/empty.svg'),
			title: ""
		}
	}

	makeGrid() {
		let o = this.o;
		let rows = o.rows;
		let cols = o.cols;

		let saveGrid = this.saveGrid;

		let nodes = findNodes(userOptions.nodeTree, n => ["searchEngine", "oneClickSearchEngine", "bookmarklet", "folder"].includes(n.type) && n !== userOptions.nodeTree );
		
		let gridNodes = [];
		
		o.grid.forEach( g => {
			if ( !g ) 
				gridNodes.push(Grid.makeEmptyGridNode());
			else
				gridNodes.push(nodes.find(n => n.id === g));
		});
		
		if ( !gridNodes.length ) gridNodes = nodes;

		let table = $(o.tableId);
		table.innerHTML = null;

		let i = 0;

		for ( let row=0;row<rows;row++) {
			let tr = document.createElement('tr');
			table.appendChild(tr);
			for ( let col=0;col<cols;col++ ) {
				let td = document.createElement('td');
				let node = gridNodes[i++];
				
				// outside array bounds
				if ( !node ) node = Grid.makeEmptyGridNode();
				
				let icon = getIconFromNode(node);
				
				let img = new Image();
				img.src = icon;
				img.nodeid = node.id;
				img.title = node.title;

				if ( node.hidden ) img.style.opacity = .5;
				
				img.ondragover = function(e) { e.preventDefault();}
				img.ondrop = function(e) {
					e.preventDefault();

					if ( table.contains(window.dragSource) ) {
						let td1 = window.dragSource.parentNode;
						let td2 = img.parentNode;
						
						td2.appendChild(window.dragSource);
						td1.appendChild(img);
					} else {
						let srcImg = window.dragSource.querySelector('img');
						img.src = srcImg ? srcImg.src : window.dragSource.src;
						img.nodeid = window.dragSource.nodeid;
						img.title = window.dragSource.title;
					}

					saveGrid(o);
				}
				
				img.ondragstart = function(e) {
					e.dataTransfer.setData("text/plain", node.id);
					e.effectAllowed = "copyMove";
					// e.preventDefault();
					window.dragSource = img;
				}

				img.addEventListener('click', () => {
					let node = Grid.makeEmptyGridNode();
					let icon = getIconFromNode(node);
					
					img.src = icon;
					img.nodeid = node.id;
					img.title = node.title;

					saveGrid(o);
				});

				td.appendChild(img);
				tr.appendChild(td);
			}
		}

		o.onLoad();

	}

	makeFolderBrowser() {
		let ul = makeFolderBrowser(userOptions.nodeTree);
		$(this.o.browserId).parentNode.insertBefore(ul, $(this.o.browserId));
		$(this.o.browserId).parentNode.removeChild($(this.o.browserId));
	}
}
