function getSearchBar() { return document.getElementById('searchBar') }

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

	if ( e.data.searchTerms ) getSearchBar().value = e.data.searchTerms;
	
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
		browser.runtime.sendMessage({action: "mark", searchTerms: e.target.value});
	else {
		browser.runtime.sendMessage({action: "unmark"});
		document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
	}
});

getSearchBar().addEventListener('keypress', (e) => {
	
	if ( e.which !== 13 ) return;
	
	if ( e.target.value )
		browser.runtime.sendMessage({action: "findBarNext"});
});

document.getElementById('close').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "closeFindBar"});
});

window.addEventListener('keydown', (e) => {
	
	if ( e.which === 27 ) {
		browser.runtime.sendMessage({action: "closeFindBar"});
		browser.runtime.sendMessage({action: "unmark"});
	}
});

document.addEventListener('DOMContentLoaded', (e) => {
	document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
});