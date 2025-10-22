if ( window && window !== window.top ) {
	window.addEventListener('mousedown', e => {
		console.log('iframe received focus');
		browser.runtime.sendMessage({action:"injectContentScripts"});
	}, {once: true});
} else {
	// Skip about:blank on tpo frames for now. Allow on iframes (see Zimba webmail)
	if (window?.location?.href !== 'about:blank');
		browser.runtime.sendMessage({action:"injectContentScripts"});
}