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

	let nodes = findNodes(userOptions.nodeTree, n => true);
	
	let gridNodes = userOptions.pageTiles.grid.map( id => nodes.find( n => n.id === id) || {id: null, type: "bookmarklet", title: "", icon: browser.runtime.getURL('/icons/empty.svg')} );
	
	gridNodes = gridNodes.slice(0, rows * cols);
	
	gridNodes.forEach( node => {
		
	//	if ( ['separator', 'folder'].includes(node.type) ) return;

		let div = document.createElement('div');
		div.className = 'CS_pageTile';
		div.innerText = node.title;
		
		if ( node.type === "searchEngine" ) {
			let se = userOptions.searchEngines.find(se => se.id === node.id);
			node.icon = se.icon_base64String || se.icon_url;
		}
		
		if ( node.type === "bookmarklet" )
			node.icon = node.icon || browser.runtime.getURL('icons/code.svg');
		
		div.style.backgroundImage = `url(${node.icon})`;

		div.ondragenter = function(e) { 
			e.preventDefault();
			div.classList.add('dragover');
		}
		div.ondragleave = function(e) { 
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
		
		div.addEventListener('dragend', () => {mainDiv.parentNode.removeChild(mainDiv)});
		div.addEventListener('click', () => {mainDiv.parentNode.removeChild(mainDiv)});
		
		// clear events for empty tiles
		if ( !node.id ) {
			div.ondragover = null;
			div.ondrop = null;
			div.onclick = null;
			div.ondragleave = null;
			div.ondragenter = null;
		}
		
		mainDiv.appendChild(div);
	});

	setTimeout(() => { // chrome / slow browser fix
		document.body.appendChild(mainDiv);
	}, 50);
});

document.addEventListener('keydown', e => {
	if ( e.key !== "Escape" ) return;
	
	let el = document.querySelector('.CS_pageTilesContainer');
	
	if ( el ) el.parentNode.removeChild(el);
});

