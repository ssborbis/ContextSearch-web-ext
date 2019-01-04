var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
		
	userOptions = result.userOptions;

	let styleEl = document.createElement('style');
	document.head.appendChild(styleEl);
	
	styleEl.innerText = `
		.CS_mark[data-style="0"] { 
			background:${userOptions.highLight.styles[0].background};
			color:${userOptions.highLight.styles[0].color};
		}	
		.CS_mark[data-style="1"] {
			background:${userOptions.highLight.styles[1].background};
			color:${userOptions.highLight.styles[1].color};
		}
		.CS_mark[data-style="2"] {
			background:${userOptions.highLight.styles[2].background};
			color:${userOptions.highLight.styles[2].color};
		}
		.CS_mark[data-style="3"] {
			background:${userOptions.highLight.styles[3].background};
			color:${userOptions.highLight.styles[3].color};
		}
		.CS_mark_selected {
			background: ${userOptions.highLight.activeStyle.background} !important;
			color: ${userOptions.highLight.activeStyle.color} !important;
		}
		`;
		
	if ( userOptions.highLight.findBar.startOpen ) browser.runtime.sendMessage({action: "openFindBar"});
});

document.addEventListener('keydown', (e) => {
	if ( e.which === 27 ) {
		browser.runtime.sendMessage({action: "unmark"}).then( () => {
			browser.runtime.sendMessage({action: "closeFindBar"});
		});
	}
});

window.addEventListener('keydown', (e) => {

	if (
		!userOptions.highLight.findBar.enabled
		|| !userOptions.highLight.findBar.hotKey.length
		|| e.repeat
		|| !userOptions.highLight.findBar.hotKey.includes(e.keyCode)
	) return;
	
	for (let i=0;i<userOptions.highLight.findBar.hotKey.length;i++) {
		let key = userOptions.highLight.findBar.hotKey[i];
		if (key === 16 && !e.shiftKey) return;
		if (key === 17 && !e.ctrlKey) return;
		if (key === 18 && !e.altKey) return;
		if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return;
	}

	e.preventDefault();

	let searchTerms = getSelectedText(e.target);
	
	browser.runtime.sendMessage({action: "unmark"}).then( () => {
		browser.runtime.sendMessage({action: "mark", searchTerms: searchTerms});
	});

	window.getSelection().removeAllRanges();
	
});


var CS_MARK_instance = null;

var getFindBar = () => {return document.getElementById('CS_findBarIframe');}
var getNavBar = () => {return document.getElementById('CS_highLightNavBar');}

document.addEventListener('CS_mark', (e) => {

	CS_MARK_instance = new Mark(document.body);
	
	// Chrome markings happened before loading userOptions
	let optionsCheck = setInterval( () => {
		if ( userOptions === {} ) return;
		
		clearInterval(optionsCheck);
		
		CS_MARK_instance = CS_MARK_instance || new Mark(document.body);
		CS_MARK_instance.unmark();
		
		mark(e.detail.trim());
	
	}, 100);
	
});

function unmark() {
	
	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);
	CS_MARK_instance.unmark();
	
	closeNavBar();
//	closeFindBar();
	
	browser.runtime.sendMessage({action: "removeTabHighlighting"});
}

function closeNavBar() {
	let nav = getNavBar();	
	if ( nav ) nav.parentNode.removeChild(nav);
}

function mark(searchTerms) {
	
	searchTerms = searchTerms.trim();

	CS_MARK_instance = CS_MARK_instance || new Mark(document.body);

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

	words.forEach( (word, i) => {

		CS_MARK_instance.mark(word, {
			className:"CS_mark",
			separateWordSearch: false,

			each: (el) => {
				
				if ( el.getBoundingClientRect().height === 0 || window.getComputedStyle(el, null).display === "none" )
					el.classList.add('CS_unmark');
				
				if ( el.parentNode.classList.contains('CS_mark') )
					el.classList.add('CS_unmark');
				
			//	el.id = 'CS_mark_' + gen();
				
			},
			
			done: () => {

				if ( i !== words.length - 1 ) return;

				CS_MARK_instance.unmark({className: 'CS_unmark'});
				
				document.querySelectorAll(".CS_mark").forEach( el => {
					let index = words.findIndex( word => {
						return word.toLowerCase() === el.textContent.toLowerCase();
					});
					
					if ( index !== -1 ) el.dataset.style = index > 3 ? index % 4 : index;	
				});
				
				if ( window == top && userOptions.highLight.navBar.enabled )
					setTimeout( openNavBar, 1000);

				if ( window == top && ( getFindBar() || userOptions.highLight.showFindBar ) ) 
					browser.runtime.sendMessage({action: "openFindBar", searchTerms:searchTerms});
				
				browser.runtime.sendMessage({action: "markDone"});
			}
		});
	});
}
function openNavBar() {

	let hls = document.querySelectorAll('.CS_mark');
	
	// get frame marks
	let iframes = document.querySelectorAll('iframe:not([src="' + browser.runtime.getURL('findbar.html') + '"])');
	
	iframes.forEach( frame => {
		let _hls = frame.contentDocument.querySelectorAll('.CS_mark');
		
		hls = Array.from(hls).concat(Array.from(_hls));
	});

	if ( ! hls.length ) return;

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
	
	let ratio = document.documentElement.clientHeight / document.documentElement.offsetHeight;
	
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

		let rect = hl.getBoundingClientRect();

		let marker = document.createElement('div');

		marker.style.top = rect.top * ratio / document.documentElement.clientHeight * 100 + "vh";
		marker.style.height = rect.height * ratio / document.documentElement.clientHeight * 100 + "vh";
		
		if ( hl.ownerDocument != document ) {
			let iframe = Array.from(document.querySelectorAll('iframe')).find( iframe => iframe.contentDocument == hl.ownerDocument );

			marker.style.top = iframe.getBoundingClientRect().top * ratio / document.documentElement.clientHeight * 100 + "vh";
		}

		marker.style.backgroundColor = userOptions.highLight.styles[hl.dataset.style || 0].background;
		
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

function openFindBar(searchTerms, total, callback) {

	let fb = getFindBar();
	
	callback = callback || function() {};
	
	if ( fb ) {
		updateFindBar({searchTerms:searchTerms, total:total});
		callback();
		return;
	}
	
	fb = document.createElement('iframe');
	fb.id = 'CS_findBarIframe';
	fb.style.transformOrigin = userOptions.highLight.findBar.position + " left";
	fb.style.transform = 'scale(' + 1 / window.devicePixelRatio + ')';
	fb.style.width = '600px';
	
	fb.style[userOptions.highLight.findBar.position] = '0';

	document.body.appendChild(fb);
	fb.onload = function() {
		updateFindBar({searchTerms:searchTerms, index: -1, total:total});
		fb.focus();
		callback();
	}
	
	fb.src = browser.runtime.getURL("/findbar.html");
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

		let _marks = Array.from(iframe.contentDocument.querySelectorAll('.CS_mark'));
		
//		console.log(_marks);

		let iframeRect = iframe.getBoundingClientRect();

		let index = marks.findIndex( mark => mark.getBoundingClientRect().top > iframeRect.top );

		if ( index !== -1 )
			marks.splice(index, 0, ..._marks);
	});
	
//	console.log(marks);
	
	return marks;
}

function jumpTo(index) {
	
//	console.log(index);
	
	document.querySelectorAll('iframe').forEach( iframe => {
		
		if ( !iframe.contentDocument ) return;
		
		iframe.contentDocument.querySelectorAll('.CS_mark_selected').forEach( _div => _div.classList.remove('CS_mark_selected', 'CS_mark_flash') );
	});
	
	document.querySelectorAll('.CS_mark_selected').forEach( _div => _div.classList.remove('CS_mark_selected', 'CS_mark_flash') );
	
	let marks = getMarks();
	
	let mark = marks[index];

	mark.classList.add('CS_mark_selected');
	
	if ( userOptions.highLight.flashSelected )
		mark.classList.add('CS_mark_flash');
	
	let nav = getNavBar();
	if ( nav ) {
		let navdivs = nav.querySelectorAll('div');
		if ( navdivs[index] ) navdivs[index].classList.add('CS_mark_selected');
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
	
	if ( window != top ) {
//		console.log(' not top window' );
		return;
	}
	let fb = getFindBar();

	if (fb) fb.contentWindow.postMessage({index: options.index || 0, total: options.total || 0, searchTerms: options.searchTerms || ""}, browser.runtime.getURL('findbar.html'));
}

function closeFindBar() {
	let fb = getFindBar();
	if ( fb ) fb.parentNode.removeChild(fb);
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if ( !message.action ) return;
	
	switch ( message.action ) {
		case "openFindBar":
			openFindBar(message.searchTerms || "", getMarks().length);
			break;
			
		case "closeFindBar":
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
			mark(message.searchTerms);
			break;
			
		case "unmark":
			unmark();
			break;
			
				// case "mark":
			// unmark();
			// mark(e.data.searchTerms);
			// let marks = document.querySelectorAll('.CS_mark');
			// updateFindBar({total: marks.length});
			// break;
		
		// case "close":
			// unmark();
			// closeFindBar();
			// break;
			
	// }
	}
});




