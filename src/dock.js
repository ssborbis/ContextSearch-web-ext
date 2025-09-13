function modifyStyleProperty(el, prop, val, name) {

	el.style.setProperty('--cs-'+name+'-'+prop, el.style.getPropertyValue(prop) || "none");
	el.style.setProperty(prop, val, "important");
}

function offsetElement(el, prop, by, name) {
	
	// if ( /left|right/.test(prop) ) 
		// offsetElement(el, "width", -by, name);

	if ( el.style.getPropertyValue('--cs-'+name+'-'+prop) )
		unOffsetElement(el, prop, name);

	let val = el.getBoundingClientRect()[prop] + by + "px";	
	// let val = parseFloat(window.getComputedStyle(el, null).getPropertyValue(prop)) + by + "px";	
	modifyStyleProperty(el, prop, val, name);
}

function unOffsetElement(el, prop, name) {

	let orig = el.style.getPropertyValue('--cs-'+name+'-'+prop);
	
	el.style.setProperty(prop, orig !== 'none' ? orig : null);
	el.style.setProperty('--cs-'+name+'-'+prop, null);
}

function repositionOffscreenElement( element, padding ) {

	padding = padding || { top:0, bottom:0, left:0, right:0 };

	let fixed = window.getComputedStyle( element, null ).getPropertyValue('position') === 'fixed' ? true : false;
	
	let originalTransition = element.style.transition || null;
	// let originalDisplay = element.style.display || null;
	// element.style.transition = 'none';

//	element.style.display = 'none';

	element.style.maxHeight = element.style.maxWidth = 0;

	// move if offscreen
	let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
	let scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;
	
	element.style.maxHeight = element.style.maxWidth = null;
	
	// element.style.display = originalDisplay;

	// element.style.transition = 'all .15s';
	
	let rect = element.getBoundingClientRect();
	
	if ( ! fixed ) {
		
		let maxWidth = Math.min(window.innerWidth, document.body.getBoundingClientRect().right);
		let maxHeight = Math.min(window.innerHeight, document.body.getBoundingClientRect().bottom);
		
		if (rect.y < 0) 
			element.style.top = Math.max(parseFloat(element.style.top) - rect.y, 0) + padding.top + "px";
		
		if (rect.bottom > window.innerHeight) 
			element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight - padding.bottom + "px";
		
		if (rect.x < 0) 
			element.style.left = Math.max(parseFloat(element.style.left) - rect.x, 0) + padding.left + "px";
		
		if (rect.right > maxWidth ) 
			element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - maxWidth) - padding.right + "px";

		return;
	}
	
	if ( rect.bottom > window.innerHeight - scrollbarHeight ) {
		if ( element.style.bottom )
			element.style.bottom = "0";
		else 
			element.style.top = (window.innerHeight - scrollbarHeight - rect.height) + "px";
		
		// console.log('bottom overflow');
	}

	if (rect.top < 0) {
		if ( element.style.bottom ) 
			element.style.bottom = (window.innerHeight - rect.height) + "px";
		else
			element.style.top = "0";
		
		// console.log('top overflow');
	}
	
	if ( rect.right > window.innerWidth - scrollbarWidth ) {
		if ( element.style.right )
			element.style.right = "0";
		else 
			element.style.left = (window.innerWidth - scrollbarWidth - rect.width) + "px";
		
		// console.log('right overflow');
	}
	
	if ( rect.left < 0 ) {
		if ( element.style.right ) 
			element.style.right = (window.innerWidth - rect.width) + "px";
		else
			element.style.left = "0";
		
		// console.log('left overflow');
	}

	runAtTransitionEnd(element, ["top", "bottom", "left", "right"], () => {
		element.style.transition = originalTransition;
	})
	
	// if (rect.y + rect.height > window.innerHeight) 
		// element.style.top = parseFloat(element.style.top) - ((rect.y + rect.height) - window.innerHeight) - scrollbarHeight + "px";
	
	// if (rect.left < 0) 
		// element.style.left = (parseFloat(element.style.left) - rect.x) + "px";
	
	// if (rect.x + rect.width > window.innerWidth) 
		// element.style.left = parseFloat(element.style.left) - ((rect.x + rect.width) - window.innerWidth) - scrollbarWidth + "px";

}

function resetStyleProperty(el, name) {
	
	let props = [];
	
	for (let i=0;i<el.style.length;i++) {
		if ( el.style[i].startsWith('--cs-'+name) ) 	
			props.push(el.style[i]);
	}
	
	props.forEach( prop => {
		let orig_prop = prop.replace('--cs-'+name+'-', "");
		unOffsetElement(el, orig_prop, name);
	});

}

function findFixedElements(side, dist) {

	let els = [];
	
	let step = 10; // check for elements every (n) pixels

	switch ( side ) {
		case "top":
			for ( let i=0;i<document.documentElement.offsetWidth;i+=step ) 
				els = els.concat( document.elementsFromPoint(i,dist) );
			break;
		
		// case "bottom":
			// for ( let i=0;i<document.documentElement.offsetWidth;i+=step ) 
				// els = els.concat( document.elementsFromPoint(i,document.documentElement.offsetHeight - dist) );
			// break;
			
		case "left":
			for ( let i=0;i<document.documentElement.offsetHeight;i+=step ) 
				els = els.concat( document.elementsFromPoint(dist,i) );
			break;
		
		case "right":
			for ( let i=0;i<document.documentElement.offsetHeight;i+=step )
				els = els.concat( document.elementsFromPoint(document.documentElement.offsetWidth - dist, i ));
			break;
	}

	// filter duplicates using Set
	els = [...new Set(els)];

	// filter potentials based on display attribute
	els = els.filter( el => {
		let styles = window.getComputedStyle(el, null);

		return ( /fixed|sticky/.test(styles.getPropertyValue('position')) || 
			( /absolute/.test(styles.getPropertyValue('position')) && el.parentNode === document.body) && 
			document.body.getBoundingClientRect()[side] - el.getBoundingClientRect()[side] < dist 
		);
	});

	// skip child elements
	return els.filter( el => {
		return !els.find( _el => _el === el.parentNode );
	});
	
}

function getScrollBarWidth() {
	return window.innerWidth - (document.documentElement.clientWidth || document.body.clientWidth);
}

function getScrollBarHeight() {
	return window.innerHeight - (document.documentElement.clientHeight || document.body.clientHeight);
}

function makeDockable(el, options) {
	
	let o = {
		handleElement: el,
		deadzone: 4,
		onDock: function() {},
		onUndock: function() {},
		onMoveStart: function() {},
		onMove: function() {},
		onMoveEnd: function() {},
		windowType: 'docked',
		dockedPosition: 'top',
		lastOffsets: {
			top: 0,
			left: 0,
			right: null,
			bottom: null	
		},
		dockedPadding: {},
		id: el.id,
		offsetOnScroll: true,
		overDiv: null,
		zoom: 1
	}
	
	let bodyElement = document.documentElement;
	// let bodyElement = document.body;
	
	Object.assign(o, options);
	
	// set public functions
	el.docking = {
		dock: dock,
		undock: undock,
		init: init,
		offset: doOffset,
		undoOffset: undoOffset,
		translatePosition: translatePosition,
		getPositions: getPositions,
		getOffsets: getOffsets,
		setDefaultFloatPosition: setDefaultFloatPosition,
		options: o,
		moveListener: moveListener,
		moveStart: moveStart,
		moveEnd: moveEnd,
		toggleDock: toggleDock
	}

	// init 
	function init() {
		
		// hide animations on init
		el.style.transition = 'none';
		el.getBoundingClientRect();

		if ( o.windowType === 'docked' ) dock(true);
		else undock(true);
		
		runAtTransitionEnd(el, ["width","height","max-width","max-height","left","right","top","bottom"], () => {
			el.style.transition = null;
			el.getBoundingClientRect();
		});
	}
	
	// overlay a div to capture mouse events over iframes
	o.overDiv = document.createElement('div');
	o.overDiv.className = "CS_overDiv";

	o.overDiv.onclick = moveEnd;

	// watch for element removal and do cleanup
	var observer = new MutationObserver(() => {

		if ( !el || !el.parentNode ) {
			observer.disconnect();
			undoOffset();
			document.removeEventListener('scroll', scrollHandler);
			if ( o.overDiv && o.overDiv.parentNode) 
				o.overDiv.parentNode.removeChild(o.overDiv);

			if ( el.parentDockingListener ) {
				window.removeEventListener('message', el.parentDockingListener);
			}
		}
	});
	
	observer.observe(el.parentNode, {childList: true});
	
	// check for sticky divs and banners that pop up when scrolling	
	let scrollThrottler = null;
	if ( o.offsetOnScroll )
		document.addEventListener('scroll', scrollHandler)
	
	function scrollHandler(e) {
		
		if ( scrollThrottler ) return;
		
		scrollThrottler = setTimeout(() => {

			if ( el.dataset.windowtype === 'docked' ) {
			//	undoOffset(true);
				doOffset(true);
			}

			scrollThrottler = null;
			
		}, 500);
	}		
	
	function doOffset(notBody) {

		runAtTransitionEnd(el, ["width","height","max-width","max-height"], () => {
			
			let rect = el.getBoundingClientRect();

			let dist = rect[ /top|bottom/.test(o.dockedPosition) ? "height" : "width"];

			if ( !notBody )
				offsetElement(bodyElement, 'padding-' + o.dockedPosition, dist, el.id);			
			
			findFixedElements(o.dockedPosition, dist - 1 ).filter( _el => _el !== el ).forEach( _el => {
				
				let _rect = _el.getBoundingClientRect();
				
				let dist_rect = {
					left: Math.abs(rect.left - _rect.left),
					right: Math.abs(rect.right - _rect.right),
					top: Math.abs(rect.top - _rect.top),
					bottom: Math.abs(rect.bottom - _rect.bottom)
				}
				
				// console.log(rect);
				// console.log(dist_rect);
				
				//let shiftBy = dist - dist_rect[o.dockedPosition];
				let shiftBy = dist;
				offsetElement(_el, o.dockedPosition, shiftBy, el.id);
				
				// console.log("element to hide is offset by " + dist_rect[o.dockedPosition]);
				// console.log("dock is " + dist);
				// console.log("shift by " + shiftBy);
				
				 // offsetElement(_el, o.dockedPosition, dist, el.id);
			
				// rect.right = bodyElement.offsetWidth - rect.right;
				// rect.bottom = bodyElement.offsetHeight - rect.bottom;
				
				// console.log(rect);
				
				
			});
		});

	}
	
	function undoOffset(notBody) {

		document.querySelectorAll('[style*="--cs-' + o.id + '"]').forEach( _el => {
			
			if ( _el === bodyElement && notBody ) return;
			
			resetStyleProperty(_el, o.id);
		});
	}
	
	// set scaled window position by transformOrigin
	function translatePosition(v, h) {

		let r = el.getBoundingClientRect();

		el.style.top = null;
		el.style.left = null;
		el.style.right = null;
		el.style.bottom = null;
		
		el.style.transformOrigin = v + " " + h;

		el.style[v] = ((v === 'bottom') ? window.innerHeight - r[v] - getScrollBarHeight() : r[v]) + "px";
		el.style[h] = ((h === 'right') ? window.innerWidth - r[h] - getScrollBarWidth() : r[h]) + "px";

		// reflow
		el.getBoundingClientRect();
	}
	
	function setDefaultFloatPosition() {
		
		let pos = getPositions(o.lastOffsets);

		// undock animation should start in the corners		
		el.style.top = o.dockedPosition !== 'bottom' ? '0' : null;
		el.style.left = o.dockedPosition !== 'right' ? '0' : null; // set absolute left for top, bottom, left
		el.style.right = o.dockedPosition === 'right' ? '0' : null;
		el.style.bottom = o.dockedPosition === 'bottom' ? '0' : null;
	}
	
	function dock(init) {
		
		let pos = getPositions(o.lastOffsets);
		
		if ( el.dataset.windowtype ) { // skip if init position
			el.style.transition = 'none';
				
		//	o.lastOffsets = getOffsets();
			
			translatePosition(o.dockedPosition === 'bottom' ? 'bottom' : 'top', o.dockedPosition === 'right' ? 'right' : 'left');
			
			if ( pos.v === 'bottom' )
				el.style.top = o.lastOffsets.top + "px";
			
			if ( pos.h === 'right' )
				el.style.left = o.lastOffsets.left + "px";
			
			el.style.transition = null;
		}

		setDefaultFloatPosition();

		el.dataset.windowtype = o.windowType = 'docked';
		
		doOffset();

		runAtTransitionEnd(el, [pos.h, pos.v, "width", "height", "max-width","max-height"], () => {
			o.init = init;
			o.onDock(o);
			o.init = false
		});
		// o.onDock(o);
	}
	
	function undock(init) {

		let origTransition = el.style.transition || null;
		
		el.style.transition = 'none';
		
		if ( o.windowType === 'docked' ) setDefaultFloatPosition();
		
		el.dataset.windowtype = 'undocked';
		o.windowType = 'undocked';

		let pos = getPositions(o.lastOffsets);
		translatePosition(pos.v, pos.h);

		el.style.transition = origTransition;

		runAtTransitionEnd(el, [pos.h, pos.v, "width", "height", "max-width","max-height"], () => {
			o.init = init;
			o.onUndock(o);
			o.init = false;
		});
		
		let fixedLastOffsets = {};
		
		Object.keys(o.lastOffsets).forEach( key => {
			fixedLastOffsets[key] = o.lastOffsets[key] / window.devicePixelRatio;
		});

		el.style[pos.h] = fixedLastOffsets[pos.h] + "px";
		el.style[pos.v] = fixedLastOffsets[pos.v]  + "px";

		undoOffset();
	}
	
	function toggleDock() {
		if ( o.windowType === "docked" ) undock();	
		else if ( o.windowType === "undocked" ) dock();
	}
	
	if ( o.handleElement) {
		o.handleElement.addEventListener('dblclick', e => {
			if ( el.dataset.windowtype === 'docked' ) undock();
			else dock();	
		});
	}
	
	// timer for better mousemove handling
	let mouseDownStart = null;
	
	async function moveStart(e) {

		// only iframes need zoom adjustment. Why?
	//	if ( el.tagName === "IFRAME")
	//		await sendMessage({action: "getZoom"}).then(z => o.zoom = z);

		mouseDownStart = Date.now();

		el.X = e.x;
		el.Y = e.y;
		el.moving = false;
		
		if ( el.tagName !== "IFRAME" ) {
			e.preventDefault();

			document.addEventListener('mousemove', moveListener);
			document.addEventListener('mouseup', moveEnd, {once: true});
		}

		o.onMoveStart(o);
	}
	
	function moveEnd(e) {

		document.removeEventListener('mousemove', moveListener);
			
		if ( !el.moving ) return;
		
		el.classList.remove('CS_moving');
		
		if ( o.overDiv && o.overDiv.parentNode ) o.overDiv.parentNode.removeChild(o.overDiv);
		
		o.lastOffsets = getOffsets();
		let pos = getPositions(o.lastOffsets);
		
		// set docked position based on quadrant
		o.dockedPosition = /top|bottom/.test(o.dockedPosition) ? pos.v : pos.h;
		
		// translate scale and position to quadrant
		translatePosition(pos.v, pos.h);
		
		// restore transitions
		el.style.transition = null;
		
		o.onUndock(o);
		o.onMoveEnd(o);
	}

	if ( o.handleElement && o.handleElement.tagName !== "IFRAME" ) {
		o.handleElement.addEventListener('mousedown', moveStart);
	}

	function moveListener(e) {

		if ( e.preventDefault )	e.preventDefault();

		if ( !el.moving && 
			(
				( Math.abs( el.X - e.x ) < o.deadzone || Math.abs( el.Y - e.y ) < o.deadzone ) 
				&& Date.now() - mouseDownStart < 100
			))	
			return;
		
		else if ( !el.moving ) {
			
			// disable transitions during move
			el.style.transition = "none";
			
			getShadowRoot().appendChild(o.overDiv);
			el.moving = true;
			el.classList.add('CS_moving');	

			if ( el.dataset.windowtype === 'docked' ) {
				el.dataset.windowtype = o.windowType = 'undocked';
				undoOffset();
				o.onUndock(o);
			}
			
			translatePosition("top", "left");
		}
		
		let rect = el.getBoundingClientRect();

		let _top = el.offsetTop - ( el.Y - e.y ) ;// o.zoom * 1.62;
		if ( _top < 0 ) _top = 0;
		if ( _top + rect.height > window.innerHeight - getScrollBarHeight() ) _top = window.innerHeight - rect.height;

		let _left = el.offsetLeft - ( el.X - e.x ) ;// o.zoom* 1.62;
		if ( _left < 0 ) _left = 0;
		if ( _left + rect.width > window.innerWidth - getScrollBarWidth() ) _left = window.innerWidth - rect.width - getScrollBarWidth();

		el.style.top = _top + "px";
		el.style.left = _left + "px";

		el.X = e.x;
		el.Y = e.y;

		o.onMove(o);
	}
	
	function getPositions(r) {
		
		r = r || el.getBoundingClientRect();

		let l_r = ( r.left > r.right ) ? 'right' : 'left';
		let t_b = ( r.top > r.bottom ) ? 'bottom' : 'top';
		
		return {v:t_b, h:l_r};
	}
	
	function getOffsets() {
		
		let r = el.getBoundingClientRect();
		
		return {
			left: r.left * window.devicePixelRatio,
			right: (window.innerWidth - r.right - getScrollBarWidth()) * window.devicePixelRatio,
			top: r.top * window.devicePixelRatio,
			bottom: (window.innerHeight - r.bottom - getScrollBarHeight()) * window.devicePixelRatio
		}
	}
}

function addChildDockingListeners(handle, target_id, ignoreSelector) {

	let deadzone = 12;
	let moving = false;

	ignoreSelector = ignoreSelector || null;

	ignoreTarget = e => {
		let elsToIgnore = [...document.querySelectorAll(ignoreSelector)];

		if ( elsToIgnore.includes(e.target) ) return true;
		else return false
	}

	handle.addEventListener('mousedown', e => {	

		delete handle.lastMouseDownCoords;

		if ( ignoreTarget(e) ) return false;

	//	if ( window.tilesDraggable ) return false;

		handle.lastMouseDownCoords = {x: e.screenX, y:e.screenY}
	});

	window.addEventListener('mouseup', e => {
		if ( e.which !== 1 ) return;

		if ( !moving ) return;

		moving = false;
		
		document.body.classList.remove("noMouse");

		delete handle.lastMouseDownCoords;
		
		window.parent.postMessage({action: "handle_dragend", target: target_id, e: {x: e.screenX, y: e.screenY}}, "*");
	});

	window.addEventListener('mousemove', e => {
		if ( e.buttons !== 1 ) return;

		if ( !handle.lastMouseDownCoords ) return;

		if ( Math.abs(e.screenX - handle.lastMouseDownCoords.x) < deadzone && Math.abs(e.screenY - handle.lastMouseDownCoords.y) < deadzone ) return;

		if ( !moving ) {
			document.body.classList.add("noMouse");
			moving = true;
			window.parent.postMessage({action: "handle_dragstart", target: target_id, e: {x: e.screenX, y: e.screenY}}, "*");
			return;
		}

		window.parent.postMessage({action: "handle_dragmove", target: target_id, e: {x: e.screenX, y: e.screenY}}, "*");
	});

	handle.addEventListener('dblclick', e => {
		if ( e.which !== 1 ) return;

		if ( ignoreTarget(e) ) return false;

		window.parent.postMessage({action: "handle_dock", target: target_id, e: {x: e.screenX, y: e.screenY}}, "*");
	});

	document.addEventListener('wheel', e => {
		if ( e.ctrlKey) {
			e.preventDefault();
			window.parent.postMessage({action: "zoomFrame", target: target_id || null, delta: e.deltaY * -0.0025}, "*");
		}
	}, { passive: false });
}

function addParentDockingListeners(id, target_id) {

	parentDockingListener = e => {

		if ( e.data.target !== target_id) return;

		let el = getShadowRoot().getElementById(id);

		if ( !el ) return;
		
		let x = e.data.e?.x || 0;
		let y = e.data.e?.y || 0;

		switch ( e.data.action ) {
			case "handle_dragstart":
				el.docking.moveStart({x:x, y:y});
				break;
			
			case "handle_dragend":
				el.docking.moveEnd({x:x, y:y});
				break;
			
			case "handle_dragmove":
				el.docking.moveListener({x:x, y:y});
				break;
				
			case "handle_dock":
				el.docking.toggleDock();
				break;

			case "zoomFrame":
				let scale = parseFloat(el.style.getPropertyValue('--cs-custom-scale'));
				scale+=e.data.delta

				if ( scale < .25 || scale > 5 ) break;
				el.style.setProperty('--cs-custom-scale', scale);

				// set the correct zoom property
				if ( id === "CS_sbIframe" )
					userOptions.sideBar.scale = scale;
				else if ( id === "CS_quickMenuIframe")
					userOptions.quickMenuScale = scale;
				else if ( id === "CS_findBarIframe")
					userOptions.highLight.findBar.scale = scale;

				sendMessage({action: "saveUserOptions", userOptions: userOptions, source: "dock zoomFrame"});
				break;
		}
	}

	// docking event listeners for iframe
	window.addEventListener('message', parentDockingListener);

	let el = getShadowRoot().getElementById(id);
	if ( el ) el.parentDockingListener = parentDockingListener;
}
