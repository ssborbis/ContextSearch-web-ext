window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

function post(path, params) {
	
	let url = new URL(path);
	url.protocol = window.location.protocol;
		
	var form = document.createElement("form");
	form.setAttribute("method", "POST");
	form.setAttribute("action", replaceOpenSearchParams(url.href, _SEARCHTERMS));

	for (var i=0;i<params.length;i++) {
		var hiddenField = document.createElement("input");
		
		hiddenField.setAttribute("type", "hidden");
		hiddenField.setAttribute("name", params[i].name);
		hiddenField.setAttribute("value", replaceOpenSearchParams(params[i].value, _SEARCHTERMS));

		form.appendChild(hiddenField);
	}
	
	if (document.body === null || document.body === undefined)
		document.body = document.createElement('body');

	document.body.appendChild(form);
	form.submit();
}

if (_INDEX === -1) // using a temp engine
	post(_TEMP.template, _TEMP.params);
else {
	browser.runtime.sendMessage({action: "getSearchEngineByIndex", index: _INDEX}).then((message) => {
		var se = message.searchEngine;
		post(se.template, se.params);
	});
}
