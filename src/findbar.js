browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
	
	if ( userOptions.quickMenuTheme === 'dark' ) 
		document.querySelector('#dark').rel="stylesheet";
	
	document.body.dataset.theme = userOptions.quickMenuTheme;
});

document.addEventListener('DOMContentLoaded', (e) => {
	document.getElementById('searchBar').focus();
});

document.addEventListener('DOMContentLoaded', (e) => {
	document.getElementById('searchBar').focus();
});

window.addEventListener("message", (e) => {

	let sb = document.getElementById('searchBar');
	let counter = document.getElementById('mark_counter');
	
	if ( e.data.searchTerms ) sb.value = e.data.searchTerms;
	
	counter.innerText = browser.i18n.getMessage("FindBarNavMessage", [e.data.index + 1, e.data.total]);

});

document.getElementById('next').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarNext", searchTerms: e.target.value});
});

document.getElementById('previous').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarPrevious"});
});

document.getElementById('searchBar').addEventListener('change', (e) => {
	browser.runtime.sendMessage({action: "mark", searchTerms: e.target.value});
});

document.getElementById('searchBar').addEventListener('keypress', (e) => {
	
	if ( e.which === 13 )
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