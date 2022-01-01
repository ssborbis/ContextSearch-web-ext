if ( window != top && window.location.hash === '#addtocontextsearch' ) {

	browser.runtime.sendMessage({action: "getUserOptions"}).then( async uo => {
		userOptions = uo;

		let oses = await browser.runtime.sendMessage({action: "getOpenSearchLinks", frame: true});

		if ( !oses ) return;

		for ( ose of oses ) {

			if ( ose.href.endsWith('/opensearch.xml')) continue;

			let xml_se = await browser.runtime.sendMessage({action: "openSearchUrlToSearchEngine", url: ose.href}).then( details => {
				return (!details) ? null : details.searchEngines[0];
			});

			browser.runtime.sendMessage({action: "openCustomSearch", se: xml_se});
		}
	});
}

window.addEventListener('load', function () {

	let links = document.querySelectorAll('a[href*="/install.html"]');

	links.forEach( l => {
		let img = new Image();
		img.src = browser.runtime.getURL('icons/logo_notext.svg');
		img.className = 'icon';
		img.style.marginRight = '4px';
		img.title = browser.i18n.getMessage("AddCustomSearch");

		img.onclick = function(e) {
			let iframe = document.createElement('iframe');
			iframe.style = 'display:none;';
			document.body.appendChild(iframe);
			iframe.src = l + "#addtocontextsearch";
		}

		l.parentNode.insertBefore(img, l);
	});

});