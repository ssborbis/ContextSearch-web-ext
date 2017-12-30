function post(path, params, method) {
	
	method = method || "post"; 
	
	var form = document.createElement("form");
	form.setAttribute("method", method);
	form.setAttribute("action", path);

	for (var i=0;i<params.length;i++) {
		var hiddenField = document.createElement("input");
		
		hiddenField.setAttribute("type", "hidden");
		hiddenField.setAttribute("name", params[i].name);
		hiddenField.setAttribute("value", replaceOpenSearchParams(params[i].value, _SEARCHTERMS));

		form.appendChild(hiddenField);
	}

	document.body.appendChild(form);
	form.submit();
}

if (document.body === null)
	document.body = document.createElement('body');

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	var searchEngines = message.userOptions.searchEngines;
	post(searchEngines[_INDEX].template, searchEngines[_INDEX].params);
});
