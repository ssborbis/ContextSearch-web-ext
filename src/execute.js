

function post(path, params) {

	let url = new URL(path);
	url.protocol = window.location.protocol;
		
	var form = document.createElement("form");
	form.setAttribute("method", "POST");
	form.setAttribute("action", replaceOpenSearchParams(url.href, _SEARCHTERMS));

	for (let param of params) {
		var hiddenField = document.createElement("input");
		
		hiddenField.setAttribute("type", "hidden");
		hiddenField.setAttribute("name", param.name);
		hiddenField.setAttribute("value", replaceOpenSearchParams(param.value, _SEARCHTERMS));

		form.appendChild(hiddenField);
	}
	
	if (document.body === null || document.body === undefined)
		document.body = document.createElement('body');

	document.body.appendChild(form);
	form.submit();
}

if (typeof CONTEXTSEARCH_TEMP_ENGINE !== "undefined") // using a temp engine
	post(CONTEXTSEARCH_TEMP_ENGINE.template, CONTEXTSEARCH_TEMP_ENGINE.params);
else {	
	browser.runtime.sendMessage({action: "getSearchEngineById", id: _ID}).then((message) => {
		var se = message.searchEngine;
		post(se.template, se.params);
	});
}

