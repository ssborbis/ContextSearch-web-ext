browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
	
	let userOptions = result.userOptions;

	if ( userOptions.highLight.enabled ) {
		let styleEl = document.createElement('style');
		document.head.appendChild(styleEl);
		
		styleEl.innerText = '.CS_mark { background: ' + userOptions.highLight.background + ';color:' + userOptions.highLight.color + ';}';
	}
});