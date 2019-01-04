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

window.addEventListener("message", (e) => {
	
//	console.log(e.data);

	let sb = document.getElementById('searchBar');
	let counter = document.getElementById('mark_counter');
	
	if ( e.data.searchTerms ) sb.value = e.data.searchTerms;
	counter.innerText = e.data.index + 1 + ' of ' + e.data.total + ' matches';

});

document.getElementById('next').addEventListener('click', (e) => {
	console.log('next');
	browser.runtime.sendMessage({action: "findBarNext", searchTerms: e.target.value});
});

document.getElementById('previous').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "findBarPrevious", searchTerms: e.target.value});
});

document.getElementById('searchBar').addEventListener('change', (e) => {
	browser.runtime.sendMessage({action: "mark", searchTerms: e.target.value});
});

document.getElementById('close').addEventListener('click', (e) => {
	browser.runtime.sendMessage({action: "closeFindBar"});
});