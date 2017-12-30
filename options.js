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
		
		console.log(engines);

		// iterate over search engines in search.json.mozlz4
		for (var i in engines) {
			var search_url = "", params_str = "", method = "", params, template = "";
			var engine = engines[i];
			
			// skip hidden search engines
			if (engine._metaData && engine._metaData.hidden && engine._metaData.hidden == true) continue;
			
			// iterate over urls array
			for (var u=0;u<engine._urls.length;u++) {
				var url = engine._urls[u];
				
				// skip urls with a declared type other than text/html
				if (url.type && url.type != "text/html") continue;
				
				// get request method
				method = url.method || "GET";
				// get the main search url
				search_url = url.template;
				
				template = url.template;
				
				// get url params
				for (var p in url.params)
					params_str+="&" + url.params[p].name + "=" + url.params[p].value;
			
				params = url.params;
			}
			
			if (search_url.match(/[=&\?]$/)) search_url+=params_str.replace(/^&/,"");
			else search_url+=params_str.replace(/^&/,"?");
			
			// push object to array for storage.local
			saveTo.push({"query_string":search_url,"icon_url":engine._iconURL,"title":engine._name,"order":engine._metaData.order, "icon_base64String": "", "method": method, "params": params, "template": template, "queryCharset": engine.queryCharset || "UTF-8"});
		}
		
		console.log(saveTo);
		
		// sort search engine array by order key
		saveTo = saveTo.sort(function(a, b){
			if(a.order < b.order) return -1;
			if(a.order > b.order) return 1;
			return 0;
		});

		var icons = loadRemoteIcons(saveTo);
		var timeout_start = Date.now();
		var timeout = 15000;
		
		statusMessage({
			img: "icons/spinner.svg",
			msg: "Loading remote content"
		});
		
		var remoteIconsTimeout = setInterval(function() {
			
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
				
				clearInterval(remoteIconsTimeout);
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
		
		document.getElementById('cb_backgroundTabs').checked = userOptions.backgroundTabs || false;
		document.getElementById('cb_swapKeys').checked = userOptions.swapKeys || false;
		document.getElementById('cb_quickMenu').checked = userOptions.quickMenu || false;
		
		document.getElementById('n_quickMenuColumns').value = userOptions.quickMenuColumns || 4;
		document.getElementById('n_quickMenuItems').value = userOptions.quickMenuItems || 100;
		
		document.getElementById('b_quickMenuKey').value = userOptions.quickMenuKey || 0;
		document.getElementById('b_quickMenuKey').innerText = keyTable[userOptions.quickMenuKey || 0] || "Set";
		document.getElementById('r_quickMenuOnKey').checked = userOptions.quickMenuOnKey || false;
		document.getElementById('r_quickMenuOnMouse').checked = (userOptions.quickMenuOnMouse !== undefined) ? userOptions.quickMenuOnMouse : true;
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto || false;
		document.getElementById('r_quickMenuOnClick').checked = userOptions.quickMenuOnClick || false;
		
		document.getElementById('h_mouseButton').value = (userOptions.quickMenuMouseButton !== undefined) ? userOptions.quickMenuMouseButton : 3;
		
		if (document.getElementById('h_mouseButton').value == 3)
			document.getElementById('img_rightMouseButton').style.opacity = 1;
		else if (document.getElementById('h_mouseButton').value == 1)
			document.getElementById('img_leftMouseButton').style.opacity = 1;
		
		document.getElementById('cb_contextMenu').checked = (userOptions.contextMenu !== undefined) ? userOptions.contextMenu : true;
		
		disableOptions();
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.storage.local.get("userOptions");
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
			contextMenu: document.getElementById('cb_contextMenu').checked
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

function loadRemoteIcons(searchEngines) {
	var icons = [];
	for (var i=0;i<searchEngines.length;i++) {		
		var img = new Image();
		img.favicon_urls = [];
		img.index = i;
		
		if (searchEngines[i].icon_url.match(/^resource/) !== null) {
			var a = document.createElement('a');
			a.href = searchEngines[i].query_string;
			img.src = "http://" + a.hostname + "/favicon.ico";
			img.favicon_urls = [
				"https://icons.better-idea.org/icon?url=" + a.hostname + "&size=16",
				"https://plus.google.com/_/favicon?domain=" + a.hostname
			];

		} else 
			img.src = searchEngines[i].icon_url;

		img.onload = function() {
			let c = document.createElement('canvas');
			let ctx = c.getContext('2d');
			ctx.canvas.width = this.naturalWidth;
			ctx.canvas.height = this.naturalHeight;
			ctx.drawImage(this, 0, 0);
			this.base64String = c.toDataURL();
		};
		
		img.onerror = function() {			
			if (this.favicon_urls.length !== 0) {
				console.log("Failed getting favicon at " + this.src);
				this.src = this.favicon_urls.pop();
				console.log("Trying favicon at " + this.src);
			}
			else {
				var c = document.createElement('canvas');
				var ctx = c.getContext('2d');
				ctx.canvas.width = 16;
				ctx.canvas.height = 16;
				ctx.fillStyle = '#'+(Math.random()*0xFFFFFF<<0).toString(16);
				ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
				ctx.beginPath();
				ctx.lineWidth="4";
				ctx.rect(0,0,ctx.canvas.width, ctx.canvas.height);
				ctx.strokeStyle='black';
				ctx.stroke();
				this.base64String = c.toDataURL();
				console.log("Failed to load favicon. Using color " + ctx.fillStyle);
				this.failed = true;
			}
		};
		icons.push(img);
	}
	
	return icons;
}

function swapKeys(e) {
	document.getElementById('default_shift').innerText = (document.getElementById('cb_swapKeys').checked) ? "Ctrl" : "Shift";
	document.getElementById('default_ctrl').innerText = (document.getElementById('cb_swapKeys').checked) ? "Shift" : "Ctrl";
}

function disableOptions() {
	var isDisabled = !document.getElementById('cb_quickMenu').checked;
	document.getElementById('n_quickMenuColumns').disabled = isDisabled;
	document.getElementById('n_quickMenuItems').disabled = isDisabled;
	document.getElementById('b_quickMenuKey').disabled = isDisabled;
	document.getElementById('r_quickMenuOnKey').disabled = isDisabled;
	document.getElementById('r_quickMenuOnMouse').disabled = isDisabled;
	document.getElementById('r_quickMenuOnClick').disabled = isDisabled;
	document.getElementById('r_quickMenuAuto').disabled = isDisabled;
	document.getElementById('img_rightMouseButton').disabled = isDisabled;
	document.getElementById('img_leftMouseButton').disabled = isDisabled;
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

document.getElementById('cb_contextMenu').addEventListener('change', saveOptions);
document.getElementById('cb_backgroundTabs').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', swapKeys);

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

document.getElementById('r_quickMenuOnMouse').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnKey').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuAuto').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnClick').addEventListener('change', saveOptions);

document.getElementById('img_rightMouseButton').addEventListener('click', (ev) => {changeButtons(ev,3)});
document.getElementById('img_leftMouseButton').addEventListener('click', (ev) => {changeButtons(ev,1)});


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