var colors;

document.addEventListener('dragstart', async e => {

	if ( !userOptions.pageTiles.enabled ) return;
		
	let selectedText = getSelectedText(e.target);

	if (!selectedText) return false;
	
	e.dataTransfer.setData("text/plain", selectedText);

	var mainDiv = document.createElement('div');
	mainDiv.className = "CS_pageTilesContainer";

	let rows = userOptions.pageTiles.rows;
	let cols = userOptions.pageTiles.columns;
	
	mainDiv.style.setProperty("--cs-pagetilerows", rows);
	mainDiv.style.setProperty("--cs-pagetilecols", cols);

	colors = userOptions.pageTiles.paletteString.split('-');

	let nodes = findNodes(userOptions.nodeTree, n => true);

	let gridNodes = userOptions.pageTiles.grid.map( id => nodes.find( n => n.id === id) || {id: null, type: "bookmarklet", title: "", icon: browser.runtime.getURL('/icons/empty.svg')} );
	
	gridNodes = gridNodes.slice(0, rows * cols);

	gridNodes.forEach( node => {

	//	if ( ['separator', 'folder'].includes(node.type) ) return;

		let div = document.createElement('div');
		div.className = 'CS_pageTile';

		let header = document.createElement('div');
		header.innerText = node.title;
		div.appendChild(header);
		
		node.icon = getIconFromNode(node);

		if ( colors.length !== 1 ) {
			let bgcolor = '#' + colorFromString(node.id || node.type);
			div.style.backgroundColor = bgcolor;
			if ( getLuma(bgcolor) < 140) div.style.color = '#ccc ';
		} else {
			div.style.filter = 'none';
		}

		div.style.backgroundImage = `url(${node.icon})`;

		div.ondragenter = function(e) { 
			e.preventDefault();
			div.classList.add('dragover');
		}
		div.ondragleave = function(e) { 
			if ( e.currentTarget.contains(e.relatedTarget) ) return; // prevent children triggering
			e.preventDefault();
			div.classList.remove('dragover');
		}
		div.ondragover = e => e.preventDefault();

		div.ondrop = searchHandler;
		div.onclick = searchHandler;
			
		function searchHandler(e) {
			e.preventDefault();
			const data = e.dataTransfer.getData("text/plain");			

			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: node.id,
					selectionText: data,
					openMethod: userOptions.pageTiles.openMethod
				}
			});
			
			mainDiv.parentNode.removeChild(mainDiv);
		}
		
		div.addEventListener('dragend', () => mainDiv.parentNode.removeChild(mainDiv));
		div.addEventListener('click', () => mainDiv.parentNode.removeChild(mainDiv));
		
		// // clear events for empty tiles
		if ( !node.id ) {
			div.classList.add('CS_pageTilesEmptyTile');
			// div.ondragover = null;
			// div.ondrop = div.click;
			// div.ondragleave = null;
			// div.ondragenter = null;
		}
		
		mainDiv.appendChild(div);
	});

	// chrome / slow browser fix
	setTimeout(() => document.body.appendChild(mainDiv), 50);
});

document.addEventListener('keydown', e => {
	if ( e.key !== "Escape" ) return;
	
	let el = document.querySelector('.CS_pageTilesContainer');
	
	if ( el ) el.parentNode.removeChild(el);
});

function colorFromString(str) {
	let num = 0;
	let letters = str.split('');
	letters.forEach(l => num+=l.charCodeAt(0));
	let index = num % colors.length;

	return colors[index];
}

function getLuma(hexcolor) {
	var c = hexcolor.substring(1);      // strip #
	var rgb = parseInt(c, 16);   // convert rrggbb to decimal
	var r = (rgb >> 16) & 0xff;  // extract red
	var g = (rgb >>  8) & 0xff;  // extract green
	var b = (rgb >>  0) & 0xff;  // extract blue

	return 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
}


