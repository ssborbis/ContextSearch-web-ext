var userOptions;

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
		
	let input = document.getElementById('quickmenusearchbar');
	input.placeholder = browser.i18n.getMessage('Search');

	let qm = document.createElement('div');
	qm.id = 'quickMenuElement';

	for (let i=0;i<userOptions.searchEngines.length;i++) {
		
		let se = userOptions.searchEngines[i];
		
		let div = document.createElement('div');
		div.style.backgroundImage = "url(" + se.icon_base64String || se.icon_url + ")";
//		div.style.backgroundSize = 16 * userOptions.quickMenuIconScale + "px";
		div.index = i;
		div.title = se.title;
		
		div.onclick = function() {
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: div.index,
					selectionText: input.value,//quickMenuObject.searchTerms,
					openMethod: "openNewTab"
				}
			});
		};
		
		div.onmouseenter = function() {
			document.getElementById('searchEngineTitle').innerText = se.title;
		}
		div.onmouseleave = function() {
			document.getElementById('searchEngineTitle').innerText = ' ';
		}
		qm.appendChild(div);
		
		if ( (i + 1) % userOptions.quickMenuColumns === 0) {
			let br = document.createElement('br');
			qm.appendChild(br);
		}
	}
	
	document.body.appendChild(qm);
	
	let div = document.createElement('div');
	div.style = 'text-align:center;border-top:1px solid #e0e0e0';
	div.className = 'hover';
	let img = document.createElement('img');
	img.src = "/icons/settings.png";
	img.style.height = '16px';
	img.style.padding = '8px';

	img.onclick = function() {	
		location.href = browser.runtime.getURL('/options.html#browser_action');
	}
	
	document.getElementById('searchEngineTitle').style.width = parseFloat(window.getComputedStyle(qm).width) - 10 + "px";
	
	div.appendChild(img);

	document.body.appendChild(div);
	input.focus();

});