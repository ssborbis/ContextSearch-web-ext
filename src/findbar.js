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

	let sb = document.getElementById('searchBar');
	let counter = document.getElementById('mark_counter');
	
	if ( e.data.searchTerms ) sb.value = e.data.searchTerms;
	counter.innerText = e.data.index + 1 + ' of ' + e.data.total + ' matches';

});

document.getElementById('next').addEventListener('click', (e) => {
	window.parent.postMessage({action: "next"}, "*");
});

document.getElementById('previous').addEventListener('click', (e) => {
	window.parent.postMessage({action: "previous"}, "*");
});

document.getElementById('searchBar').addEventListener('change', (e) => {
	window.parent.postMessage({action: "mark", searchTerms:e.target.value}, "*");
});

document.getElementById('close').addEventListener('click', (e) => {
	window.parent.postMessage({action: "close"}, "*");
});
		