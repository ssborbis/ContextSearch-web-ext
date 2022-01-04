class Grid {

	constructor(o) {
		this.o = o;
	}

	saveGrid(o) {

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

		let nodes = findNodes(userOptions.nodeTree, n => ["searchEngine", "oneClickSearchEngine", "bookmarklet", "folder"].includes(n.type));
		
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
		let ul = $(this.o.browserId);

		traverse(userOptions.nodeTree, ul);

		function traverse(node, parentEl) {

			if ( !node.id ) return;
			
			let _li = document.createElement('li');
			_li.nodeid = node.id;
			_li.title = node.title;
			let icon = getIconFromNode(node);

			_li.innerHTML = `<img src="${icon}" /> ${node.title}`;
			parentEl.appendChild(_li);

			if ( node.hidden ) _li.style.opacity = .5;

			if ( node.children ) {
				let _ul = document.createElement('ul');
				_li.appendChild(_ul);

				let collapse = document.createElement('span');
				collapse.innerText = '+';
				_li.insertBefore(collapse,_li.firstChild);
				_ul.style.display = 'none';

				collapse.onclick = function() {	
					_ul.style.display = _ul.style.display ? null : 'none';
					collapse.innerText = _ul.style.display ? "+" : "-";
				}

				node.children.forEach( child => traverse(child, _ul) );
			}
		}

		ul.querySelectorAll('li').forEach( li => {

			li.setAttribute("draggable", "true");

			li.ondragstart = function(e) {
				e.stopPropagation();

				e.dataTransfer.setData("text/plain", li.nodeid);
				e.effectAllowed = "copyMove";
				// e.preventDefault();
				window.dragSource = li;
			}

			li.ondragend = function(e) {e.preventDefault();}
		});

		ul.querySelector('ul').style.display = null;
	}

}
