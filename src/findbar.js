function getSearchBar() { return document.getElementById('searchBar') }

var userOptions = {};
var typeTimer = null;

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.quickMenuTheme === 'dark' ) 
		document.querySelector('#dark').rel="stylesheet";
	
	document.body.dataset.theme = userOptions.quickMenuTheme;
});

document.addEventListener('DOMContentLoaded', (e) => {
	getSearchBar().focus();
});

window.addEventListener("message", (e) => {

	if ( !typeTimer ) // do not update value if typing in find bar
		getSearchBar().value = e.data.searchTerms || getSearchBar().value || "";	

	if ( e.data.accuracy ) document.querySelector('#accuracy').checked = e.data.accuracy === "exactly" ? true : false;
	document.querySelector('#ignorePunctuation').checked = e.data.ignorePunctuation && e.data.ignorePunctuation.length || document.querySelector('#ignorePunctuation').checked;
	document.querySelector('#caseSensitive').checked = e.data.caseSensitive || document.querySelector('#caseSensitive').checked;
	document.querySelector('#separateWordSearch').checked = e.data.separateWordSearch || document.querySelector('#separateWordSearch').checked;

	browser.runtime.sendMessage({action: "findBarUpdateOptions", markOptions: {
		accuracy: document.querySelector('#accuracy').checked ? "exactly" : "partially",
		caseSensitive: document.querySelector('#caseSensitive').checked,
		ignorePunctuation: document.querySelector('#ignorePunctuation').checked,
		separateWordSearch: document.querySelector('#separateWordSearch').checked
	}});	
	
	document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [e.data.index + 1, e.data.total]);

});

document.getElementById('next').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarNext", searchTerms: e.target.value});
});

document.getElementById('previous').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarPrevious"});
});

getSearchBar().addEventListener('change', (e) => {
	
	if ( e.target.value )
		browser.runtime.sendMessage({
			action: "mark", 
			searchTerms: e.target.value, 
			findBarSearch:true, 
			accuracy: document.querySelector('#accuracy').checked ? "exactly" : "partially",
			caseSensitive: document.querySelector('#caseSensitive').checked,
			ignorePunctuation: document.querySelector('#ignorePunctuation').checked,
			separateWordSearch: document.querySelector('#separateWordSearch').checked
		});
	else {
		browser.runtime.sendMessage({action: "unmark"});
		document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
	}
});

window.addEventListener('keydown', (e) => {
	
	if ( e.which === 27 ) {
		browser.runtime.sendMessage({action: "closeFindBar"});
	}
});

getSearchBar().addEventListener('keydown', (e) => {
	
	if ( !e.target.value ) return;
	
	// prevent some closing weirdness
	if (e.which === 27 ) return;
	
	if ( [13,40].includes(e.which) )
		browser.runtime.sendMessage({action: "findBarNext"});
	else if ( [38].includes(e.which) )
		browser.runtime.sendMessage({action: "findBarPrevious"});
	else {
		
		if ( userOptions.highLight.findBar.keyboardTimeout === 0 ) return;
		clearTimeout(typeTimer);
		
		typeTimer = setTimeout(() => {
			var evt = document.createEvent("HTMLEvents");
			evt.initEvent("change", false, true);
			getSearchBar().dispatchEvent(evt);
		}, userOptions.highLight.findBar.keyboardTimeout);
	}
		
});

document.getElementById('close').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "closeFindBar"});
});


document.addEventListener('DOMContentLoaded', (e) => {
	document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
	document.querySelector('#accuracy + LABEL').title = browser.i18n.getMessage('accuracy') || "Accuracy";
	document.querySelector('#caseSensitive + LABEL').title = browser.i18n.getMessage('casesensitive') || "Case Sensitive";
	document.querySelector('#ignorePunctuation + LABEL').title = browser.i18n.getMessage('ignorepunctuation') || "Ignore Punctuation";
	document.querySelector('#separateWordSearch + LABEL').title = browser.i18n.getMessage('separateWordSearch') || "Separate Word Search";
});

document.querySelectorAll('#accuracy,#caseSensitive,#ignorePunctuation,#separateWordSearch').forEach( el => {
	el.addEventListener('click', (e) => {
		getSearchBar().dispatchEvent(new Event('change'));
	});
});