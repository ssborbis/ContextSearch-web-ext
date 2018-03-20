if (document.getElementById('options_a'))
	document.getElementById('options_a').addEventListener('click',openOptions);
		
function openOptions() {
	browser.runtime.sendMessage({action: "openOptions"});
}

if (document.getElementById('version'))
	document.getElementById('version').innerText = browser.runtime.getManifest().version;