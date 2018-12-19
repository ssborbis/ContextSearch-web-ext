var userOptions = {};

var CS_MARK_instance = null;

var getFindBar = () => {return document.getElementById('CS_findBarIframe');}
var getNavBar = () => {return document.getElementById('CS_highLightNavBar');}

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
});

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

document.addEventListener('keydown', (e) => {
	if ( e.which === 27 ) {
		unmark();
		closeFindBar();
	}
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

	let phrases = searchTerms.match(/".*?"/g) || [];

	phrases.forEach( (phrase, i) => {
		searchTerms = searchTerms.replace(phrase, "");
		phrases[i] = phrase.replace(/^"(.*)"$/g, "$1");
	});

	let words = searchTerms.split(/\s+/).concat(phrases);

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
					el.classList.remove('CS_mark');
				
			},
			
			done: () => {

				if ( i !== words.length - 1 ) return;
				
				document.querySelectorAll(".CS_mark").forEach( el => {
					let index = words.findIndex( word => {
						return word.toLowerCase() === el.textContent.toLowerCase();
					});
					
					 if ( index !== -1 ) el.dataset.style = index > 3 ? index % 4 : index;	
				});
				
				if ( userOptions.highLight.navBar.enabled )
					openNavBar();

				if ( userOptions.highLight.findBar.enabled ) 
					openFindBar(searchTerms, document.querySelectorAll(".CS_mark").length);
			}
		});
	});
}
function openNavBar() {

	let hls = document.querySelectorAll('.CS_mark');
	
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
	
	if ( fb ) {
		updateFindBar({searchTerms:searchTerms, total:total});
		callback();
		return;
	}
	
	fb = document.createElement('iframe');
	fb.id = 'CS_findBarIframe';
	fb.style.transformOrigin = userOptions.highLight.findBar.position + " left";
	fb.style.transform = 'scale(' + 1 / window.devicePixelRatio + ')';
	fb.style.width = 'calc(100% * ' + window.devicePixelRatio + ')';
	
	fb.style[userOptions.highLight.findBar.position] = '0';

	document.body.appendChild(fb);
	fb.onload = function() {
		updateFindBar({searchTerms:searchTerms, index: -1, total:total});
		fb.focus();
		callback();
	}
	
	fb.src = browser.runtime.getURL("/findbar.html");
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action === 'undefined') return;
	
	switch (message.action) {

		case "getHighlightStatus":
		
			return Promise.resolve(true);
			break;
	}
});

window.addEventListener("message", (e) => {
	
	function nextPrevious(dir) {
		let marks = document.querySelectorAll('.CS_mark');
		let index = [].findIndex.call(marks, div => div.classList.contains("CS_mark_selected") );

		index += dir;
		
		if ( index < 0 ) index = marks.length - 1;
		if ( index >= marks.length ) index = 0;
		
		jumpTo(index);
	}
	
	switch ( e.data.action ) {
		case "next":
			nextPrevious(1);
			break;
			
		case "previous":
			nextPrevious(-1);
			break;
			
		case "mark":
			unmark();
			mark(e.data.searchTerms);
			let marks = document.querySelectorAll('.CS_mark');
			updateFindBar({total: marks.length});
			break;
		
		case "close":
			unmark();
			closeFindBar();
			break;
			
	}
	
});

function jumpTo(index) {
	
	document.querySelectorAll('.CS_mark_selected').forEach( _div => _div.classList.remove('CS_mark_selected') );
	
	let marks = document.querySelectorAll('.CS_mark');
	let mark = marks[index];

	mark.classList.add('CS_mark_selected');
	
	let nav = getNavBar();
	if ( nav ) {
		let navdivs = nav.querySelectorAll('div');
		if ( navdivs[index] ) navdivs[index].classList.add('CS_mark_selected');
	}

	if ( window.getComputedStyle(mark, null).display !== 'none' )
		document.documentElement.scrollTop = mark.getBoundingClientRect().top + document.documentElement.scrollTop - .5 * document.documentElement.clientHeight;

	updateFindBar({index: index, total: marks.length});
}

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
	unmark();
	mark(searchTerms);
	
});

function updateFindBar(options) {
	let fb = getFindBar();
	if (fb) fb.contentWindow.postMessage({index: options.index || 0, total: options.total || 0, searchTerms: options.searchTerms || ""}, browser.runtime.getURL('/findbar.html'));
}

function closeFindBar() {
	let fb = getFindBar();
	if ( fb ) fb.parentNode.removeChild(fb);
}





