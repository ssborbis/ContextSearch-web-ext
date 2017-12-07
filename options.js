let button = document.getElementsByName("selectMozlz4FileButton")[0];
button.onchange = function(ev) {
	let file = ev.target.files[0];
	readMozlz4File(file, function(text) { // on success
		
		// array for storage.local
		var saveTo = [];
		
		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;
		
//		console.log(engines);

		// iterate over search engines in search.json.mozlz4
		for (var i in engines) {
			var search_url = "", params = "";
			var engine = engines[i];
			
			// skip hidden search engines
			if (engine._metaData && engine._metaData.hidden && engine._metaData.hidden == true) continue;
			
			// iterate over urls array
			for (var u=0;u<engine._urls.length;u++) {
				var url = engine._urls[u];
				
				// skip urls with a declared type other than text/html
				if (url.type && url.type != "text/html") continue;
				
				// get the main search url
				search_url = url.template;
				
				// get url params
				for (var p in url.params) 
					params+="&" + url.params[p].name + "=" + url.params[p].value;
			}
			
			// replace the first & with ? in params string
			params=params.replace(/^&/,"?");
			
			// append params to search url
			search_url+=params;
			
			// push object to array for storage.local
			saveTo.push({"query_string":search_url,"icon_url":engine._iconURL,"title":engine._name,"order":engine._metaData.order});
		}
		
		// sort search engine array by order key
		saveTo = saveTo.sort(function(a, b){
			if(a.order < b.order) return -1;
			if(a.order > b.order) return 1;
			return 0;
		});
		
		function onSet() {			
			// print status message to Options page
			document.getElementById('status_img').src = "icons/yes.png";
			document.getElementById('status').innerText = "Success!  Loaded " + saveTo.length + " search engines";
			
			// send message to background.js to update context menu
			browser.runtime.sendMessage({action: "loadSearchEngines"});	
		}
		
		function onError() {
			console.log(`Error: ${error}`);
		}
		
		// save array to storage.local
		var setting = browser.storage.local.set({"searchEngines": saveTo});
		setting.then(onSet, onError);

	}, function() { // on fail

		// print status message to Options page
		document.getElementById('status_img').src = "icons/no.png";
		document.getElementById('status').innerText = "Failed to load search engines :(";
	});
};

function restoreOptions() {

	function onGot(result) {
		var userOptions = result.userOptions || {};
		document.getElementById('cb_backgroundTabs').checked = userOptions.backgroundTabs || false;
		document.getElementById('cb_swapKeys').checked = userOptions.swapKeys || false;
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.storage.local.get("userOptions");
	getting.then(onGot, onError);
}

function saveOptions(e) {
	e.preventDefault();
	
	function onSet() {
		browser.runtime.sendMessage({action: "loadUserOptions"});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var setting = browser.storage.local.set({
		userOptions: {
			backgroundTabs: document.getElementById('cb_backgroundTabs').checked,
			swapKeys: document.getElementById('cb_swapKeys').checked
		}
	});
	setting.then(onSet, onError);

}

function swapKeys(e) {
	document.getElementById('default_shift').innerText = (document.getElementById('cb_swapKeys').checked) ? "Ctrl" : "Shift";
	document.getElementById('default_ctrl').innerText = (document.getElementById('cb_swapKeys').checked) ? "Shift" : "Ctrl";
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

document.addEventListener("DOMContentLoaded", restoreOptions);
document.addEventListener("DOMContentLoaded", loadHowToImg);

document.getElementById('cb_backgroundTabs').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', saveOptions);
document.getElementById('cb_swapKeys').addEventListener('change', swapKeys);

