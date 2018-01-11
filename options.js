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
						msg: "Loaded " + icons.length + " search engines and " + (icons.length - failed_count) + " of " + icons.length + " icons"
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
		document.getElementById('i_searchJsonPath').value = userOptions.searchJsonPath;

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
			if (e.target.id === "i_searchJsonPath") {
				var gettingPage = browser.runtime.getBackgroundPage().then((w) => {
					w.nativeApp();
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
		contextMenu: document.getElementById('cb_contextMenu').checked,
		searchJsonPath: document.getElementById('i_searchJsonPath').value
	}

	var setting = browser.storage.local.set({
		"userOptions": userOptions
	});
	setting.then(onSet, onError);

}

document.getElementById('a_howTo').addEventListener('click', (e) => {
	e.preventDefault();
	var howToImg = new Image();
	howToImg.src = "https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/master/icons/howto.gif";
	howToImg.style.border = "1px solid grey";
	howToImg.onload = function() {
		
		var el = document.getElementById('howToImgDiv');
		el.parentNode.style.display='';
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}	
		
		el.appendChild(howToImg);
		howToImg.style.width = "calc(100% - 8px)";
	}
});

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

document.addEventListener("DOMContentLoaded", restoreOptions);
document.addEventListener("DOMContentLoaded", makeTabs());

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
	
	if (ev.target.value.match(/\/search.json.mozlz4$/) === null) { 
		el.innerText = "Path must include 'search.json.mozlz4'";
		el.style.color = 'red';
		return false;
	}
	
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
		el.innerText = "Failed to load file (" + error.message + ") Is native app installed?";
		el.style.color = 'red';
	}
	
	var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + ev.target.value + '"}');
	sending.then(onResponse, onError);
	
});
document.getElementById('b_quickMenuKey').addEventListener('click', (e) => {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	img.style.height = "16px";
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
		document.body.style.padding="20px";
		document.body.style.overflowX='hidden';
		document.body.style.overflowY='auto';
		document.body.style.width=window.getComputedStyle(document.body).getPropertyValue('width');
		
		let el = document.getElementById('enginesTab');
		for (let kid of el.children)
			kid.style.display = 'none';
		
		let text = document.createElement('span');
		text.innerText = "Load search.json.mozlz4";
		text.style.marginRight='30px';
		el.appendChild(text);
		
		let loadButton = document.createElement('button');
		loadButton.innerText = "Browse";
		loadButton.style.fontSize='12pt';
		loadButton.onclick = () => {
			window.open('/options.html#quickload', 'Reload Search Engines', 'width=400,height=50,dependent=no,location=no,menubar=no,scrollbars=no,titlebar=no,status=no,toolbar=no');
		}
		el.appendChild(loadButton);
		
		let a = document.createElement('a');
		a.href="javascript:void(0)";
		a.style='display:block;padding:20px;text-align:center';
		a.onclick = () => {
			browser.runtime.openOptionsPage();
		};
		a.innerText = "Full Options";
		el.appendChild(a);

	});	
}

function makeTabs() {
	
	let tabs = document.getElementsByClassName("tablinks");
	for (let tab of tabs) {
		tab.addEventListener('click', (e) => {
			// Get all elements with class="tabcontent" and hide them
			let tabcontent = document.getElementsByClassName("tabcontent");
			for (i = 0; i < tabcontent.length; i++) {
				tabcontent[i].style.display = "none";
			}
			
			for (let tab2 of tabs) {
				tab2.getElementsByTagName('img')[0].style.display='none';
			}
			
			e.target.getElementsByTagName('img')[0].className = 'fade-in';
			e.target.getElementsByTagName('img')[0].style.display='inline-block';
				
			// Get all elements with class="tablinks" and remove the class "active"
			let tablinks = document.getElementsByClassName("tablinks");
			for (i = 0; i < tablinks.length; i++) {
				tablinks[i].className = tablinks[i].className.replace(" active", "");
			}

			// Show the current tab, and add an "active" class to the button that opened the tab
			document.getElementById(e.target.dataset.tabid).style.display = "block";
			e.currentTarget.className += " active";
		});
	}
	tabs[0].click();
}
