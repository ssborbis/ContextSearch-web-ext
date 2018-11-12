if ( window != top ) {
	console.log('not parent window');
} else {
	
	// let openingTab = document.createElement('div');
	// openingTab.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";

	let sbContainer = document.createElement('div');
	sbContainer.id = 'CS_sbContainer';
	sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		
	let sbTab = document.createElement('div');
	sbTab.id = 'CS_sbTab';
	
	let img = document.createElement('img');
	img.src = browser.runtime.getURL('icons/crossmark.png');

	sbTab.appendChild(img);

	sbTab.addEventListener('click', (e) => {
		let iframe = document.getElementById('CS_searchBarIframe');
		if ( iframe ) {
			iframe.addEventListener('transitionend', (e) => {
				iframe.parentNode.removeChild(iframe);
			});
			iframe.style.maxWidth = '0px';
			sbTab.style.opacity = null;
			img.style.display = null;
			return;
		}
		
		iframe = document.createElement('iframe');
		iframe.style = 'display:inline-block;border:1px solid black;border-right:none;max-width:0px;overflow:hidden;transition:max-width .1s';
		iframe.id = 'CS_searchBarIframe';
		iframe.src = browser.runtime.getURL('searchbar.html');

		sbContainer.appendChild(iframe);
		sbTab.style.opacity = 1;
		img.style.display = 'inline-block';

	});

	// open sidebar if dragging text over
	sbTab.addEventListener('dragover', (e) => {
		if ( document.getElementById('CS_searchBarIframe') ) return;
		sbTab.dispatchEvent(new MouseEvent('click'));
	});
	
	sbTab.addEventListener('mousedown', (e) => {	
		sbTab.startingY = e.y;
	//	document.addEventListener('mousemove', tabMoveListener);
	});
	
	document.addEventListener('mouseup', (e) => {
		document.removeEventListener('mousemove', tabMoveListener);
	});
	
	function tabMoveListener(e) {
		sbTab.style.top = e.y - sbTab.startingY + "px";
	}

	sbContainer.appendChild(sbTab);
	document.body.appendChild(sbContainer);
	
	window.addEventListener('message', (e) => {

		let url = new URL(browser.runtime.getURL(''));

		if ( e.origin !== url.origin ) return;
		
		if ( !e.data.size ) return;

		let iframe = document.getElementById('CS_searchBarIframe');

		if ( !iframe ) return;
		
		iframe.style.height = Math.min(e.data.size.height, window.innerHeight * window.devicePixelRatio) + "px";
		iframe.style.width = e.data.size.width + "px";
		iframe.style.maxWidth = iframe.style.width;

	});
	
	// listen for quickMenuHotkey
	window.addEventListener('keydown', (e) => {
		if (
			!userOptions.quickMenuOnHotkey
			|| e.repeat
		) return;
		
		for (let i=0;i<userOptions.quickMenuHotkey.length;i++) {
			let key = userOptions.quickMenuHotkey[i];
			if (key === 16 && !e.shiftKey) return;
			if (key === 17 && !e.ctrlKey) return;
			if (key === 18 && !e.altKey) return;
			if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return;
		}

		e.preventDefault();
		sbTab.click();
		
	});
}
