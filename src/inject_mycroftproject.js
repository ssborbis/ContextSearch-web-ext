if ( window != top && window.location.hash === '#addtocontextsearch' ) {

	sendMessage({action: "getOpenSearchLinks", frame: true}).then( async oses => {

		for ( ose of oses ) {

			// skip default mycroftproject engine
			if ( ose.href.endsWith('/opensearch.xml')) continue;

			let xml_se = await openSearchUrlToSearchEngine(ose.href).then( details => {
				return (!details) ? null : details.searchEngines[0];
			});

			return sendMessage({action: "openCustomSearch", se: xml_se});
		}
	});
}
function showButtons() {

	if ( window != top ) return;

	let links = document.querySelectorAll('a[href*="/install.html"]');

	links.forEach( link => {
		let img = new Image();
		img.src = browser.runtime.getURL('icons/logo_notext.svg');
		img.className = 'icon';
		img.style.marginRight = '4px';
		img.style.cursor = 'pointer';
		img.title = i18n("AddCustomSearch");

		img.onclick = function(e) {
			let iframe = document.createElement('iframe');

			iframe.src = link + "#addtocontextsearch";
			iframe.style.display = 'none';

			// injection into iframes needs triggering
			iframe.onload = function() {
				iframe.contentDocument.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
			}

			document.body.appendChild(iframe);
		}

		link.parentNode.insertBefore(img, link);
	});
}

if ( document.readyState === 'complete' ) showButtons();

window.addEventListener('load', showButtons);
