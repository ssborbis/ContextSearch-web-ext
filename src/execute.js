

function post(path, params) {

	let url = new URL(path);
	url.protocol = window.location.protocol;
		
	var form = document.createElement("form");
	form.setAttribute("method", "POST");
	form.setAttribute("action", replaceOpenSearchParams({template: url.href, searchterms: _SEARCHTERMS}));

	for (let param of params) {
		var hiddenField = document.createElement("input");
		
		hiddenField.setAttribute("type", "hidden");
		hiddenField.setAttribute("name", param.name);
		hiddenField.setAttribute("value", replaceOpenSearchParams({template: param.value, searchterms: _SEARCHTERMS}));

		form.appendChild(hiddenField);
	}
	
	// prevent early execution before body loads
	let bodyInterval = setInterval( () => {
		if (document.body === null || document.body === undefined) return;

		clearInterval(bodyInterval);
		document.body.appendChild(form);

		document.createElement('form').submit.call(form); // fix for name="submit" forms ( form.submit() is not a function )
	}, 100 );
}

if (typeof CONTEXTSEARCH_TEMP_ENGINE !== "undefined") {// using a temp engine
	post(CONTEXTSEARCH_TEMP_ENGINE.template, CONTEXTSEARCH_TEMP_ENGINE.params);
}
else {	
	browser.runtime.sendMessage({action: "getSearchEngineById", id: _ID}).then( message => {
		var se = message.searchEngine;
		post(se.template, se.params);
	});
}

