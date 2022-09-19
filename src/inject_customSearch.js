// listen for right-mousedown and enable Add Custom Search menu item if no text is selected
function inputAddCustomSearchHandler(input) {
	
	// input.addEventListener('focus', e => {
	// 	browser.runtime.sendMessage({action: "enableAddCustomSearchMenu"});
	// });
	
	input.addEventListener('mousedown', ev => {

		if (
			ev.which !== 3
			|| getSelectedText(input)
			|| input.ownerDocument.defaultView != top
		) {
			browser.runtime.sendMessage({action: "disableAddCustomSearchMenu"});
			return;
		}

		browser.runtime.sendMessage({action: "enableAddCustomSearchMenu"});

	});
}

// Add Custom Search listener
document.querySelectorAll('input,textarea').forEach( input => inputAddCustomSearchHandler(input) );

// Add listener for dynamically added inputs
var CS_observer = new MutationObserver( mutationsList => {
	for(var mutation of mutationsList) {
        if (mutation.type == 'childList') {
			for (let node of mutation.addedNodes) {

				if (node.nodeName === "INPUT")
					inputAddCustomSearchHandler(node);
				else if ( node.nodeType === 1 )
					node.querySelectorAll('input').forEach( _node => inputAddCustomSearchHandler(_node) );

			}
        }
    }
});

CS_observer.observe(document.body, {childList: true, subtree: true});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {

			case "openCustomSearch":

				// if message contains a search engine, use that
				if ( message.se ) {

				}
			
				if ( !message.se && !window.document.querySelector("input:focus,textarea:focus") && !message.searchEngine ) {
					console.log("no focused input found");
					return;
				}

				var iframe = document.createElement('iframe');
				iframe.id = "CS_customSearchIframe";
				
				if (document.getElementById(iframe.id)) return;
				
				iframe.src = browser.runtime.getURL('/customSearch.html');
				
				getShadowRoot().appendChild(iframe);

				// blur the background
				document.body.classList.add('CS_blur');
				
				// reflow trick
				iframe.getBoundingClientRect();
				iframe.style.opacity=1;
				
				// get OpenSearch.xml url if exists
				let link = document.querySelector('link[type="application/opensearchdescription+xml"]');
				let os_href = (link) ? link.href : null;

				window.addEventListener("message", e => {	

					if (e.origin !== new URL(browser.runtime.getURL('/')).origin) return;	
					if (e.data.status !== 'complete') return;

					if ( message.se ) {
						iframe.contentWindow.postMessage({searchEngine: message.se, openSearchUrl: os_href, location: window.location.href, useOpenSearch: true}, browser.runtime.getURL('/customSearch.html'));
						return true;
					}
					
					if (message.useOpenSearch) { // openCustomSearch called by page_action

						browser.runtime.sendMessage({action: "openSearchUrlToSearchEngine", url: os_href}).then( details => {

							if (!details) {
								console.log('Cannot build search engine from xml. Missing values');
								return false;
							}
						
							let se = details.searchEngines[0];
							iframe.contentWindow.postMessage({searchEngine: se, openSearchUrl: os_href, location: window.location.href, useOpenSearch: true}, browser.runtime.getURL('/customSearch.html'));

						});
					} else { // openCustomSearch called by context menu on FORM
	
						let formdata = getFormData();

						browser.runtime.sendMessage({action: "dataToSearchEngine", formdata: formdata}).then( result => {
							
							// use supplied search engine or get from focused form
							let se = message.searchEngine || result.searchEngines[0];
							
							if (!se.template && !message.timeout) {
								
								let input = window.document.querySelector("input:focus,textarea:focus");
								
								function inputHandler() {
									if (!input.value) return;
									browser.runtime.sendMessage({action: "executeTestSearch", searchTerms: input.value, badSearchEngine: se});
								}

								// capture ENTER event in case form executes before 'change' event
								input.addEventListener('keypress', e => {
									if ( e.key !== "Enter" ) return;
									if (!input.value) return;
									
									// remove the change handler to prevent duplicate test search
									input.removeEventListener('change', inputHandler);
									
									browser.runtime.sendMessage({action: "executeTestSearch", searchTerms: input.value, badSearchEngine: se});
								});
								
								// input change likely means search performed
								input.addEventListener('change', inputHandler);

								iframe.contentWindow.postMessage({action: "promptToSearch"}, browser.runtime.getURL('/customSearch.html'));
								
							} else {
								iframe.contentWindow.postMessage({searchEngine: se, openSearchUrl: os_href, location: window.location.href}, browser.runtime.getURL('/customSearch.html'));
							}
						});
					}
					
				}, {once: true});

				return true;
				break;
			
			case "closeCustomSearch":
				var iframe = getShadowRoot().getElementById("CS_customSearchIframe");
				iframe.style.opacity = 0;

				document.body.classList.remove('CS_blur');
				
				// remove after transition effect completes
				setTimeout(() => iframe.parentNode.removeChild(iframe), 250);
				
				break;
				
		}
	}
});

function getFormData() {
	// From BurningMoth AddSearch by Spencer T Obremski
	// https://addons.mozilla.org/en-US/firefox/addon/burning-moth-add-search/

	var S = {
		name: "",
		action: "",
		params: {},
		method: "GET",
		origin: window.location.origin,
		description: "",
		characterSet: document.characterSet,
		title: document.title || window.location.hostname
	};

	// Check for OpenSearch plugin
	S.openSearchHref = "";
	let osLink = document.querySelector('link[type="application/opensearchdescription+xml"]')
	if (osLink !== null) S.openSearchHref = osLink.href || "";

	// Look for favicons
	let favicon_link = document.querySelector('link[rel="icon"]') 
		|| document.querySelector('link[rel="shortcut icon"]') 
		|| document.querySelector('link[rel="apple-touch-icon"]');
		
	S.favicon_href = "";	
	if (favicon_link !== null) S.favicon_href = favicon_link.href || "";

	S.href = window.location.href;

	var E = window.document.querySelector("input:focus");

	// query parameter has name & form? ...
	if ( E && E.name && E.form ) {

		// search form data ...
		S.method = E.form.method.toUpperCase();
		S.action = E.form.action;

		// query parameter ...
		S.query = E.name;

		// get additional parameters ...
		S.params = {};
		Object.values( E.form.elements ).forEach(function( el ){

			if (
				el.name
				&& el.name != S.query
				&& el.value
			) switch ( el.type ) {
				case 'radio':
				case 'checkbox':
					if ( el.checked ) S.params[ el.name ] = el.value;
					break;

				default:
					S.params[ el.name ] = el.value;
					break;
			}

		});

	}
	
	// get/set name ...
	var M = window.document.querySelector('meta[property="og:site_name"]');
	S.name = M ? M.content || window.location.hostname : window.location.hostname;

	// get description ...
	M = window.document.querySelector('meta[property="og:description"], meta[name="description"]');
	S.description = M ? M.content : document.title || window.location.hostname; // use title if no description

	return S;
}