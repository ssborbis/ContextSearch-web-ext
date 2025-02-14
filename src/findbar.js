var getSearchBar = () => document.getElementById('searchBar');

var userOptions = {};
var typeTimer = null;

sendMessage({action: "getUserOptions"}).then( uo => {
	userOptions = uo;

	setTheme().then(() => {
		// unhide the findbar after theme is set to prevent flashing
		sendMessage({action: "executeScript", code: "showFindBar();"});
	});
	
	document.querySelector('#toggle_searchalltabs').checked = userOptions.highLight.findBar.searchInAllTabs;
});

document.addEventListener('DOMContentLoaded', e => {
	getSearchBar().oldValue = getSearchBar().value || "";
});

function buildMarkOptions() {
	return {
		accuracy: document.querySelector('#accuracy').checked ? "exactly" : "partially",
		caseSensitive: document.querySelector('#caseSensitive').checked,
		ignorePunctuation: document.querySelector('#ignorePunctuation').checked,
		separateWordSearch: document.querySelector('#separateWordSearch').checked,
		limit: userOptions.highLight ? userOptions.highLight.findBar.markOptions.limit : 0
	};
}

window.addEventListener("message", e => {

	if ( !typeTimer ) // do not update value if typing in find bar
		getSearchBar().value = e.data.searchTerms || getSearchBar().value || "";
		
	getSearchBar().oldValue = getSearchBar().value || "";

	if ( typeof e.data.accuracy !== "undefined" ) document.querySelector('#accuracy').checked = ( e.data.accuracy === "exactly" );
	if ( typeof e.data.ignorePunctuation !== "undefined" ) document.querySelector('#ignorePunctuation').checked = e.data.ignorePunctuation;
	if ( typeof e.data.caseSensitive !== "undefined" ) document.querySelector('#caseSensitive').checked = e.data.caseSensitive;
	if ( typeof e.data.separateWordSearch !== "undefined" ) document.querySelector('#separateWordSearch').checked = e.data.separateWordSearch;
	if ( typeof e.data.navbar !== "undefined" ) document.querySelector('#toggle_navbar').checked = e.data.navbar;
	if ( typeof e.data.total !== "undefined" ) document.querySelector('#toggle_marks').checked = ( e.data.total > 0 );

	sendMessage({action: "findBarUpdateOptions", markOptions: buildMarkOptions()});	
	
	document.getElementById('mark_counter').innerText = i18n("FindBarNavMessage", [e.data.index + 1, e.data.total]);
	
	document.querySelectorAll('INPUT[type="checkbox"]').forEach( el => {
		el.disabled = false;
	});
	
	// only if opening by hotkey, select all text
	if ( e.data.hotkey )
		getSearchBar().select();
	
	// only focus after marking - prevents focus with opening on pageload option
	if ( e.data.action === "markDone" ) {
		getSearchBar().focus();
		document.querySelector("#searchIcon").src = browser.runtime.getURL('icons/search.svg');
	}
});

document.getElementById('next').addEventListener('click', e => {
	sendMessage({action: "findBarNext", searchTerms: e.target.value});
});

document.getElementById('previous').addEventListener('click', e => {
	sendMessage({action: "findBarPrevious"});
});

getSearchBar().addEventListener('change', e => {

	e.target.oldValue = e.target.value;
	
	document.querySelector("#searchIcon").src = browser.runtime.getURL('icons/spinner.svg');

	if ( e.target.value ) {
		sendMessage(Object.assign({
			action: "mark", 
			searchTerms: e.target.value, 
			findBarSearch: e.detail ? false : true // detail = true - skip jump to first match
		}, buildMarkOptions()));
		
		document.querySelectorAll('INPUT[type="checkbox"]').forEach( el => {
			el.disabled = true;
		});
	}
	else {
		sendMessage({action: "unmark", clearFindBarLastSearchTerms: true});
		document.getElementById('mark_counter').innerText = i18n("FindBarNavMessage", [0, 0]);
	}
});

window.addEventListener('keydown', async e => {
	
	if ( e.key === "Escape" ) {
		await sendMessage({action: "unmark"});
		await sendMessage({action: "closeFindBar"});
		return;
	}
	
	if ( e.key === "ArrowDown" ) {
		sendMessage({action: "findBarNext"});
		return;
	} else if ( e.key === "ArrowUp" ) {
		sendMessage({action: "findBarPrevious"});
		return;
	}
	
});

getSearchBar().addEventListener('keypress', e => {
	
	if ( !e.target.value ) return;
	
	// prevent some closing weirdness
	if (e.key === "Escape" ) return;
	
	if ( e.key === "Enter" ) {
		if ( e.target.value !== e.target.oldValue )
			getSearchBar().dispatchEvent(new Event('change'));
		else
			sendMessage({action: "findBarNext"});
		return;
	}

	if ( userOptions.highLight.findBar.keyboardTimeout === 0 || userOptions.highLight.findBar.searchInAllTabs ) return;
	clearTimeout(typeTimer);
	
	typeTimer = setTimeout(() => {
		getSearchBar().dispatchEvent(new Event('change'));
		typeTimer = null;
	}, userOptions.highLight.findBar.keyboardTimeout);
		
});

document.getElementById('close').addEventListener('click', e => {
	sendMessage({action: "closeFindBar"});
	sendMessage({action: "unmark"});
});

document.addEventListener('DOMContentLoaded', e => {
	document.getElementById('mark_counter').innerText = i18n("FindBarNavMessage", [0, 0]);
	document.querySelector('#accuracy + LABEL').title = i18n('accuracy') || "Accuracy";
	document.querySelector('#caseSensitive + LABEL').title = i18n('casesensitive') || "Case Sensitive";
	document.querySelector('#ignorePunctuation + LABEL').title = i18n('ignorepunctuation') || "Ignore Punctuation";
	document.querySelector('#separateWordSearch + LABEL').title = i18n('separateWordSearch') || "Separate Word Search";
	document.querySelector('#toggle_navbar + LABEL').title = i18n('Navbar');
	document.querySelector('#toggle_marks + LABEL').title = i18n('highlight');
	document.querySelector('#toggle_searchalltabs + LABEL').title = i18n('searchalltabs') || "Search all tabs";
	document.querySelector('#clearSearchBarButton').title = i18n('delete') || "delete";
});

document.querySelectorAll('#accuracy,#caseSensitive,#ignorePunctuation,#separateWordSearch').forEach( el => {
	el.addEventListener('click', e => {
		getSearchBar().dispatchEvent(new Event('change'));
	//	sendMessage({action: "findBarUpdateOptions", markOptions: buildMarkOptions()});	// infinite loop 100% cpu
	});
});

document.querySelector('#toggle_marks').addEventListener('change', e => {
	if ( e.target.checked )
		getSearchBar().dispatchEvent(new CustomEvent('change', {detail: true})); // detail = true means set findBarSearch = false to skip jump to first match
	else
		sendMessage({action: "unmark", saveTabHighlighting: true});
});

document.querySelector('#toggle_navbar').addEventListener('change', e => {
	sendMessage({action: "toggleNavBar", state: e.target.checked});
});

document.querySelector('#toggle_searchalltabs').addEventListener('change', e => {
	
	// update the object before saving - this frame does not update userOptions automatically
	sendMessage({action: "getUserOptions"}).then( uo => {
		userOptions = uo;
		userOptions.highLight.findBar.searchInAllTabs = e.target.checked;
		sendMessage({action: "saveUserOptions", userOptions: userOptions, source: "findbar.js searchalltabs"});
		
		// search all tabs if button enabled and searchbar has text
		if ( userOptions.highLight.findBar.searchInAllTabs && getSearchBar().value )
			getSearchBar().dispatchEvent(new Event('change'));
	});
});

document.getElementById('clearSearchBarButton').addEventListener('click', e => {
	getSearchBar().value = null;
	getSearchBar().dispatchEvent(new Event('change'));
	getSearchBar().focus();
});

//addChildDockingListeners(document.getElementById('handle'), "findBar");
addChildDockingListeners(document.body, "findBar", "#searchBar, LABEL, .tool:not(#handle)");

Shortcut.addShortcutListener();
