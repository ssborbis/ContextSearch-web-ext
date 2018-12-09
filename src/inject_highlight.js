var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
	
	userOptions = result.userOptions;

	let styleEl = document.createElement('style');
	document.head.appendChild(styleEl);
	
	styleEl.innerText = '.CS_mark { background: ' + userOptions.highLight.background + ';color:' + userOptions.highLight.color + ';}';
});

document.addEventListener('CS_mark_done', () => {
	// Chrome markings happened before loading userOptions
	let optionsCheck = setInterval( () => {
		if ( userOptions === {} ) return;
		
		clearInterval(optionsCheck);
		
		if ( userOptions.highLight.navBar && userOptions.highLight.navBar.enabled )
			createNavBar();
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
	div.style.setProperty('--highlight-background', userOptions.highLight.background);
	
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
		
	});
	
	document.body.appendChild(div);
}



