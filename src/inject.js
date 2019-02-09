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

// apply global user styles for /^[\.|#]CS_/ matches in userStyles
browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	let userOptions = result.userOptions;

	if ( userOptions.userStylesEnabled && userOptions.userStylesGlobal ) {
		
		let styleEl = document.createElement('style');
		
		styleEl.innerText = userOptions.userStylesGlobal;

		document.head.appendChild(styleEl);
	}
});


