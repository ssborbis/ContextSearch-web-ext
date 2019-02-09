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

	if ( e.data.accuracy ) document.querySelector('#accuracy').checked = ( e.data.accuracy === "exactly" );
	if ( e.data.ignorePunctuation ) document.querySelector('#ignorePunctuation').checked = ( e.data.ignorePunctuation && e.data.ignorePunctuation !== [] ) 
	if ( e.data.caseSensitive ) document.querySelector('#caseSensitive').checked = e.data.caseSensitive;
	if ( e.data.separateWordSearch ) document.querySelector('#separateWordSearch').checked = e.data.separateWordSearch;
	if ( e.data.navbar ) document.querySelector('#toggle_navbar').checked = e.data.navbar;
	if ( e.data.total ) document.querySelector('#toggle_marks').checked = ( e.data.total > 0 );

	browser.runtime.sendMessage({action: "findBarUpdateOptions", markOptions: {
		accuracy: document.querySelector('#accuracy').checked ? "exactly" : "partially",
		caseSensitive: document.querySelector('#caseSensitive').checked,
		ignorePunctuation: document.querySelector('#ignorePunctuation').checked,
		separateWordSearch: document.querySelector('#separateWordSearch').checked
	}});	
	
	document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [e.data.index + 1, e.data.total]);
	
	document.querySelectorAll('INPUT[type="checkbox"]').forEach( el => {
		el.disabled = false;
	});

});

document.getElementById('next').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarNext", searchTerms: e.target.value});
});

document.getElementById('previous').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarPrevious"});
});


getSearchBar().addEventListener('type', (e) => {

	if ( e.target.value ) {
		browser.runtime.sendMessage({
			action: "mark", 
			searchTerms: e.target.value, 
			findBarSearch:true, 
			accuracy: document.querySelector('#accuracy').checked ? "exactly" : "partially",
			caseSensitive: document.querySelector('#caseSensitive').checked,
			ignorePunctuation: document.querySelector('#ignorePunctuation').checked,
			separateWordSearch: document.querySelector('#separateWordSearch').checked
		});
		
		document.querySelectorAll('INPUT[type="checkbox"]').forEach( el => {
			el.disabled = true;
		});
	}
	else {
		browser.runtime.sendMessage({action: "unmark"});
		document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
	}
});

window.addEventListener('keydown', (e) => {
	
	if ( e.which === 27 ) {
		browser.runtime.sendMessage({action: "unmark"});
		browser.runtime.sendMessage({action: "closeFindBar"});
		return;
	}
	
	if ( [13,40].includes(e.which) ) {
		browser.runtime.sendMessage({action: "findBarNext"});
		return;
	} else if ( [38].includes(e.which) ) {
		browser.runtime.sendMessage({action: "findBarPrevious"});
		return;
	}
	
	if (
		!userOptions.highLight.findBar.hotKey.length
		|| e.repeat
		|| !userOptions.highLight.findBar.hotKey.includes(e.keyCode)
	) return;

	for (let i in userOptions.highLight.findBar.hotKey) {
		let key = userOptions.highLight.findBar.hotKey[i];
		if (key === 16 && !e.shiftKey) return;
		if (key === 17 && !e.ctrlKey) return;
		if (key === 18 && !e.altKey) return;
		if (![16,17,18,e.keyCode].includes(key)) return;
	}

	e.preventDefault();
	
	browser.runtime.sendMessage({action: "closeFindBar"});
	
});

getSearchBar().addEventListener('keypress', (e) => {
	
	if ( !e.target.value ) return;
	
	// prevent some closing weirdness
	if (e.which === 27 ) return;

	if ( userOptions.highLight.findBar.keyboardTimeout === 0 ) return;
	clearTimeout(typeTimer);
	
	typeTimer = setTimeout(() => {
		getSearchBar().dispatchEvent(new CustomEvent('type'));
		typeTimer = null;
	}, userOptions.highLight.findBar.keyboardTimeout);
		
});

document.getElementById('close').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "closeFindBar"});
	browser.runtime.sendMessage({action: "unmark"});
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
		getSearchBar().dispatchEvent(new CustomEvent('type'));
	});
});

document.querySelector('#toggle_marks').addEventListener('change', (e) => {
	if ( e.target.checked )
		getSearchBar().dispatchEvent(new CustomEvent('type'));
	else
		browser.runtime.sendMessage({action: "unmark", saveTabHighlighting: true});
});

document.querySelector('#toggle_navbar').addEventListener('change', (e) => {
	browser.runtime.sendMessage({action: "toggleNavBar", state: e.target.checked});
});
