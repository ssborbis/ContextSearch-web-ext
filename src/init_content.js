// ContextSearch web-ext - Enhanced iframe compatibility
(function() {
    'use strict';
    if ( !['http:', 'https:', 'about:', 'file:'].includes(location.protocol)) {
        return;
    } else if (window !== window.top) {
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
