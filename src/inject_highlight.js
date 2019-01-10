var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	userOptions = result.userOptions;

	// append marking styles
	let styleEl = document.createElement('style');
	document.head.appendChild(styleEl);
	
	styleEl.innerText = `
		:root {
			--cs-mark-active-background: ${userOptions.highLight.activeStyle.background};
			--cs-mark-active-color: ${userOptions.highLight.activeStyle.color};
		}
		.CS_mark[data-style="0"], #CS_highLightNavBar > DIV[data-style="0"] { 
			background:${userOptions.highLight.styles[0].background};
			color:${userOptions.highLight.styles[0].color};
		}	
		.CS_mark[data-style="1"], #CS_highLightNavBar[ > DIVdata-style="1"] {
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
	
	// open findbar on pageload if set
	if ( window == top && userOptions.highLight.findBar.startOpen ) openFindBar();
});

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
		!userOptions.highLight.findBar.enabled
		|| !userOptions.highLight.findBar.hotKey.length
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
	
	if ( !searchTerms ) searchTerms = window.findBarLastSearchTerms || "";
	
	// search for selected terms
	browser.runtime.sendMessage({action: "mark", searchTerms: searchTerms, findBarSearch:true});

	window.getSelection().removeAllRanges();
	
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
		mark(searchTerms);
	
	}, 100);
	
});

function unmark() {
	
	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);
	CS_MARK_instance.unmark();
	
	closeNavBar();
	
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
		words2.push(words.slice(0,i).join(" "));
	}

	// build final array and filter empty
	words = words.concat(words2).concat(phrases).filter( a => a.length );
	
//	console.log(words);

	if ( !userOptions.highLight.markOptions.separateWordSearch )
		words = [searchTerms];
	
	// sort largest to smallest to avoid small matches breaking larger matches
	words.sort( (a, b) => {return ( a.length > b.length ) ? -1 : 1} );
	
	return words;
}

function mark(searchTerms, findBarSearch) {
	
	searchTerms = searchTerms.trim();
	
	window.findBarLastSearchTerms = searchTerms;

	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);

	let words = findBarSearch ? [searchTerms] : buildSearchWords(searchTerms);

	words.forEach( (word, i) => {

		CS_MARK_instance.mark(word, {
			className:"CS_mark",
			separateWordSearch: false,
			accuracy: findBarSearch ? "partially" : userOptions.highLight.markOptions.accuracy,
			ignorePunctuation: findBarSearch ? ":;.,-–—‒_(){}[]!'\"+=".split("") : [],

			each: (el) => {
				
				// add class to hidden makers for removal later
				if ( el.getBoundingClientRect().height === 0 || window.getComputedStyle(el, null).display === "none" )
					el.classList.add('CS_unmark');
				
				// add class to hits contained in other hits for removal later
				if ( el.parentNode.classList.contains('CS_mark') )
					el.classList.add('CS_unmark');	
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
					
					if ( index !== -1 ) el.dataset.style = index > 3 ? index % 4 : index;	
				});

				browser.runtime.sendMessage({action: "markDone", searchTerms:searchTerms, words: words, findBarSearch: findBarSearch});
			}
		});
	});
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
		fb.style.transform = 'scale(' + 1 / window.devicePixelRatio + ')';
		fb.style.width = '800px';
		fb.style.opacity = 0;
		fb.style.maxHeight = 0;
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
	});
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
		_div.style.background = null;
	});
	
	let marks = getMarks();
	
	let mark = marks[index];

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

	updateFindBar({index: index, total: marks.length});
}

function updateFindBar(options) {

	openFindBar().then( fb => {
		fb.contentWindow.postMessage({index: options.index || 0, total: options.total || 0, searchTerms: options.searchTerms || ""}, browser.runtime.getURL('findbar.html'));	
	});
}

function closeFindBar() {
	let fb = getFindBar();
	if ( fb ) {
		runAtTransitionEnd(fb, "opacity", () => { fb.parentNode.removeChild(fb); });
		fb.style.maxHeight = 0;
		fb.style.opacity = 0;
	}
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if ( !message.action ) return;
	
	switch ( message.action ) {
		case "openFindBar":
			updateFindBar({index:-1, searchTerms: message.searchTerms || "", total: getMarks().length});
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
			mark(message.searchTerms, message.findBarSearch || null);
			if ( window == top && userOptions.highLight.showFindBar ) 
				updateFindBar({index:-1, searchTerms: message.searchTerms || "", total: getMarks().length});
				if ( getFindBar() ) getFindBar().focus();
			break;
			
		case "unmark":
			unmark();
			break;
			
		case "markDone":

			if ( userOptions.highLight.navBar.enabled )
				openNavBar();
			
			updateFindBar({index:-1, searchTerms: message.searchTerms || "", total: getMarks().length});
			
			if ( message.findBarSearch ) jumpTo(0);
			
			break;
			
		case "findBarUpdateOptions":
			userOptions = message.userOptions;
			browser.runtime.sendMessage({action: "mark", searchTerms: message.searchTerms});
			
	}
});




