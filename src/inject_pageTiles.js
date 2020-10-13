document.addEventListener('dragstart', async e => {
	
	if ( !userOptions.pageTiles.enabled ) return;
	
	let pageTilesFolder = findNode( userOptions.nodeTree, n => n.type === "folder" && n.title === "Page Tiles" );
	
	if ( !pageTilesFolder ) return false;
	
	//await new Promise(r => setTimeout(r, 50));
	
	let selectedText = getSelectedText(e.target);
	
	if (!selectedText) return false;
	
	e.dataTransfer.setData("text/plain", selectedText);

	var mainDiv = document.createElement('div');
	mainDiv.className = "CS_pageTilesContainer";

	let rows = Math.ceil(Math.sqrt(pageTilesFolder.children.length));
	let cols = Math.ceil(pageTilesFolder.children.length / rows);
	
	mainDiv.style.setProperty("--cs-pagetilerows", rows);
	mainDiv.style.setProperty("--cs-pagetilecols", cols);

	let nodes = findNodes(userOptions.nodeTree, n => true);
	
	let gridNodes = userOptions.pageTiles.grid.map( id => nodes.find( n => n.id === id) );
	
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
					openMethod: "openBackgroundTab"
				}
			});
			
			mainDiv.parentNode.removeChild(mainDiv);
		}
		
		div.addEventListener('dragend', () => {mainDiv.parentNode.removeChild(mainDiv)});
		div.addEventListener('click', () => {mainDiv.parentNode.removeChild(mainDiv)});
		
		mainDiv.appendChild(div);
	});

	setTimeout(() => { // chrome / slow browser fix
		document.body.appendChild(mainDiv);
	}, 50);
});

