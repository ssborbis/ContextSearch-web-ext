function makeEmptyGridNode() {	
	return {
		id: null,
		type: "bookmarklet",
		icon: browser.runtime.getURL('/icons/empty.svg'),
		title: ""
	}
}

function makePageTilesGrid() {
	let rows = parseInt($('pageTiles.rows').value);
	let cols = parseInt($('pageTiles.columns').value);

	let nodes = findNodes(userOptions.nodeTree, n => ["searchEngine", "oneClickSearchEngine", "bookmarklet", "folder"].includes(n.type));
	
	let gridNodes = [];
	
	userOptions.pageTiles.grid.forEach( g => {
		if ( !g ) 
			gridNodes.push(makeEmptyGridNode());
		else
			gridNodes.push(nodes.find(n => n.id === g));
	});
	
	if ( !gridNodes.length ) gridNodes = nodes;
		
	// let w_ratio = window.screen.width / cols;
	// let h_ratio = window.screen.height / rows;

	let table = $('#pageTilesTable');
	table.innerHTML = null;
	// table.style.setProperty("--width-ratio", w_ratio / h_ratio);
	let i = 0;

	for ( row=0;row<rows;row++) {
		let tr = document.createElement('tr');
		table.appendChild(tr);
		for ( col=0;col<cols;col++ ) {
			let td = document.createElement('td');
			let node = gridNodes[i++];
			
			// outside array bounds
			if ( !node ) node = makeEmptyGridNode();
			
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

				setPageTilesGridPalette();
				saveGrid();
			}
			
			img.ondragstart = function(e) {
				e.dataTransfer.setData("text/plain", node.id);
				e.effectAllowed = "copyMove";
				// e.preventDefault();
				window.dragSource = img;
			}

			img.onclick = function() {
				let node = makeEmptyGridNode();
			
				let icon = getIconFromNode(node);
				
				img.src = icon;
				img.nodeid = node.id;
				img.title = node.title;

				setPageTilesGridPalette();
				saveGrid();
			}

	
			td.appendChild(img);
			tr.appendChild(td);
		}
	}

	setPageTilesGridPalette();

}

function saveGrid() {
	let table = $('#pageTilesTable');
	let grid_array = [...table.querySelectorAll('img')].map(i => i.nodeid);

	userOptions.pageTiles.grid = grid_array;
	saveOptions();
}

function makePageTilesPalette() {
	let s = $('pageTiles.paletteString');
	palettes.forEach( (p,index) => {
		let o = document.createElement('option');
		o.value = p.color;
		o.innerText = p.name;
		s.appendChild(o);
	});

	s.value = userOptions.pageTiles.paletteString;
}

function makePageTilesPaletteSample() {
	let span = $('#pageTilesPaletteSample');
	let s = $('pageTiles.paletteString');

	span.innerHTML = null;

	let colors = s.value.split('-');
	colors.forEach(c => {
		let cdiv = document.createElement('div');
		cdiv.style = "display:inline-block;width:16px;height:16px;margin:2px";
		cdiv.style.backgroundColor = '#' + c;
		span.appendChild(cdiv);
	});
}

function setPageTilesGridPalette() {
	let colors = userOptions.pageTiles.paletteString.split('-');
	function colorFromString(str) {
		let num = 0;
		let letters = str.split('');
		letters.forEach(l => num+=l.charCodeAt(0));
		let index = num % colors.length;

		return colors[index];
	}

	$('#pageTilesTable').querySelectorAll('img').forEach( img => {
		let node = findNode(userOptions.nodeTree, n => n.id === img.nodeid);

		if ( !node ) {
			img.parentNode.style.boxShadow = null;
			return;
		}
		let color = colorFromString(node.id || gen());

	//	img.parentNode.style.backgroundColor = '#' + color;
		img.parentNode.style.boxShadow = 'inset 0px 0px 24px #' + color;
	});

}

function makePageTilesFolderBrowser() {
	let ul = $('#pageTilesFolderBrowser');

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

$('pageTiles.paletteString').addEventListener('change', makePageTilesPaletteSample);
$('pageTiles.paletteString').addEventListener('change', setPageTilesGridPalette);

$('pageTiles.enabled').addEventListener('change', e => {
	if ( !userOptions.pageTiles.grid.length )
		saveGrid();
});

document.addEventListener('userOptionsLoaded', () => {
	
	makePageTilesGrid();
	makePageTilesPalette();
	makePageTilesPaletteSample();
	makePageTilesFolderBrowser();
	
});

[$('pageTiles.rows'), $('pageTiles.columns')].forEach(el => {
	el.addEventListener('change', e => {
		makePageTilesGrid();
		saveOptions();
	});
});
