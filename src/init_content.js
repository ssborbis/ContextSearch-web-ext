// ContextSearch web-ext - Enhanced iframe compatibility
(function() {
    'use strict';
    
    if (window !== window.top) {
        // For all iframes: inject on click (original behavior)
        window.addEventListener('mousedown', e => {
            console.log('iframe received focus');
            browser.runtime.sendMessage({action:"injectContentScripts"})
            	.catch(error => console.log('ContextSearch: iframe injection failed', error));
        }, {once: true});
        
        // Additional: immediate injection for about:blank iframes (Zimbra fix)
        if (window.location.href === 'about:blank') {
            browser.runtime.sendMessage({action:"injectContentScripts"})
                .catch(error => console.log('ContextSearch: about:blank injection failed', error));
        }
    } else {
        // For top frames: skip about:blank (original behavior)
        if (window?.location?.href !== 'about:blank') {
            browser.runtime.sendMessage({action:"injectContentScripts"})
                .catch(error => console.log('ContextSearch: injection failed', error));
        }
    }
})();

// if ( window && window !== window.top ) {
// 	window.addEventListener('mousedown', e => {
// 		console.log('iframe received focus');
// 		browser.runtime.sendMessage({action:"injectContentScripts"});
// 	}, {once: true});
// } else {
// 	// Skip about:blank on tpo frames for now. Allow on iframes (see Zimba webmail)
// 	if (window?.location?.href !== 'about:blank');
// 		browser.runtime.sendMessage({action:"injectContentScripts"});
// }