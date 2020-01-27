function runAtTransitionEnd(el, prop, callback, ms) {
	
	ms = ms || 25;

	if ( Array.isArray(prop)) {
		var remaining = prop.length;
		prop.forEach( _prop => {
			runAtTransitionEnd(el, _prop, () => {
				if ( --remaining === 0 ) callback();
			}, ms);
		});
		return;
	}

	let oldProp = null;
	let checkPropInterval = setInterval(() => {
		let newProp = window.getComputedStyle(el).getPropertyValue(prop);
		if ( newProp !== oldProp ) {
			oldProp = newProp;
			return;
		}

		clearInterval(checkPropInterval);
		callback();
		
	}, ms);
}

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
	let set = new Set(els);
	els = Array.from(set);

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
	return window.innerWidth - document.documentElement.clientWidth;
}

function getScrollBarHeight() {
	return window.innerHeight - document.documentElement.clientHeight;
}

function makeDockable(el, options) {
	
	let o = {
		handleElement: el,
		deadzone: 4,
		onDock: function() {},
		onUndock: function() {},
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
		offsetOnScroll: true
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

		if ( o.windowType === 'docked' ) dock();
		else undock();
		
		runAtTransitionEnd(el, ["width","height","max-width","max-height","left","right","top","bottom"], () => {
			el.style.transition = null;
			el.getBoundingClientRect();
		});		
	}
	
	// overlay a div to capture mouse events over iframes
	let overDiv = document.createElement('div');
	overDiv.className = "CS_overDiv";

	// watch for element removal and do cleanup
	var observer = new MutationObserver(() => {

		if ( !el || !el.parentNode ) {
			observer.disconnect();
			undoOffset();
			document.removeEventListener('scroll', scrollHandler);
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
	
	function dock() {
		
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
			o.onDock(o);
		});
		// o.onDock(o);
	}
	
	function undock() {

		let origTransition = el.style.transition || null;
		
		el.style.transition = 'none';
		
		if ( o.windowType === 'docked' ) setDefaultFloatPosition();
		
		el.dataset.windowtype = 'undocked';
		o.windowType = 'undocked';

		let pos = getPositions(o.lastOffsets);
		translatePosition(pos.v, pos.h);

		el.style.transition = origTransition;

		runAtTransitionEnd(el, [pos.h, pos.v, "width", "height", "max-width","max-height"], () => {
			o.onUndock(o);
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
	
	function moveStart(e) {

		mouseDownStart = Date.now();

		el.X = e.clientX;
		el.Y = e.clientY;
		el.moving = false;
		
		if ( el.tagName !== "IFRAME" ) {
			e.preventDefault();

			document.addEventListener('mousemove', moveListener);
			document.addEventListener('mouseup', moveEnd, {once: true});
		}
	}
	
	function moveEnd(e) {
		document.removeEventListener('mousemove', moveListener);
			
		if ( !el.moving ) return;
		
		el.classList.remove('CS_moving');
		
		overDiv.parentNode.removeChild(overDiv);
		
		o.lastOffsets = getOffsets();
		let pos = getPositions(o.lastOffsets);
		
		// set docked position based on quadrant
		o.dockedPosition = /top|bottom/.test(o.dockedPosition) ? pos.v : pos.h;
		
		// translate scale and position to quadrant
		translatePosition(pos.v, pos.h);
		
		// restore transitions
		el.style.transition = null;
		
		o.onUndock(o);
	}

	if ( o.handleElement && o.handleElement.tagName !== "IFRAME" ) {
		o.handleElement.addEventListener('mousedown', moveStart);
	}

	function moveListener(e) {

		if ( e.preventDefault )	e.preventDefault();

		if ( !el.moving && 
			(
				( Math.abs( el.X - e.clientX ) < o.deadzone || Math.abs( el.Y - e.clientY ) < o.deadzone ) 
				&& Date.now() - mouseDownStart < 100
			))	
			return;
		
		else if ( !el.moving ) {
			
			// disable transitions during move
			el.style.transition = "none";
			
			document.body.appendChild(overDiv);
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

		let _top = el.offsetTop - ( el.Y - e.clientY );
		if ( _top < 0 ) _top = 0;
		if ( _top + rect.height > window.innerHeight - getScrollBarHeight() ) _top = window.innerHeight - rect.height;

		el.Y = e.clientY;
		
		let _left = el.offsetLeft - ( el.X - e.clientX );
		if ( _left < 0 ) _left = 0;
		if ( _left + rect.width > window.innerWidth - getScrollBarWidth() ) _left = window.innerWidth - rect.width - getScrollBarWidth();

		el.X = e.clientX;

		el.style.top = _top + "px";
		el.style.left = _left + "px";
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