var userOptions = {};

var markOptions = null;

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	userOptions = result.userOptions;

	// open findbar on pageload if set
	if ( window == top && userOptions.highLight.findBar.startOpen ) {

		markOptions = {
			accuracy: userOptions.highLight.markOptions.accuracy,
			caseSensitive: userOptions.highLight.markOptions.caseSensitive,
			ignorePunctuation: userOptions.highLight.markOptions.ignorePunctuation,
			separateWordSearch: userOptions.highLight.markOptions.separateWordSearch
		};

		updateFindBar(markOptions);
	}
});

function addStyling() {
	// append marking styles
	let styleEl = document.createElement('style');
	styleEl.id = 'CS_highlight_style';
	document.head.appendChild(styleEl);
	
	if ( userOptions.highLight.highlightStyle === 'background' ) {
	
		styleEl.innerText = `
			:root {
				--cs-mark-active-background: ${userOptions.highLight.activeStyle.background};
				--cs-mark-active-color: ${userOptions.highLight.activeStyle.color};
			}
			.CS_mark[data-style="0"], #CS_highLightNavBar > DIV[data-style="0"] { 
				background:${userOptions.highLight.styles[0].background};
				color:${userOptions.highLight.styles[0].color};
			}	
			.CS_mark[data-style="1"], #CS_highLightNavBar > DIV[data-style="1"] {
				background:${userOptions.highLight.styles[1].background};
				color:${userOptions.highLight.styles[1].color};
			}
			.CS_mark[data-style="2"], #CS_highLightNavBar > DIV[data-style="2"] {
				background:${userOptions.highLight.styles[2].background};
				color:${userOptions.highLight.styles[2].color};
			}
			.CS_mark[data-style="3"], #CS_highLightNavBar > DIV[data-style="3"] {
				background:${userOptions.highLight.styles[3].background};
				color:${userOptions.highLight.styles[3].color};
			}
			.CS_mark.CS_mark_selected, .CS_mark_selected {
				background: ${userOptions.highLight.activeStyle.background};
				color: ${userOptions.highLight.activeStyle.color};
			}
			`;
	} else if ( userOptions.highLight.highlightStyle === 'underline' ) {
		
		styleEl.innerText = `
		:root {
			--cs-mark-active-background: ${userOptions.highLight.activeStyle.background};
			--cs-mark-active-color: ${userOptions.highLight.activeStyle.color};
		}
		.CS_mark[data-style="0"], #CS_highLightNavBar > DIV[data-style="0"] { 
			border-bottom: .2em solid ${userOptions.highLight.styles[0].background};
			color:inherit;
		}	
		.CS_mark[data-style="1"], #CS_highLightNavBar > DIV[data-style="1"] {
			border-bottom: .2em solid ${userOptions.highLight.styles[1].background};
			color:inherit;
		}
		.CS_mark[data-style="2"], #CS_highLightNavBar > DIV[data-style="2"] {
			border-bottom: .2em solid ${userOptions.highLight.styles[2].background};
			color:inherit;
		}
		.CS_mark[data-style="3"], #CS_highLightNavBar > DIV[data-style="3"] {
			border-bottom: .2em solid ${userOptions.highLight.styles[3].background};
			color:inherit;
		}
		.CS_mark.CS_mark_selected, .CS_mark_selected {
			border-bottom: .2em solid ${userOptions.highLight.activeStyle.background};
			color:inherit;
		}
		`;
	}
}

function removeStyling() {
	let styleEl = document.getElementById('CS_highlight_style');
	
	if ( styleEl ) styleEl.parentNode.removeChild(styleEl);
}

// ESC to clear markers and navbar
document.addEventListener('keydown', (e) => {
	if ( e.which === 27 ) {
		browser.runtime.sendMessage({action: "unmark"}).then( () => {
			browser.runtime.sendMessage({action: "closeFindBar"});
		});
	}
});

// listen for findbar hotkey
window.addEventListener('keydown', (e) => {
	
	if (
		!userOptions.highLight.findBar.hotKey.length
		|| e.repeat
		|| !userOptions.highLight.findBar.hotKey.includes(e.keyCode)
	) return;

	for (let i in userOptions.highLight.findBar.hotKey) {
		let key = userOptions.highLight.findBar.hotKey[i];
		if (key === 16 && !e.shiftKey) return;
		if (key === 17 && !e.ctrlKey) return;
		if (key === 18 && !e.altKey) return;
		if (![16,17,18,e.keyCode].includes(key)) return;
	}

	e.preventDefault();

	let searchTerms = getSelectedText(e.target);
	
	if ( getFindBar() && !searchTerms ) {
		browser.runtime.sendMessage({action: "closeFindBar"});
		return;
	}
		
	window.getSelection().removeAllRanges();
	
	if ( !searchTerms ) 
		searchTerms = window.findBarLastSearchTerms || "";

	// search for selected terms
	browser.runtime.sendMessage(Object.assign({
		action: "mark",
		searchTerms: searchTerms, 
		findBarSearch:true,	
	}, !markOptions ? {
			accuracy: "partially",
			caseSensitive: false,
			ignorePunctuation: true,
			separateWordSearch: false
		} : markOptions
	));

	
	
});

// init marker.js object
var CS_MARK_instance = null;

var getFindBar = () => {return document.getElementById('CS_findBarIframe');}
var getNavBar = () => {return document.getElementById('CS_highLightNavBar');}

// listen for execute_script call from background
document.addEventListener('CS_mark', (e) => {

	CS_MARK_instance = new Mark(document.body);
	
	// Chrome markings happened before loading userOptions
	let optionsCheck = setInterval( () => {
		if ( userOptions === {} ) return;
		
		clearInterval(optionsCheck);
		
		CS_MARK_instance = CS_MARK_instance || new Mark(document.body);
		CS_MARK_instance.unmark();
		
		let searchTerms = e.detail.trim();

		mark(Object.assign({
			searchTerms:searchTerms
		}, !markOptions ? {
			accuracy: userOptions.highLight.markOptions.accuracy,
			caseSensitive: userOptions.highLight.markOptions.caseSensitive,
			ignorePunctuation: userOptions.highLight.markOptions.ignorePunctuation,
			separateWordSearch: userOptions.highLight.markOptions.separateWordSearch
			} : markOptions
		));
	
	}, 100);
	
});

function unmark() {
	
	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);
	CS_MARK_instance.unmark();
	
	closeNavBar();
	removeStyling();
	
	browser.runtime.sendMessage({action: "removeTabHighlighting"});
}

function closeNavBar() {
	let nav = getNavBar();	
	if ( nav ) nav.parentNode.removeChild(nav);
}

function buildSearchWords(searchTerms) {
	
	// get quoted strings as single search term
	let phrases = searchTerms.match(/".*?"/g) || [];
	phrases.forEach( (phrase, i) => {
		searchTerms = searchTerms.replace(phrase, "");
		phrases[i] = phrase.replace(/^"(.*)"$/g, "$1");
	});

	let words = searchTerms.split(/\s+/);
	
	// build phrases from word combos
	let words2 = [];
	for ( let i=words.length;i>1;i--) {
		words2.push(words.slice(0,i).join(" ").trim());
	}

	// build final array and filter empty
	words = words.concat(words2).concat(phrases).filter( a => a.length );

	// sort largest to smallest to avoid small matches breaking larger matches
	words.sort( (a, b) => {return ( a.length > b.length ) ? -1 : 1} );
	
//	console.log(words);
	
	return words;
}

function mark(options) {
	
	addStyling();

	searchTerms = options.searchTerms.trim();
	
	window.findBarLastSearchTerms = searchTerms;

	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);

	let words = options.separateWordSearch === false ? [searchTerms] : buildSearchWords(searchTerms);
	
	let _markOptions = {
		accuracy: options.accuracy,
		ignorePunctuation: options.ignorePunctuation ? ":;.,-–—‒_(){}[]!'\"+=".split("") : [],
		caseSensitive: options.caseSensitive,
		findBarSearch: options.findBarSearch
	}

	words.forEach( (word, i) => {

		CS_MARK_instance.mark(word, Object.assign({
			className:"CS_mark",
			acrossElements: false,
			separateWordSearch: false,

			each: (el) => {
				
				// add class to hidden makers for removal later
				if ( el.getBoundingClientRect().height === 0 || window.getComputedStyle(el, null).display === "none" )
					el.classList.add('CS_unmark');
				
				// add class to hits contained in other hits for removal later
				if ( el.parentNode.classList.contains('CS_mark') )
					el.classList.add('CS_unmark');	
				
				el.dataset.flashstyle = userOptions.highLight.highlightStyle;
			},
			
			done: () => {

				// only perform when done with all words
				if ( i !== words.length - 1 ) return;

				// remove marker queued for unmarking
				CS_MARK_instance.unmark({className: 'CS_unmark'});
				
				// get hit index in words array for styling
				document.querySelectorAll(".CS_mark").forEach( el => {
					let index = words.findIndex( word => {
						return word.toLowerCase() === el.textContent.toLowerCase();
					});
					
					// if ( index !== -1 ) 
					el.dataset.style = index > 3 ? index % 4 : index;	
				});

				done();
			}
		}, _markOptions));
	});
	
	if ( words.length === 0 ) 
		done();
	
	function done() {
		browser.runtime.sendMessage(Object.assign({
			action: "markDone", 
			searchTerms:searchTerms, 
			words: words, 
			separateWordSearch: options.separateWordSearch
		}, _markOptions));
	}
}
function openNavBar() {

	let hls = getMarks();

	if ( ! hls.length ) return;
	
	if ( getNavBar() ) closeNavBar();

	let div = document.createElement('div');
	div.id = 'CS_highLightNavBar';
	
	div.style.transform = 'scaleX(' + 1/window.devicePixelRatio + ')';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/crossmark.svg');
	img.style.transform = 'scaleY(' + 1/window.devicePixelRatio + ')';
	
	img.addEventListener('mousedown', (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	})
	img.addEventListener('mouseup', (e) => {	
		CS_MARK_instance.unmark();
		div.parentNode.removeChild(div);
	});
	
	div.appendChild(img);
	
	let ratio = document.documentElement.clientHeight / Math.max(document.documentElement.offsetHeight, document.body.offsetHeight);
	
	function navScrollToHandler(e) {
		document.documentElement.scrollTop = e.clientY / ratio - .5 * document.documentElement.clientHeight;
	}
	
	div.onclick = navScrollToHandler;
	
	div.addEventListener('mousedown', (e) => {
		
		e.preventDefault();
		
		function mouseMoveHandler(_e) {
			_e.preventDefault();
			navScrollToHandler(_e);
		}
		
		document.addEventListener('mousemove', mouseMoveHandler);
		
		document.addEventListener('mouseup', () => {
			document.removeEventListener('mousemove', mouseMoveHandler);
		}, {once:true});
	});
	
	// keep track of markers with the same top offset
	let layers = 0;

	hls.forEach( (hl, index) => {

		let marker = document.createElement('div');
		marker.className = 'marker';

		marker.style.top = offset(hl).top * ratio / document.documentElement.clientHeight * 100 + "vh";
		marker.style.height = '.5vh';//rect.height * ratio / document.documentElement.clientHeight * 100 + "vh";
		
		if ( hl.ownerDocument != document ) {
			let iframe = Array.from(document.querySelectorAll('iframe')).find( iframe => iframe.contentDocument == hl.ownerDocument );

			marker.style.top = offset(iframe).top * ratio / document.documentElement.clientHeight * 100 + "vh";
		}

		marker.dataset.style = hl.dataset.style || 0;
		
		marker.onclick = function(e) {
			
			e.stopImmediatePropagation();

			let _top = parseFloat(marker.style.top) / ratio;
			navScrollToHandler(e);

			jumpTo(index);
		}
		
		div.appendChild(marker);
		
		// if stacking elements, offset margins
		if ( marker.previousSibling && marker.previousSibling.style.top === marker.style.top )
			marker.style.marginTop = ++layers * 4 + 'px';
		else
			layers = 0;
		
		marker.style.background = userOptions.highLight.styles[parseInt(marker.dataset.style) || 0].background;
		marker.style.border = 'none';
		
	});
	
	document.body.appendChild(div);

}

function openFindBar() {
	
	return new Promise( (resolve, reject) => {

		let fb = getFindBar();

		if ( fb ) {
			setTimeout( () => {
				resolve(fb);
			}, 100);
			
			fb.style.opacity = null;
			fb.style.maxHeight = null;
			return;
		}
		
		fb = document.createElement('iframe');
		fb.id = 'CS_findBarIframe';
		fb.style.transformOrigin = userOptions.highLight.findBar.position + " left";
		//fb.style.transform = 'scale(' + 1 / window.devicePixelRatio + ')';
		
		fb.style.setProperty('transform', 'scale(' + 1 / window.devicePixelRatio + ')', "important");
	//	fb.style.width = '800px';
		fb.style.width = 100 * window.devicePixelRatio + "%";
		fb.style.opacity = 0;
		fb.style.maxHeight = '0px';
		if ( !userOptions.enableAnimations ) fb.style.setProperty('--user-transition', 'none');
		
		fb.style[userOptions.highLight.findBar.position] = '0';

		document.body.appendChild(fb);
		
		fb.onload = function() {
			fb.focus();
			fb.style.opacity = null;
			fb.style.maxHeight = null;
			resolve(fb);
		}

		fb.src = browser.runtime.getURL("/findbar.html");
		
		if ( userOptions.highLight.findBar.position === 'top' ) {
		
			document.documentElement.style.paddingTop = 36 * 1 / window.devicePixelRatio + "px";

			let els1 = findFixedMethodOne();
			let els2 = findFixedMethodTwo();
			
			let set = new Set([...els1, ...els2]);
			
			let els = Array.from(set);

			hideFixed(els);
		}

	});
}

function hideFixed(els) {
	els.forEach( el => {
		el.style.setProperty('--CS-original-top', el.style.top || 0);
		el.style.setProperty('top', (parseFloat(el.style.top) || 0 ) + 36 * 1 / window.devicePixelRatio + "px", "important");

	});
	
	let fb = getFindBar();
	
	if ( fb.modifiedFixedElements )	
		fb.modifiedFixedElements = fb.modifiedFixedElements.concat(els);
	else
		fb.modifiedFixedElements = els;
}
	
function nextPrevious(dir) {

	let marks = getMarks();

	let index = marks.findIndex(div => div.classList.contains("CS_mark_selected") );

	index += dir;
	
	if ( index < 0 ) index = marks.length - 1;
	if ( index >= marks.length ) index = 0;
	
	jumpTo(index);
}

function getMarks() {
	let marks = Array.from(document.querySelectorAll('.CS_mark'));
	document.querySelectorAll('iframe').forEach( iframe => {

		if ( ! iframe.contentDocument ) return;
		
		let iframeOffsetTop = offset(iframe).top;

		let _marks = Array.from(iframe.contentDocument.querySelectorAll('.CS_mark'));

		let index = marks.findIndex( mark => offset(mark).top > iframeOffsetTop );

		if ( index !== -1 )
			marks.splice(index, 0, ..._marks);
	});
	
	// if ( true || userOptions.highLight.sortByAccuracy ) {
		// marks.sort( (a,b) => { return a.textContent.toLowerCase() > b.textContent.toLowerCase() ? 1 : -1 } );
	// }

	return marks;
}

function jumpTo(index) {

	document.querySelectorAll('iframe').forEach( iframe => {
		
		if ( !iframe.contentDocument ) return;
		
		iframe.contentDocument.querySelectorAll('.CS_mark_selected').forEach( _div => _div.classList.remove('CS_mark_selected', 'CS_mark_flash') );
	});
	
	document.querySelectorAll('.CS_mark_selected').forEach( _div => {
		_div.classList.remove('CS_mark_selected', 'CS_mark_flash');
		
		if ( _div.classList.contains('marker') )
			_div.style.background = userOptions.highLight.styles[parseInt(_div.dataset.style) || 0].background;
		else
			_div.style.background = null;
	});
	
	let marks = getMarks();
	
	let mark = marks[index];
	
	if ( !mark ) return;

	mark.classList.add('CS_mark_selected');
	
	if ( userOptions.highLight.flashSelected )
		mark.classList.add('CS_mark_flash');
	
	let nav = getNavBar();
	if ( nav ) {
		let navdivs = nav.querySelectorAll('div');
		if ( navdivs[index] ) {
			navdivs[index].classList.add('CS_mark_selected');
			navdivs[index].style.background = 'var(--cs-mark-active-background)';
		}
	}

	if ( window.getComputedStyle(mark, null).display !== 'none' ) {
		
		let workingDocument = document;

		if ( mark.ownerDocument != document ) {

			for ( let iframe of document.querySelectorAll('iframe') ) {
				if (iframe.contentDocument == mark.ownerDocument) {
					document.documentElement.scrollTop = iframe.getBoundingClientRect().top + document.documentElement.scrollTop - .5 * document.documentElement.clientHeight;

					workingDocument = iframe.contentDocument;
					break;	
				}
			}
		}
			
		workingDocument.documentElement.scrollTop = mark.getBoundingClientRect().top + workingDocument.documentElement.scrollTop - .5 * workingDocument.documentElement.clientHeight;

	}
	
	if ( getFindBar() )
		updateFindBar({index: index, total: marks.length});
}

function updateFindBar(options) {

	openFindBar().then( fb => {
		fb.contentWindow.postMessage(Object.assign({index: -1, total: 0}, options), browser.runtime.getURL('findbar.html'));	
	});
}

function closeFindBar() {

	let fb = getFindBar();
	if ( fb ) {
		
		fb.style.maxHeight = '0px';
		fb.style.opacity = 0;
		
		runAtTransitionEnd(fb, "max-height", () => {
			fb.parentNode.removeChild(fb); 
			document.documentElement.style.paddingTop = null;
		});
		
		if ( fb.modifiedFixedElements ) {
			fb.modifiedFixedElements.forEach( el => {
				el.style.top = el.style.getPropertyValue('--CS-original-top') || el.style.top;
				el.style.setProperty('--CS-original-top', null);
			});
		}
		
	}
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if ( !message.action ) return;
	
	switch ( message.action ) {
		case "openFindBar":
			updateFindBar(Object.assign({index:-1, searchTerms: message.searchTerms || "", total: getMarks().length}, message));
			break;
			
		case "closeFindBar":
			unmark();
			closeFindBar();
			break;
			
		case "updateFindBar":
			updateFindBar(message.options);
			break;
			
		case "findBarNext":
			nextPrevious(1);
			break;
		
		case "findBarPrevious":
			nextPrevious(-1);
			break;
			
		case "mark":
			unmark();
			mark(message);
			break;

		case "unmark":
			unmark();
			break;
			
		case "markDone":

			if ( 
				( userOptions.highLight.navBar.enabled && !message.findBarSearch ) ||
				( userOptions.highLight.findBar.showNavBar && message.findBarSearch )
			)
				openNavBar();

			if ( getFindBar() || ( userOptions.highLight.showFindBar && !message.findBarSearch ) || message.findBarSearch ) 
				updateFindBar(Object.assign({index:-1, total: getMarks().length}, message));

			if ( getFindBar() ) getFindBar().focus();

			if ( message.findBarSearch ) jumpTo(0);
			
			break;
			
		case "findBarUpdateOptions":
			markOptions = message.markOptions;
			break;
			
	}
});

document.addEventListener("fullscreenchange", (e) => {
	
	let fb = getFindBar();
	let navbar = getNavBar();
	
	if ( userOptions.highLight.findBar.hideFullScreen && document.fullscreen ) {
		if (fb) fb.style.display = 'none';	
		if (navbar) navbar.style.display = 'none';
		
	} else {			
		if (fb) fb.style.display = null;
		if (navbar) navbar.style.display = null;
	}
});

// https://stackoverflow.com/a/8769287
function findFixedMethodOne() {
	
	//[style*=..] = attribute selector
	var possibilities = ['[style*="position:fixed"],[style*="position: fixed"],[style*="position:sticky"],[style*="position: sticky"]'],
		searchFor = /\bposition:\s*fixed;/,
		styles = document.styleSheets,
		i, j, l, rules, rule, elem, res = [];

	
	for (i=0; i<styles.length; i++) {
	
		try { // CORS causes some stylesheets to fail test
			rules = styles[i].cssRules;
			l = rules.length;
			for (j=0; j<l; j++) {
				rule = rules[j];
				if (searchFor.test(rule.cssText)) {
					possibilities.push(rule.selectorText.trim());
				}
			}
		} catch (e) {
			
		}

	}

	possibilities = possibilities.join(',');

	possibilities = document.querySelectorAll(possibilities);
	l = possibilities.length;
	for (i=0; i<l; i++) {
	   elem = possibilities[i];
	   // Test whether the element is really position:fixed
	   if (/sticky|fixed|absolute/.test(window.getComputedStyle(elem, null).getPropertyValue("position")) && /0|0px/.test(window.getComputedStyle(elem, null).getPropertyValue("top") ) ) {
		   
		   if ( window.getComputedStyle(elem, null).getPropertyValue("position") === 'absolute' && elem.parentNode !== document.body ) continue;
		   res.push(elem);
	   }
	}

	return res; 
}

function findFixedMethodTwo() {
	let els = [];
	
	// check for elements at the findbar border every n pixels
	for ( let i=0;i<document.body.offsetWidth;i+=10 ) {
		els = els.concat( document.elementsFromPoint(i,35 * 1 / window.devicePixelRatio) );
	}
	
	// filter duplicates using Set
	let set = new Set(els);
	els = Array.from(set);

	// filter potentials based on display attribute
	els = els.filter( el => {
		let styles = window.getComputedStyle(el, null);
		return ( /fixed|sticky/.test(styles.getPropertyValue('position')));
	});
	
	// skip child elements
	return els.filter( el => {
		return !els.find( _el => _el === el.parentNode );
	});
	
}

// check for sticky divs and banners that pop up when scrolling
let scrollThrottler = null;
document.addEventListener('scroll', (e) => {
	
	if ( scrollThrottler ) return;
	
	let fb = getFindBar();
	
	if ( !fb ) return;

	scrollThrottler = setTimeout(() => {

		let els = findFixedMethodTwo().filter( el => el !== fb );
	
		hideFixed(els);
		
		clearTimeout(scrollThrottler);
		scrollThrottler = null;
		
	}, 500);	
});
