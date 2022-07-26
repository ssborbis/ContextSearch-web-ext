var userOptions;

browser.runtime.sendMessage({action: "getUserOptions"}).then( uo => {
	userOptions = uo;

	setUserStyles();
	makePageTiles();
	
	if ( userOptions.pageTiles.closeOnShake ) {
		let ds = new DragShake();
		ds.onshake = () => close();
		ds.start();
	}
})

// document.addEventListener('mouseup', e => console.info('iframe captured mouseup'));
// document.addEventListener('drop', e => console.info('iframe captured drop'))

var colors;

function makePageTiles() {

	var mainDiv = document.createElement('div');
	mainDiv.className = "pageTilesContainer";

	let rows = userOptions.pageTiles.rows;
	let cols = userOptions.pageTiles.columns;

	mainDiv.style.setProperty("--cs-pagetilerows", rows);
	mainDiv.style.setProperty("--cs-pagetilecols", cols);

	colors = userOptions.pageTiles.paletteString.split('-');

	let nodes = findNodes(userOptions.nodeTree, n => true);

	let gridNodes = userOptions.pageTiles.grid.map( id => nodes.find( n => n.id === id) || {id: null, type: "bookmarklet", title: "", icon: browser.runtime.getURL('/icons/empty.svg')} );

	gridNodes = gridNodes.slice(0, rows * cols);

	gridNodes.forEach( node => {

		let div = document.createElement('div');
		div.className = 'pageTile';

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
			e.preventDefault();
			div.classList.remove('dragover');
		}
		div.ondragover = e => e.preventDefault();

		div.onmouseenter = div.ondragenter;
		div.onmouseleave = div.ondragleave;

		div.onmouseup = searchHandler;
		div.ondrop = searchHandler;
			
		async function searchHandler(e) {
			e.preventDefault();

			if ( node.hidden ) return;

			let message = await browser.runtime.sendMessage({action: "getLastSearch"});

			searchTerms = message.lastSearch;

			if ( !searchTerms ) return;

			browser.runtime.sendMessage({
				action: "search", 
				info: {
					menuItemId: node.id,
					selectionText: searchTerms,
					openMethod: userOptions.pageTiles.openMethod
				}
			});
			
			close();
		}
		
		div.addEventListener('dragend', close);
		div.addEventListener('click', close);
		div.addEventListener('drop', close);
		
		// clear events for empty tiles
		if ( !node.id || node.hidden ) div.classList.add('empty');

		mainDiv.appendChild(div);
	});

	document.body.appendChild(mainDiv);
	mainDiv.getBoundingClientRect();
	mainDiv.style.opacity = 1;
}

document.addEventListener('keydown', e => {
	if ( e.key == "Escape" ) close();
});

let close = () => browser.runtime.sendMessage({action: "closePageTiles"});

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

// drag overdiv listener
window.addEventListener("message", e => {
	if ( !e.data.drop ) return;
	let el = document.elementFromPoint(e.data.offsetX, e.data.offsetY);
	if ( el === document.body ) close();

	el.ondrop(new DragEvent('drop'));
});