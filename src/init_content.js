if ( window && window !== window.top ) {
	window.addEventListener('mousedown', e => {
		console.log('iframe received focus');
		browser.runtime.sendMessage({action:"injectContentScripts"});
	}, {once: true});
} else {
	browser.runtime.sendMessage({action:"injectContentScripts"});
}