var userOptions;

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
	
	userOptions = result.userOptions;

	if ( userOptions.highLight.enabled ) {
		let styleEl = document.createElement('style');
		document.head.appendChild(styleEl);
		
		styleEl.innerText = '.CS_mark { background: ' + userOptions.highLight.background + ';color:' + userOptions.highLight.color + ';}';
		
		setTimeout(() => {
			createMap();
		}, 500);
	}
});

function createMap() {
	
	let hls = document.querySelectorAll('.CS_mark');
	
	if ( ! hls.length ) return;

	let div = document.createElement('div');
	div.id = 'CS_highLightNavBar';
	
	div.style.transform = 'scale(' + 1/window.devicePixelRatio + ')';
	div.style.height = document.documentElement.clientHeight * window.devicePixelRatio + "px";
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/crossmark.png');
	
	img.onclick = function(e) {
		e.preventDefault();
		e.stopPropagation();
		CS_MARK_instance.unmark();
		div.parentNode.removeChild(div);
	}
	
	div.appendChild(img);
	
	let ratio = document.documentElement.clientHeight / document.documentElement.offsetHeight;
	
	div.onclick = function(e) {
		document.documentElement.scrollTop = e.clientY / ratio;
	}
	
	div.addEventListener('mousedown', (e) => {
		
		e.preventDefault();
		
		function mouseMoveHandler(_e) {
			_e.preventDefault();
			document.documentElement.scrollTop = _e.clientY / ratio;
		}
		
		document.addEventListener('mousemove', mouseMoveHandler);
		
		document.addEventListener('mouseup', () => {
			document.removeEventListener('mousemove', mouseMoveHandler);
		}, {once:true});
	});
	
	hls.forEach( hl => {
		let rect = hl.getBoundingClientRect();
		
		let marker = document.createElement('div');

		marker.style.top = rect.top * ratio * window.devicePixelRatio + "px";
		marker.style.height = rect.height * ratio * window.devicePixelRatio + "px";
		marker.style.setProperty('--highlight-background', userOptions.highLight.background);
		
		marker.onclick = function(e) {
			
			e.stopImmediatePropagation();
			
			document.querySelectorAll('.CS_mark').forEach( _hl => _hl.style.filter = null );
			div.querySelectorAll('*').forEach( _div => _div.style.filter = null );
			
			let _top = parseFloat(marker.style.top) / ratio;
			document.documentElement.scrollTop = (_top - 20) / window.devicePixelRatio;
			
			hl.style.filter = 'invert(1)';
			marker.style.filter = 'invert(1)';
		}
		
		div.appendChild(marker);
		
	});
	
	
	document.body.appendChild(div);
}



