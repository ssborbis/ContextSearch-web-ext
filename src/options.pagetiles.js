let pageTilesGrid = null;

function makePageTilesPalette() {
	let s = $('pageTiles.paletteString');
	s.innerHTML = null;
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
		img.parentNode.style.boxShadow = 'inset 0px 0px 24px #' + color;
	});

}

function makePageTilesGrid() {
	pageTilesGrid = new Grid({
		tableId: "pageTilesTable",
		browserId: "pageTilesFolderBrowser",
		rows: parseInt($('pageTiles.rows').value),
		cols: parseInt($('pageTiles.columns').value),
		grid: userOptions.pageTiles.grid,
		onSave: function(o) {
			setPageTilesGridPalette();
			userOptions.pageTiles.grid = o.grid;
		},
		onLoad: function(o) {
			setPageTilesGridPalette();
		}
	});

	pageTilesGrid.makeGrid();
	pageTilesGrid.makeFolderBrowser();
}

document.addEventListener('userOptionsLoaded', () => {	
	makePageTilesGrid();
	makePageTilesPalette();
	makePageTilesPaletteSample();

	if ( !userOptions.pageTiles.grid.length )
		pageTilesGrid.saveGrid();

	$('pageTiles.paletteString').addEventListener('change', makePageTilesPaletteSample);
	$('pageTiles.paletteString').addEventListener('change', () => {
		userOptions.pageTiles.paletteString = $('pageTiles.paletteString').value;
		setPageTilesGridPalette();
	});

	$('pageTiles.enabled').addEventListener('change', e => {
		if ( !userOptions.pageTiles.grid.length )
			pageTilesGrid.saveGrid();
	});

	[$('pageTiles.rows'), $('pageTiles.columns')].forEach(el => {
		el.addEventListener('change', e => {
			makePageTilesGrid();
			saveOptions();
		});
	});
});
