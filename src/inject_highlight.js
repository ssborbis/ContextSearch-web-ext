var userOptions = {};

var CS_MARK_instance;

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
		`;
});

document.addEventListener('CS_mark', (e) => {
	
	CS_MARK_instance = new Mark(document.body);
	
	// Chrome markings happened before loading userOptions
	let optionsCheck = setInterval( () => {
		if ( userOptions === {} ) return;
		
		clearInterval(optionsCheck);
		
			let words = e.detail.trim().split(/\s/);
		
			CS_MARK_instance.mark(e.detail, {
				className:"CS_mark",
				separateWordSearch: userOptions.highLight.markOptions.separateWordSearch,
				
				each: (el) => {
					let index = words.findIndex( word => {
						return word.toLowerCase() === el.textContent.toLowerCase();
					});
					
					if ( index !== -1 )	el.dataset.style = index > 3 ? 0 : index;		
				},
				
				done: () => {
					if ( userOptions.highLight.navBar.enabled )
						createNavBar();
				}
			});
	
	}, 100);
	
});

document.addEventListener('keydown', (e) => {
	if ( e.which === 27 ) {
		CS_MARK_instance.unmark();
		
		let nav = document.getElementById('CS_highLightNavBar');
		
		if ( nav ) nav.parentNode.removeChild(nav);
	}
}, {once: true});

function createNavBar() {

	let hls = document.querySelectorAll('.CS_mark');
	
	if ( ! hls.length ) return;

	let div = document.createElement('div');
	div.id = 'CS_highLightNavBar';
	
	div.style.transform = 'scaleX(' + 1/window.devicePixelRatio + ')';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/crossmark.png');
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
	
	hls.forEach( hl => {

		let rect = hl.getBoundingClientRect();
		
		let marker = document.createElement('div');

		marker.style.top = rect.top * ratio / document.documentElement.clientHeight * 100 + "vh";
		marker.style.height = rect.height * ratio / document.documentElement.clientHeight * 100 + "vh";

		marker.style.backgroundColor = userOptions.highLight.styles[hl.dataset.style || 0].background;
		
		marker.onclick = function(e) {
			
			e.stopImmediatePropagation();
			
			document.querySelectorAll('.CS_mark').forEach( _hl => _hl.style.filter = null );
			div.querySelectorAll('*').forEach( _div => _div.style.filter = null );
			
			let _top = parseFloat(marker.style.top) / ratio;
			navScrollToHandler(e);
			
			hl.style.filter = 'invert(1)';
			marker.style.filter = 'invert(1)';
		}
		
		div.appendChild(marker);
		
		if ( marker.previousSibling && marker.previousSibling.style.top === marker.style.top ) {
			marker.style.top = 'calc(' + marker.style.top + ' + 2px)';
		}
		
	});
	
	document.body.appendChild(div);
}



