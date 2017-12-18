document.getElementById('options_a').addEventListener('click',openOptions);
		
function openOptions() {
	browser.runtime.sendMessage({action: "openOptions"});
}

document.getElementById('version').innerText = browser.runtime.getManifest().version;