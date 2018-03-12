function post(path, params, method) {
	
	method = method || "POST";
		
	var form = document.createElement("form");
	form.setAttribute("method", method);
	form.setAttribute("action", replaceOpenSearchParams(path, _SEARCHTERMS));

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

browser.runtime.sendMessage({action: "getUserOptions", noLoad: true}).then((message) => {
	var searchEngines = message.userOptions.searchEngines;
	post(searchEngines[_INDEX].template, searchEngines[_INDEX].params);
});
