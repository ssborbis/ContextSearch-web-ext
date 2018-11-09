if ( window != top ) {
	console.log('not parent window');
} else {

	let sbContainer = document.createElement('div');
	sbContainer.id = 'CS_sbContainer';
	sbContainer.style.transform = "scale(" + 1 / window.devicePixelRatio + ")";
		
	let sbTab = document.createElement('div');
	sbTab.id = 'CS_sbTab';
	
	let img = document.createElement('img');
	img.src = browser.runtime.getURL('icons/crossmark.png');

	sbTab.appendChild(img);

	sbTab.addEventListener('click', (e) => {
		
		if ( document.getElementById('CS_searchBarIframe') ) {
			sbContainer.removeChild(document.getElementById('CS_searchBarIframe'));
			sbTab.style.opacity = null;
			img.style.display = null;
			return;
		}
		
		let iframe = document.createElement('iframe');
		iframe.style = 'display:inline-block;border:1px solid black;border-right:none';
		iframe.id = 'CS_searchBarIframe';
		iframe.src = browser.runtime.getURL('searchbar.html');

		sbContainer.appendChild(iframe);
		sbTab.style.opacity = 1;
		img.style.display = 'inline-block';

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
