var userOptions;

function init(message) {
	sendMessage({action: "getUserOptions"}).then( uo => {
		userOptions = uo;

		setTheme();
		setUserStyles();
		makePageTiles(message);
		
		if ( userOptions.pageTiles.closeOnShake ) {
			let ds = new DragShake();
			ds.onshake = () => close();
			ds.start();
		}
	})
}

// document.addEventListener('mouseup', e => console.info('iframe captured mouseup'));
// document.addEventListener('drop', e => console.info('iframe captured drop'))

var colors;

function createSVG(title) {

	// targeting the svg itself
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

	// make a simple rectangle
	let textPath = document.createElementNS(svg, "text");

	textPath.setAttribute("x", "0");
	textPath.setAttribute("y", "0");
	textPath.setAttribute("fill", "#5cceee");
	textPath.innerText = title;

	// append the new rectangle to the svg
	svg.appendChild(textPath);

	return svg;
}

function makePageTiles(message) {

	var mainDiv = document.createElement('div');
	mainDiv.className = "pageTilesContainer";

	let rows = userOptions.pageTiles.rows;
	let cols = userOptions.pageTiles.columns;

	colors = userOptions.pageTiles.paletteString.split('-');

	let nodes = findNodes(userOptions.nodeTree, n => true);

	let gridNodes = userOptions.pageTiles.grid.map( id => nodes.find( n => n.id === id) || {id: null, type: "bookmarklet", title: "", icon: browser.runtime.getURL('/icons/empty.svg')} );

	// speedDial replace
	if ( message.nodes ) {
		gridNodes = [...message.nodes];
		rows = 3;
		cols = 3;

		while ( gridNodes.length < rows * cols ) {
			gridNodes.push({id: null, type: "bookmarklet", title: "", icon: browser.runtime.getURL('/icons/empty.svg')})
		}

		mainDiv.classList.add("speedDial");
	}

	gridNodes = gridNodes.slice(0, rows * cols);

	mainDiv.style.setProperty("--cs-pagetilerows", rows);
	mainDiv.style.setProperty("--cs-pagetilecols", cols);

	gridNodes.forEach( (node, index) => {

		let div = document.createElement('div');
		div.className = 'pageTile';
		div.title = node.title + (node.description ? " - " + node.description : "");

		let img = new Image();
		img.src = getIconFromNode(node);
		div.appendChild(img);

		let header = document.createElement('div');
		header.innerText = node.title;
		div.appendChild(header);
		// let text = createSVG(node.title);
		// div.appendChild(text);
		
		node.icon = getIconFromNode(node);

		if ( colors.length !== 0 ) {
			let bgcolor = '#' + colorFromString(node.id || node.type);
			div.style.setProperty("--tile-color", bgcolor);
			// div.style.backgroundColor = bgcolor;
			if ( getLuma(bgcolor) < 140) div.style.color = '#ccc ';
		} else {
			div.style.filter = 'none';
		}

		// div.style.backgroundImage = `url(${node.icon})`;

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

			searchTerms = message.searchTerms;

			if ( !searchTerms ) return;

			sendMessage({
				action: "search", 
				info: {
					menuItemId: node.id,
					selectionText: searchTerms,
					openMethod: e.type === "mouseup" ? getOpenMethod(e) : userOptions.pageTiles.openMethod
				}
			});
			
			close();
		}
		
		div.addEventListener('dragend', close);
		div.addEventListener('click', close);
		div.addEventListener('drop', close);
		
		// clear events for empty tiles
		if ( !node.id ) div.classList.add('empty');

		mainDiv.appendChild(div);

		// add breaks
		if ( index + 1 >= cols && (index + 1) % cols === 0 )
			mainDiv.appendChild(document.createElement('br'));
	});

	document.body.appendChild(mainDiv);
	mainDiv.getBoundingClientRect();
	mainDiv.style.opacity = 1;

	// close when dragging over "border"
	window.addEventListener('dragover', e => {
		if ( userOptions.pageTiles.closeOnBorder && e.target === document.documentElement ) close();		
	});

	// chrome border close
	window.addEventListener("message", e => {
		if ( userOptions.pageTiles.closeOnBorder && window.chrome && e.data.eventType && e.data.eventType === 'dragover' ) {			
			let el = document.elementFromPoint(e.data.offsetX, e.data.offsetY);
			if ( el && el === document.documentElement ) close();
		}
	});
}

document.addEventListener('keydown', e => {
	if ( e.key == "Escape" ) close();
});

document.addEventListener('click', e => {
	close();
});

document.addEventListener('contextmenu', e => e.preventDefault())

let close = () => sendMessage({action: "closePageTiles"});

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

	if ( e.data.eventType && e.data.eventType === 'drop' ) {
		let el = document.elementFromPoint(e.data.offsetX, e.data.offsetY);

		if ( el === document.body ) close();

		return el.ondrop(new DragEvent('drop'));
	}

	if ( e.data.init ) return init(e.data);
});
