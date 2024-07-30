function ResizeWidget(el, options) {
	
	let o = {
		tileSize: {},
		deadzone: 10,
		onDragStart: function() {},
		onDrag: function() {},
		onDrop: function() {},
		columns: 0,
		rows: 0,
		isResizing: false,
		allowHorizontal: true,
		allowVertical: true,
		minRows: 1,
		minCols: 1,
		maxCols: 100,
		maxRows: 100,
		dx:0,
		dy:0
	}
	
	o = Object.assign(o, options);

	let resizeWidget = el.resizeWidget;

	// overlay a div to capture mouse events over els
	let overDiv = document.createElement('div');
	overDiv.className = "CS_overDiv";
	overDiv.style = "cursor:nwse-resize";
	
	// build resize widget once per quick menu open
	if ( !resizeWidget ) {
		
		let startCoords, endCoords, endSize;
		
		resizeWidget = document.createElement('div');
		resizeWidget.className = 'CS_resizeWidget';
		resizeWidget.title = i18n('resize');

		getShadowRoot().appendChild(resizeWidget);

		resizeWidget.options = o;
		resizeWidget.setPosition = positionResizeWidget;
		el.resizeWidget = resizeWidget;

		resizeWidget.addEventListener('mousedown', function elementResize(e) {
			
			o.isResizing = true;

			let startSize = {columns: o.columns, rows: o.rows};
			
			document.body.appendChild(overDiv);

			el.style.transition = 'none';
			el.style.borderWidth = '2px';
			el.style.borderStyle = 'dashed';
			
			resizeWidget.style.transition = 'none';

			// lower the quick menu in case zIndex = MAX
			el.style.zIndex = window.getComputedStyle(el).zIndex - 1;

			// match grid to tile size after scaling
			let stepX = el.getBoundingClientRect().width / el.offsetWidth * o.tileSize.width;
			let stepY = el.getBoundingClientRect().height / el.offsetHeight * o.tileSize.height;

			// initialize the coords with some offset for a deadzone
			startCoords = {x: e.clientX, y: e.clientY};

			document.addEventListener('mousemove', elementDrag);
			
			document.addEventListener('click', function captureClick(_e) {
				_e.stopPropagation();	
			}, {capture: true, once: true});

			// track mod size to ignore repeat drag events
			let mostRecentModSize = {columns:0,rows:0};
			
			o.onDragStart(o);
			
			function elementDrag(_e) {

				endCoords = {x: _e.clientX, y: _e.clientY};

				let colsMod = Math.floor (( endCoords.x - startCoords.x ) / stepX);
				let rowsMod = Math.floor (( endCoords.y - startCoords.y ) / stepY);
				
				// size less than 1 do nothing
			//	if ( startSize.columns + colsMod <= 0 || startSize.rows + rowsMod <= 0 ) return;

				// ignore repeat drag events
			//	if ( mostRecentModSize.columns === colsMod && mostRecentModSize.rows === rowsMod )
				//	return;

				o.columns = startSize.columns + colsMod;
				o.rows = startSize.rows + rowsMod;

				// add code to skip when !allowHorizontal and only rows change
				o.onDrag({
					columns: o.columns,
					rows: o.rows,
					columnsOffset: colsMod,
					rowsOffset: rowsMod,
					xOffset: endCoords.x - startCoords.x,
					yOffset: endCoords.y - startCoords.y,
					endCoords: endCoords					
				});
				
				mostRecentModSize = {columns: colsMod, rows: rowsMod};
			}

			document.addEventListener('mouseup', _e => {

				_e.preventDefault();
				_e.stopPropagation();
				_e.stopImmediatePropagation();

				// clear overlay
				overDiv.parentNode.removeChild(overDiv);
				
				// clear resize styling
				el.style.transition = null;
				el.style.borderWidth = null;
				el.style.borderStyle = null;
				el.style.zIndex = null;
				
				resizeWidget.style.transition = null;

				if ( o.columns < 1 ) {
					o.columns = Math.floor(el.getBoundingClientRect() * window.devicePixelRatio / o.tileSize.width);
				}
				
				o.onDrop(o);
				
				document.removeEventListener('mousemove', elementDrag);
				
				o.isResizing = false;
			}, {once: true});
			
		});
	}
	
	// queue reposition for transitions
	el.addEventListener('transitionend', positionResizeWidget);
	
	// reposition on custom page zoom event
	document.addEventListener('zoom', positionResizeWidget);
	
	// set animation state
	if ( !userOptions.enableAnimations ) resizeWidget.style.setProperty('--user-transition', 'none');

	/* dnd resize end */	
	positionResizeWidget();

	function positionResizeWidget() {
		
		resizeWidget.style.top = null;
		resizeWidget.style.left = null;
		resizeWidget.style.right = null;
		resizeWidget.style.bottom = null;

		let w_rect = resizeWidget.getBoundingClientRect();
		let rect = el.getBoundingClientRect();

		resizeWidget.style.transformOrigin = el.style.transformOrigin || "top left";
		resizeWidget.style.transform = window.getComputedStyle(el, null).getPropertyValue('transform');
		
		let offset = 8 / window.devicePixelRatio;

		if ( el.style.left ) 
			resizeWidget.style.left = parseFloat(el.style.left) + rect.width - w_rect.width + offset + "px";
		if ( el.style.right )
			resizeWidget.style.right = parseFloat(el.style.right) - offset + "px";
		if ( el.style.top )
			resizeWidget.style.top = parseFloat(el.style.top) + rect.height - w_rect.height + offset + "px";
		if ( el.style.bottom )
			resizeWidget.style.bottom = parseFloat(el.style.bottom) - offset + "px";
	}
	
	return resizeWidget;
}