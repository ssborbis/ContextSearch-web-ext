// array for storage.local
var searchEngines = [];
var userOptions = {};

let button = document.getElementById("selectMozlz4FileButton");
button.onchange = (ev) => {
	searchEngines = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		searchEngines = searchEngineObjectToArray(engines);

		document.getElementById('status_div').style.display='';
		statusMessage({
			img: "icons/spinner.svg",
			msg: "Loading remote content"
		});
		
		loadRemoteIcons({
			searchEngines: searchEngines,
			callback: (details) => {
				searchEngines = details.searchEngines;
				saveOptions();
				
				if (details.hasFailedCount) {
					statusMessage({
						img: "icons/alert.png",
						msg: "Failed to load " + details.hasFailedCount + " icon(s). This can occur when Tracking Protection is enabled"
					});
				} else {
					statusMessage({
						img: "icons/yes.png",
						msg: "Success!  Loaded " + searchEngines.length + " search engines"
					});
				}
					
				if (window.location.href.match(/#quickload$/) !== null) {
					browser.runtime.sendMessage({action: "closeWindowRequest"});
				}
				
				document.getElementById('searchEngineWarningDivContainer').style.display = "none";
				var el = document.getElementById('searchEngineWarningDiv');
				el.innerText = "";
				
				for (let i=0;i<searchEngines.length;i++) {
					if (searchEngines[i].queryCharset.toLowerCase() !== "utf-8") {
						document.getElementById('searchEngineWarningDivContainer').style.display = "inline-block";
						var p = document.createElement('p');
						p.style.marginLeft = "20px";
						p.innerText = "\u2022 " + searchEngines[i].title + " (" + searchEngines[i].queryCharset + ")";
						el.appendChild(p);
					}
				}
			}
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/no.png",
			msg: "Failed to load search engines :("
		});
	});
};

function statusMessage(status) {				
	document.getElementById('status_img').src = status.img || "";
	document.getElementById('status').innerText = status.msg || "";
}

function restoreOptions() {

	function onGot(result) {
		
		userOptions = result.userOptions || {};

		document.getElementById('cb_backgroundTabs').checked = userOptions.backgroundTabs;
		document.getElementById('cb_swapKeys').checked = userOptions.swapKeys;
		document.getElementById('cb_quickMenu').checked = userOptions.quickMenu;	
		document.getElementById('n_quickMenuColumns').value = userOptions.quickMenuColumns;
		document.getElementById('n_quickMenuItems').value = userOptions.quickMenuItems;	
		document.getElementById('b_quickMenuKey').value = userOptions.quickMenuKey;
		document.getElementById('b_quickMenuKey').innerText = keyTable[userOptions.quickMenuKey] || "Set";
		document.getElementById('r_quickMenuOnKey').checked = userOptions.quickMenuOnKey;
		document.getElementById('r_quickMenuOnMouse').checked = userOptions.quickMenuOnMouse;
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		document.getElementById('r_quickMenuOnClick').checked = userOptions.quickMenuOnClick;
		document.getElementById('range_quickMenuScale').value = userOptions.quickMenuScale;
		document.getElementById('i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		document.getElementById('n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		document.getElementById('n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;	
		document.getElementById('h_mouseButton').value = userOptions.quickMenuMouseButton;
		
		if (document.getElementById('h_mouseButton').value == 3)
			document.getElementById('img_rightMouseButton').style.opacity = 1;
		else if (document.getElementById('h_mouseButton').value == 1)
			document.getElementById('img_leftMouseButton').style.opacity = 1;
		
		document.getElementById('cb_contextMenu').checked = userOptions.contextMenu;
		document.getElementById('i_searchJsonPath').value = userOptions.searchJsonPath.replace("/search.json.mozlz4","");
		document.getElementById('h_position').value = userOptions.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.className = p.className.replace(' active', '');
			if (p.dataset.position === userOptions.quickMenuPosition)
				p.className+=' active';
		}
		
		buildToolIcons();
		
		// reload method radio buttons
		for (let el of document.getElementsByName('reloadMethod')) {
			if (el.value === userOptions.reloadMethod) {
				el.dispatchEvent(new MouseEvent('click'));
				break;
			}
		}
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.runtime.sendMessage({action: "getUserOptions"});
	getting.then(onGot, onError);
	
}

function saveOptions(e) {

	function onSet() {
		browser.runtime.sendMessage({action: "updateUserOptions", "userOptions": userOptions}).then(() => {
			if (e && e.target.id === "i_searchJsonPath") {
				browser.storage.local.set({'searchObject_last_mod': ''}).then(()=> {
					let gettingPage = browser.runtime.getBackgroundPage().then((w) => {
						w.nativeApp();
					});
				});
			}
		});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	userOptions = {
		searchEngines: (searchEngines.length > 0) ? searchEngines : userOptions.searchEngines,
		backgroundTabs: document.getElementById('cb_backgroundTabs').checked,
		swapKeys: document.getElementById('cb_swapKeys').checked,
		quickMenu: document.getElementById('cb_quickMenu').checked,
		quickMenuColumns: parseInt(document.getElementById('n_quickMenuColumns').value),
		quickMenuItems: parseInt(document.getElementById('n_quickMenuItems').value),
		quickMenuKey: parseInt(document.getElementById('b_quickMenuKey').value),
		quickMenuOnKey: document.getElementById('r_quickMenuOnKey').checked,
		quickMenuOnMouse: document.getElementById('r_quickMenuOnMouse').checked,
		quickMenuMouseButton: parseInt(document.getElementById('h_mouseButton').value),
		quickMenuAuto: document.getElementById('r_quickMenuAuto').checked,
		quickMenuOnClick: document.getElementById('r_quickMenuOnClick').checked,
		quickMenuScale: parseFloat(document.getElementById('range_quickMenuScale').value),
		quickMenuOffset: {x: parseInt(document.getElementById('n_quickMenuOffsetX').value), y: parseInt(document.getElementById('n_quickMenuOffsetY').value)},
		quickMenuPosition: document.getElementById('h_position').value,
		contextMenu: document.getElementById('cb_contextMenu').checked,
		searchJsonPath: function () {
			let path = document.getElementById('i_searchJsonPath').value;
			if (path.match(/\/search.json.mozlz4$/) === null && path != "")
				path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
			return path;
		}(),
		quickMenuTools: function() {
			let tools = [];
			for (let toolIcon of document.getElementsByClassName('toolIcon'))
				tools.push({"name": toolIcon.name, "disabled": toolIcon.disabled})			
			return tools;
		}(),
		reloadMethod: function() {
			for (let el of document.getElementsByName('reloadMethod')) {
				if (el.checked) return el.value;
			}
			return null;
		}()
	}

	var setting = browser.storage.local.set({"userOptions": userOptions});
	setting.then(onSet, onError);

}

function swapKeys(e) {
	document.getElementById('default_shift').innerText = (document.getElementById('cb_swapKeys').checked) ? "Ctrl" : "Shift";
	document.getElementById('default_ctrl').innerText = (document.getElementById('cb_swapKeys').checked) ? "Shift" : "Ctrl";
}

function changeButtons(e, button) {
	var el = e.target;
	document.getElementById('img_rightMouseButton').style.opacity = .4;
	document.getElementById('img_leftMouseButton').style.opacity = .4;
	el.style.opacity = 1;	
	document.getElementById('h_mouseButton').value = button;
	saveOptions(e);
}

document.addEventListener("DOMContentLoaded", makeTabs());
document.addEventListener("DOMContentLoaded", restoreOptions);

document.getElementById('cb_contextMenu').addEventListener('change', saveOptions);
document.getElementById('cb_backgroundTabs').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', swapKeys);
document.getElementById('cb_swapKeys').addEventListener('change', saveOptions);

document.getElementById('cb_quickMenu').addEventListener('change', (e) => {
	saveOptions(e);
});

document.getElementById('n_quickMenuColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 4, 1, 100);
	saveOptions(e);
});

document.getElementById('n_quickMenuItems').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 100, 1, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetX').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetY').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('r_quickMenuOnMouse').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnKey').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuAuto').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnClick').addEventListener('change', saveOptions);

document.getElementById('img_rightMouseButton').addEventListener('click', (ev) => {changeButtons(ev,3)});
document.getElementById('img_leftMouseButton').addEventListener('click', (ev) => {changeButtons(ev,1)});

document.getElementById('range_quickMenuScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});

document.getElementById('range_quickMenuScale').addEventListener('change', saveOptions);
document.getElementById('i_searchJsonPath').addEventListener('change', (ev) => {
	
	let el = document.getElementById('div_searchJsonPathResponse');
	
	el.innerText = "Validating ...";
	
	ev.target.value = ev.target.value.replace(/\\/g, "/").trim();
	if (ev.target.value == "") {
		el.innerText = "";
		return false;
	}
	
	let path = ev.target.value;
	
	if (path.match(/\/search.json.mozlz4$/) === null) {
		path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
	}
	
	console.log(path);
	
	function onResponse(response) {
		
		if (response.error) {
			el.innerText = response.error;
			el.style.color = 'red';
			return false;
		}
		
		el.innerText = "Success";
		el.style.color = 'blue';
		saveOptions(ev);		
	}
	
	function onError(error) {
		console.log(error);
		el.innerText = "Failed to load file (" + error.message + ") Is helper app installed?";
		el.style.color = 'red';
	}
	
	if (typeof browser.runtime.sendNativeMessage === 'function') {
		var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + path + '"}');
		sending.then(onResponse, onError);
	}
	
});
document.getElementById('b_quickMenuKey').addEventListener('click', (e) => {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	e.target.appendChild(img);
	e.target.addEventListener('keydown', function(evv) {
		evv.preventDefault();
		e.target.innerText = keyTable[evv.which];
		e.target.value = evv.which;
		saveOptions(e);
		}, {once: true} // parameter to run once, then delete
	); 
});

function fixNumberInput(el, _default, _min, _max) {

	if (isNaN(el.value) || el.value === "") el.value = _default;
	if (!el.value.isInteger) el.value = Math.floor(el.value);
	if (el.value > _max) el.value = _max;
	if (el.value < _min) el.value = _min;
}

// Modify Options for quickload popup
if (window.location.href.match(/#quickload$/) !== null) {

	for (let kid of document.body.children) 
		kid.style.display = 'none';
	
	var loadButton = document.getElementById('selectMozlz4FileButton');
	document.body.style.padding = "10px";
	document.body.appendChild(loadButton);
	document.title = "Reload Search Engines";
	
	loadButton.addEventListener('change', (ev) => {
		var img = document.createElement('img');
		img.src = 'icons/spinner.svg';
		img.style.height = '20px';
		img.style.width = '20px';
		document.body.appendChild(img);
	});
}

// Modify Options for BrowserAction
if (window.location.href.match(/#browser_action$/) !== null) {

	document.addEventListener("DOMContentLoaded", () => {
		let loadButton = document.getElementById("selectMozlz4FileButton");
		loadButton.onclick = (e) => {
			e.preventDefault();
			window.open('/options.html#quickload', 'Reload Search Engines', 'width=400,height=50,dependent=no,location=no,menubar=no,scrollbars=no,titlebar=no,status=no,toolbar=no');
		}
	});	
	
}

function makeTabs() {
	
	let tabs = document.getElementsByClassName("tablinks");
	for (let tab of tabs) {
		tab.addEventListener('click', (e) => {

			for (let tabcontent of document.getElementsByClassName("tabcontent"))
				tabcontent.style.display = "none";
			
			for (let _tab of tabs)
				_tab.getElementsByTagName('img')[0].style.display='none';
			
			e.target.getElementsByTagName('img')[0].className = 'fade-in';
			e.target.getElementsByTagName('img')[0].style.display='inline-block';
				
			// Get all elements with class="tablinks" and remove the class "active"
			for (let tablink of document.getElementsByClassName("tablinks")) 
				tablink.className = tablink.className.replace(" active", "");

			// Show the current tab, and add an "active" class to the button that opened the tab
			document.getElementById(e.target.dataset.tabid).style.display = "block";
			e.currentTarget.className += " active";
		});
	}
	tabs[0].click();
}

function buildToolIcons() {
	function getToolIconIndex(element) {
		 let index = 0;
		 let toolIcons = document.getElementsByClassName('toolIcon');
		 for (let i=0;i<toolIcons.length;i++) {
			 if (toolIcons[i] === element) {
				index = i;
				break;
			}
		 }
		 
		 return index;
	}
	function dragstart_handler(ev) {
		ev.currentTarget.style.border = "dashed transparent";
		ev.dataTransfer.setData("text", getToolIconIndex(ev.target));
		ev.effectAllowed = "copyMove";
	}
	function dragover_handler(ev) {
		for (let icon of document.getElementsByClassName('toolIcon'))
			icon.style.backgroundColor='';
		
		ev.target.style.backgroundColor='#ddd';
		ev.preventDefault();
	}
	function drop_handler(ev) {
		ev.preventDefault();
		
		ev.target.style.border = '';
		ev.target.style.backgroundColor = '';
		let old_index = ev.dataTransfer.getData("text");
		let new_index = getToolIconIndex(ev.target);

		if (new_index > old_index) 
			ev.target.parentNode.insertBefore(document.getElementsByClassName('toolIcon')[old_index],ev.target.nextSibling);
		else
			ev.target.parentNode.insertBefore(document.getElementsByClassName('toolIcon')[old_index],ev.target);
	}
	function dragend_handler(ev) {
		ev.target.style.border = '';
		saveOptions();
		ev.dataTransfer.clearData();
	}
	
	let toolIcons = [
		{name: 'close', src: "icons/close.png", title: "Close menu", index: Number.MAX_VALUE, disabled: false},
		{name: 'copy', src: "icons/clipboard.png", title: "Copy to clipboard", index: Number.MAX_VALUE, disabled: false},
		{name: 'link', src: "icons/link.png", title: "Open as link", index: Number.MAX_VALUE, disabled: false},
		{name: 'disable', src: "icons/power.png", title: "Disable menu", index: Number.MAX_VALUE, disabled: false}
	];
	
	for (let t=0;t<toolIcons.length;t++) {
		for (let i=0;i<userOptions.quickMenuTools.length;i++) {
			if (toolIcons[t].name === userOptions.quickMenuTools[i].name) {
				toolIcons[t].index = i;
				toolIcons[t].disabled = userOptions.quickMenuTools[i].disabled;
				break;
			}
		}
	}
	
	toolIcons = toolIcons.sort(function(a, b) {
		return (a.index < b.index) ? -1 : 1;
	});

	for (let icon of toolIcons) {
		let img = document.createElement('img');
		img.disabled = icon.disabled;
		img.style.opacity = (img.disabled) ? .4 : 1;
		img.className = 'toolIcon';
		img.setAttribute('draggable', true);
		img.src = icon.src;
		img.setAttribute('data-title',icon.title);
		img.name = icon.name;

		img.addEventListener('dragstart',dragstart_handler);
		img.addEventListener('dragend',dragend_handler);
		img.addEventListener('drop',drop_handler);
		img.addEventListener('dragover',dragover_handler);

		img.addEventListener('click',(e) => {
			e.target.disabled = e.target.disabled || false;
			e.target.style.opacity = e.target.disabled ? 1 : .4;
			e.target.disabled = !e.target.disabled;	
			saveOptions();
		});
		
		let orig_text = document.getElementById('toolIcons_description').innerText;
		img.addEventListener('mouseover', (e) => {
			document.getElementById('toolIcons_description').innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', (e) => {
			document.getElementById('toolIcons_description').innerText = orig_text;
		});

		document.getElementById('toolIcons').appendChild(img);
	}
}

document.addEventListener("DOMContentLoaded", (e) => {
	for (let el of document.getElementsByName('reloadMethod')) {
		el.addEventListener('click', (e) => {
			document.getElementById('manual').style.display='none';
			document.getElementById('automatic').style.display='none';
			document.getElementById(el.value).style.display='';
		});
		el.addEventListener('change', (e) => {
			saveOptions(e);
		});
	}
});

document.addEventListener("DOMContentLoaded", () => {
	for (let el of document.getElementsByClassName('position')) {
		el.addEventListener('click', (e) => {
			for (let _el of document.getElementsByClassName('position'))
				_el.className = _el.className.replace(' active', '');
			el.className+=' active';
			document.getElementById('h_position').value = el.dataset.position;
			saveOptions();
		});
		
		let orig_text = document.getElementById('position_description').innerText;
		el.addEventListener('mouseover', (e) => {
			document.getElementById('position_description').innerText = e.target.dataset.position;
		});
		
		el.addEventListener('mouseout', (e) => {
			document.getElementById('position_description').innerText = orig_text;
		});
		
	}
	
});

// lite
document.addEventListener("DOMContentLoaded", (e) => {
	if (typeof browser.runtime.sendNativeMessage === 'function') return false;
	for (let el of document.getElementsByTagName('native')) {
		el.style.display = 'none';
	}
	
	setTimeout(() => {
		document.getElementById('manual').style.display='inline-block';
	}, 250);
});