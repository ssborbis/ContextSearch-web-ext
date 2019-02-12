function getSelectedText(el) {
	
	if (el && typeof el.selectionStart !== 'undefined') {
		let start = el.selectionStart;
		let finish = el.selectionEnd;
		return el.value.substring(start, finish);
	} else
		return window.getSelection().toString();

}

// update searchTerms when selecting text and quickMenuObject.locked = true
document.addEventListener("selectionchange", (ev) => {
	if ( quickMenuObject ) quickMenuObject.lastSelectTime = Date.now();
	
	browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: window.getSelection().toString()});
});

// selectionchange handler for input nodes
for (let el of document.querySelectorAll("input[type='text'], input[type='search'], textarea, [contenteditable='true']")) {
	el.addEventListener('mouseup', (e) => {
		let text = getSelectedText(e.target)
		if (text)
			browser.runtime.sendMessage({action: "updateSearchTerms", searchTerms: text});
	});
}

// Relabel context menu root on mousedown to fire before oncontextmenu
window.addEventListener('mousedown', (e) => {

	if ( e.which !== 3 ) return false;

	let searchTerms = getSelectedText(e.target) || linkOrImage(e.target, e);

	browser.runtime.sendMessage({action: 'updateContextMenu', searchTerms: searchTerms});
});

// https://stackoverflow.com/a/1045012
function offset(elem) {
    if(!elem) elem = this;

    var x = elem.offsetLeft;
    var y = elem.offsetTop;

    while (elem = elem.offsetParent) {
        x += elem.offsetLeft;
        y += elem.offsetTop;
    }

    return { left: x, top: y };
}

function runAtTransitionEnd(el, prop, callback) {
	
	if ( Array.isArray(prop)) {
		var remaining = prop.length;
		prop.forEach( _prop => {
			runAtTransitionEnd(el, _prop, () => {
				if ( --remaining === 0 ) callback();
			});
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
		
	},25);
}

function getLink(el, e) {

	let a = el.closest('a');
	
	if ( !a ) return "";
	
	let method = userOptions.contextMenuSearchLinksAs;
	
	if ( e && e.ctrlKey ) method = method === 'url' ? 'text' : 'url';

	return method === 'url' ? a.href || a.innerText : a.innerText || a.href;
}

function getImage(el, e) {
	
	if ( el.innerText ) return false;
	
	if ( el.tagName === 'IMG' ) return el.src;
	
	let style = window.getComputedStyle(el, false);
	
	let backgroundImage = style.backgroundImage;

	if ( ! /^url\(/.test(backgroundImage) ) return false;

	return backgroundImage.slice(4, -1).replace(/"/g, "")
}

function modifyStyleProperty(el, prop, val, name) {
	let orig = window.getComputedStyle(el, null).getPropertyValue(prop);
	
	el.style.setProperty('--cs-'+name+'-'+prop, el.style.getPropertyValue(prop) || "none");
	el.style.setProperty(prop, val, "important");
}

function offsetElement(el, prop, by, name) {
	
	let val = parseFloat(window.getComputedStyle(el, null).getPropertyValue(prop)) + by + "px";	
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
			( /absolute/.test(styles.getPropertyValue('position')) && el.parentNode === document.body) && el.getBoundingClientRect()[side] < dist 
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
		deadzone: 10,
		movingClass: '',
		dockCallback: function() {},
		undockCallback: function() {},
		windowType: 'docked',
		dockedPosition: 'top',
		lastOffsets: {
			top: 0,
			left: 0,
			right: null,
			bottom: null	
		}
	}
	
	Object.assign(o, options);
	
	// set public functions
	el.dock = dock;
	el.undock = undock;
	
	// init 
	if ( o.windowType === 'docked' ) dock();
	else undock();
	
	// overlay a div to capture mouse events over iframes
	let overDiv = document.createElement('div');
	overDiv.className = "CS_overDiv";
	
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
		
		// undock animation should start in the corners
		
		el.style.top = o.dockedPosition === 'top' ? '0' : null;
		el.style.left = '0';
		el.style.right = null;
		el.style.bottom = o.dockedPosition === 'bottom' ? '0' : null;
	}
	
	function dock() {
		
		if ( el.dataset.windowtype ) { // skip if init position
			el.style.transition = 'none';
				
			o.lastOffsets = getOffsets();
			let pos = getPositions(o.lastOffsets);
			translatePosition(o.dockedPosition, "left");
			
			if ( pos.v === 'bottom' )
				el.style.top = o.lastOffsets.top + "px";
			
			if ( pos.h === 'right' )
				el.style.left = o.lastOffsets.left + "px";
			
			el.style.transition = null;
		}

		setDefaultFloatPosition();

		el.dataset.windowtype = 'docked';
		o.windowType = 'docked';
		o.dockCallback(o);
	}
	
	function undock() {
		el.style.transition = 'none';
		el.dataset.windowtype = 'undocked';
		o.windowType = 'undocked';

		setDefaultFloatPosition();

		let pos = getPositions(o.lastOffsets);
		translatePosition(pos.v, pos.h);
		
		el.style.transition = null;
		
		runAtTransitionEnd(el, [pos.h, pos.v, "width"], () => {
			o.undockCallback(o);
		});
		
		let fixedLastOffsets = {};
		
		Object.keys(o.lastOffsets).forEach( key => {
			fixedLastOffsets[key] = o.lastOffsets[key] / window.devicePixelRatio;
		});

		el.style[pos.h] = fixedLastOffsets[pos.h] + "px";
		el.style[pos.v] = fixedLastOffsets[pos.v]  + "px";
	}
	
	o.handleElement.addEventListener('dblclick', (e) => {

		if ( el.dataset.windowtype === 'docked' ) undock();
		else dock();	
	});

	o.handleElement.addEventListener('mousedown', (e) => {

		el.X = e.clientX;
		el.Y = e.clientY;
		el.moving = false;
		e.preventDefault();
		
		// disable transitions during move
		el.style.transition = "none";

		document.addEventListener('mousemove', moveListener);

		document.addEventListener('mouseup', (_e) => {

			document.removeEventListener('mousemove', moveListener);
			
			if ( !el.moving ) return;
			
			el.classList.remove('CS_moving');
			
			overDiv.parentNode.removeChild(overDiv);
			
			o.lastOffsets = getOffsets();
			let pos = getPositions(o.lastOffsets);
			
			// set docked position based on quadrant
			o.dockedPosition = pos.v;
			
			// translate scale and position to quadrant
			translatePosition(pos.v, pos.h);
			
			// restore transitions
			el.style.transition = null;
			
			o.undockCallback(o);

		}, {once: true});
	});

	function moveListener(e) {
		e.preventDefault();

		if ( !el.moving && Math.abs( el.X - e.clientX ) < o.deadzone && Math.abs( el.Y - e.clientY ) < o.deadzone )	return;
		
		else if ( !el.moving ) {
			document.body.appendChild(overDiv);
			el.moving = true;
			el.classList.add('CS_moving');	

			if ( el.dataset.windowtype === 'docked' ) {
				el.dataset.windowtype = 'undocked';
				o.windowType = 'undocked';
				o.undockCallback(o);
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
		if ( _left + rect.width > window.innerWidth - getScrollBarWidth() ) _left = window.innerWidth - rect.width;

		el.X = e.clientX;

		el.style.top = _top + "px";
		el.style.left = _left + "px";
	}
	
	function getPositions(r) {

		let l_r = ( r.left > r.right ) ? 'right' : 'left';
		let t_b = ( r.top > r.bottom ) ? 'bottom' : 'top';
		
		return {v:t_b, h:l_r};
	}
	
	function getOffsets() {
		
		let r = el.getBoundingClientRect();
		
		return {
			left: r.left * window.devicePixelRatio,
			right: (window.innerWidth - r.right) * window.devicePixelRatio,
			top: r.top * window.devicePixelRatio,
			bottom: (window.innerHeight - r.bottom) * window.devicePixelRatio
		}
	}

}

// apply global user styles for /^[\.|#]CS_/ matches in userStyles
browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	let userOptions = result.userOptions;

	if ( userOptions.userStylesEnabled && userOptions.userStylesGlobal ) {
		
		let styleEl = document.createElement('style');
		
		styleEl.innerText = userOptions.userStylesGlobal;

		document.head.appendChild(styleEl);
	}
});


