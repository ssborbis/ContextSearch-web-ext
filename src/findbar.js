window.addEventListener("message", (e) => {
	
	console.log(e.data);

	let sb = document.getElementById('searchbar');
	let counter = document.getElementById('mark_counter');
	
	if ( e.data.searchTerms ) sb.value = e.data.searchTerms;
	counter.innerText = e.data.index + 1 + ' of ' + e.data.total;

});

document.getElementById('next').addEventListener('click', (e) => {
	window.parent.postMessage({action: "next"}, "*");
});

document.getElementById('previous').addEventListener('click', (e) => {
	window.parent.postMessage({action: "previous"}, "*");
});

document.getElementById('searchbar').addEventListener('change', (e) => {
	window.parent.postMessage({action: "mark", searchTerms:e.target.value}, "*");
});