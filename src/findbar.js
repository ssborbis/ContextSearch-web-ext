function getSearchBar() { return document.getElementById('searchBar') }

var userOptions = {};

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.quickMenuTheme === 'dark' ) 
		document.querySelector('#dark').rel="stylesheet";
	
	document.body.dataset.theme = userOptions.quickMenuTheme;
	// document.querySelector('#accuracy').dataset.accuracy =  userOptions.highLight.markOptions.accuracy;
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
		browser.runtime.sendMessage({action: "mark", searchTerms: e.target.value, findBarSearch:true});
	else {
		browser.runtime.sendMessage({action: "unmark"});
		document.getElementById('mark_counter').innerText = browser.i18n.getMessage("FindBarNavMessage", [0, 0]);
	}
});

getSearchBar().addEventListener('keydown', (e) => {
	
	if ( !e.target.value ) return;
	
	if ( [13,40].includes(e.which) )
		browser.runtime.sendMessage({action: "findBarNext"});
	else if ( [38].includes(e.which) )
		browser.runtime.sendMessage({action: "findBarPrevious"});
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

// document.querySelector('#accuracy').addEventListener('click', (e) => {
	// this.dataset.accuracy = ( this.dataset.accuracy === 'exactly' ) ? 'partially' : 'exactly';
// });