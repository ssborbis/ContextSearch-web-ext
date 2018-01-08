// array for storage.local
var saveTo = [];
var userOptions = {};

let button = document.getElementById("selectMozlz4FileButton");
button.onchange = (ev) => {
	saveTo = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		saveTo = searchEngineObjectToArray(engines);
		
		var icons = loadRemoteIcons(saveTo);
		var timeout_start = Date.now();
		var timeout = 15000;
		
		statusMessage({
			img: "icons/spinner.svg",
			msg: "Loading remote content"
		});
		
		var remoteIconsInterval = setInterval(function() {
			
			function onSet() {
				saveOptions();
				
				if (window.location.href.match(/#quickload$/) !== null) {
					browser.runtime.sendMessage({action: "closeWindowRequest"});
				}
				
				document.getElementById('searchEngineWarningDivContainer').style.display = "none";
				var el = document.getElementById('searchEngineWarningDiv');
				el.innerText = "";
				
				for (let i=0;i<saveTo.length;i++) {
					if (saveTo[i].queryCharset.toLowerCase() !== "utf-8") {
						document.getElementById('searchEngineWarningDivContainer').style.display = "inline-block";
						var p = document.createElement('p');
						p.style.marginLeft = "20px";
						p.innerText = "\u2022 " + saveTo[i].title + " (" + saveTo[i].queryCharset + ")";
						el.appendChild(p);
					}
				}
				
				clearInterval(remoteIconsInterval);
			}
		
		/*	function onError() {
				statusMessage({
					img: "icons/no.png",
					msg: "Failed to load search engines :("
				});
				console.log(`Error: ${error}`);
			}
		*/	
			function getFailedCount() {
				var c = 0;
				for (var i=0;i<icons.length;i++) {
					if (typeof icons[i].failed !== 'undefined') c++;
				}
				return c;
			}
			
			var counter = 0;
			for (var i=0;i<icons.length;i++) {
				if (typeof icons[i].base64String !== 'undefined') {
					saveTo[i].icon_base64String = icons[i].base64String;
					counter++;
				}
			}
			
			if (Date.now() - timeout_start > timeout ) {
				
				statusMessage({
					img: "icons/alert.png",
					msg: "Loaded " + icons.length + " search engines and " + (icons.length - getFailedCount()) + " of " + icons.length + " icons"
				});
				
				onSet();
			}
			
			if (counter === icons.length) {

				var failed_count = getFailedCount();
				
				if (failed_count > 0)
					statusMessage({
						img: "icons/alert.png",
						msg: "Loaded " + icons.length + " search engines and " + (icons.length - failed_count) + " of " + icons.length + " icons"
					});
				else
					statusMessage({
						img: "icons/yes.png",
						msg: "Success!  Loaded " + saveTo.length + " search engines"
					});

				onSet();
			}
		}, 250);
		
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
		
		disableOptions();
		
		if (userOptions.searchEngines.length === 0)
			document.getElementById('b_showHelp').dispatchEvent(new Event('click'));
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.runtime.sendMessage({action: "getUserOptions"});
	getting.then(onGot, onError);
	
}

function saveOptions(e) {

	if (typeof e !== 'undefined') e.preventDefault();
	
	function onSet() {
		browser.runtime.sendMessage({action: "updateUserOptions"});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var setting = browser.storage.local.set({
		userOptions: {
			searchEngines: (saveTo.length > 0) ? saveTo : userOptions.searchEngines,
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

	});
	setting.then(onSet, onError);

}

function loadHowToImg() {
	
	var howToImg = new Image();
	howToImg.src = "https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/master/icons/howto.gif";
	howToImg.style.width = "calc(100% - 2px)";
	howToImg.style.border = "1px solid grey";
	howToImg.onload = function() {
		
		var el = document.getElementById('howToImgDiv');
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}	
		
		el.appendChild(howToImg);
		
	}
}

function swapKeys(e) {
	document.getElementById('default_shift').innerText = (document.getElementById('cb_swapKeys').checked) ? "Ctrl" : "Shift";
	document.getElementById('default_ctrl').innerText = (document.getElementById('cb_swapKeys').checked) ? "Shift" : "Ctrl";
}

function disableOptions() {
	let children = document.getElementById('quickMenuOptions').querySelectorAll('*');

	for (let c of children) {
		if (c !== document.getElementById('cb_quickMenu'))
			c.disabled = !document.getElementById('cb_quickMenu').checked;
	}
}

function changeButtons(e, button) {
	if (!document.getElementById('cb_quickMenu').checked) return false;
	var el = e.target;
	document.getElementById('img_rightMouseButton').style.opacity = .4;
	document.getElementById('img_leftMouseButton').style.opacity = .4;
	el.style.opacity = 1;	
	document.getElementById('h_mouseButton').value = button;
	saveOptions(e);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.addEventListener("DOMContentLoaded", loadHowToImg);

document.addEventListener("DOMContentLoaded", (e) => {
	if (typeof browser.runtime.sendNativeMessage !== 'function') {
		let els = document.getElementsByClassName('native_app');
		for (el of els) {
			el.style.display = "none";
		}
	}
});

document.getElementById('b_showHelp').addEventListener('click', (e) => {
	document.getElementById('help').style.display = "";
	e.target.parentNode.removeChild(e.target);
});

document.getElementById('cb_contextMenu').addEventListener('change', saveOptions);
document.getElementById('cb_backgroundTabs').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', swapKeys);
document.getElementById('cb_swapKeys').addEventListener('change', saveOptions);

document.getElementById('cb_quickMenu').addEventListener('change', (e) => {
	disableOptions();
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
document.getElementById('i_searchJsonPath').addEventListener('change', saveOptions);

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

if (window.location.href.match(/#quickload$/) !== null) {
	var blobs = document.getElementsByClassName('blobContainer');
	for (var i=0;i<blobs.length;i++) 
		blobs[i].style.display='none';
	
	var loadButton = document.getElementById('selectMozlz4FileButton');
	document.body.style.padding = "10px";
	document.body.appendChild(loadButton);
	document.title = "Reload Search Engines";
	
	loadButton.addEventListener('change', (e) => {
		var img = document.createElement('img');
		img.src = 'icons/spinner.svg';
		img.style.height = '20px';
		img.style.width = '20px';
		document.body.appendChild(img);
	});
}