if ( window != top ) {
	console.log('not parent window');
} else {

	let sbContainer = document.createElement('div');
	sbContainer.id = 'CS_sbContainer';
	sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		
	let sbTab = document.createElement('div');
	sbTab.id = 'CS_sbTab';
	
	// let img = document.createElement('img');
	// img.src = browser.runtime.getURL('icons/icon48.png');
	// img.style = 'height:16px;vertical-align:middle';
	// sbTab.appendChild(img);

	sbTab.addEventListener('click', (e) => {
		
		if ( document.getElementById('CS_searchBarIframe') ) {
			sbContainer.removeChild(document.getElementById('CS_searchBarIframe'));
			sbTab.style.opacity = null;
			return;
		}
		
		let iframe = document.createElement('iframe');
		iframe.style = 'display:inline-block;border:1px solid black;border-right:none';
		iframe.id = 'CS_searchBarIframe';
		iframe.src = browser.runtime.getURL('searchbar.html');

		sbContainer.appendChild(iframe);
		sbTab.style.opacity = 1;

	});

	sbTab.addEventListener('dragover', (e) => {
		if ( document.getElementById('CS_searchBarIframe') ) return;
		sbTab.dispatchEvent(new MouseEvent('click'));
	});

	sbContainer.appendChild(sbTab);
	document.body.appendChild(sbContainer);
	
	window.addEventListener('message', (e) => {

		let url = new URL(browser.runtime.getURL(''));

		if ( e.origin !== url.origin ) return;
		
		if ( !e.data.size ) return;

		let iframe = document.getElementById('CS_searchBarIframe');

		if ( !iframe ) return;
		
		iframe.style.height = e.data.size.height + "px";
		iframe.style.width = e.data.size.width + "px";

	});
}
