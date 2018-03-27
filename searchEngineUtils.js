function searchEngineObjectToArray(engines) {
			
	let searchEnginesArray = [];

	// iterate over search engines in search.json.mozlz4
	for (var i in engines) {
		var search_url = "", params_str = "", method = "", params, template = "", searchForm = "", hidden = false;
		var engine = engines[i];

		// hidden search engines
		if (engine._metaData && engine._metaData.hidden && engine._metaData.hidden == true) hidden = true;
		
		// set landing page for POST
		searchForm = engine.__searchForm || "";
		
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
			params_str = "&" + nameValueArrayToParamString(url.params);
		
			params = url.params;
		}
		
		if (search_url.match(/[=&\?]$/)) search_url+=params_str.replace(/^&/,"");
		else search_url+=params_str.replace(/^&/,"?");
		
		// push object to array for storage.local
		searchEnginesArray.push({
			"searchForm": searchForm, 
			"query_string":search_url,
			"icon_url":engine._iconURL,
			"title":engine._name,
			"order":engine._metaData.order, 
			"icon_base64String": "", 
			"method": method, 
			"params": params, 
			"template": template, 
			"queryCharset": engine.queryCharset || "UTF-8", 
			"hidden": hidden
		});
	}
	
	// sort search engine array by order key
	searchEnginesArray = searchEnginesArray.sort(function(a, b){
		if(a.order < b.order) return -1;
		if(a.order > b.order) return 1;
		return 0;
	});
	
	return searchEnginesArray;
}

function loadRemoteIcons(options) {
	
	var timeout_start = Date.now();
	var timeout = options.timeout || 15000;
	var callback = options.callback || function(){};
	var searchEngines = options.searchEngines || [];
	
	let details = {
		searchEngines: [],
		hasTimedOut: false,
		hasFailedCount: 0
	}
	
	function imgToBase64(img) {
		var c = document.createElement('canvas');
		var ctx = c.getContext('2d');
		ctx.canvas.width = 16;
		ctx.canvas.height = 16;
		ctx.fillStyle = '#6ec179';
		ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		ctx.font="16px Georgia";
		ctx.textAlign = 'center';
		ctx.textBaseline="middle"; 
		ctx.fillStyle = "#FFFFFF";
		ctx.fillText(img.favicon_monogram,8,8);
		console.log(img.favicon_monogram);
		
		return c.toDataURL();
	}
	
	var icons = [];
	for (var i=0;i<searchEngines.length;i++) {		
		var img = new Image();
		img.favicon_urls = [];
		img.index = i;
		
		img.favicon_monogram = searchEngines[i].title.charAt(0).toUpperCase();
		
		if (searchEngines[i].icon_url.match(/^resource/) !== null || searchEngines[i].icon_url == "") {
			var url = new URL(searchEngines[i].query_string);
			img.src = url.origin + "/favicon.ico";

			img.favicon_urls = [
				"https://icons.better-idea.org/icon?url=" + url.hostname + "&size=16",
				"https://plus.google.com/_/favicon?domain=" + url.hostname,				
			];

		} else 
			img.src = searchEngines[i].icon_url;

		img.onload = function() {
			this.base64String = imageToBase64(this, 32);;
		};
		
		img.onerror = function() {			
			if (this.favicon_urls.length !== 0) {
				console.log("Failed getting favicon at " + this.src);
				this.src = this.favicon_urls.pop();
				console.log("Trying favicon at " + this.src);
			}
			else {
				this.base64String = imgToBase64(this);
				this.failed = true;
			}
		};
		icons.push(img);
	}
	
	var remoteIconsInterval = setInterval(function() {
			
		function onComplete() {
			clearInterval(remoteIconsInterval);
			details.hasFailedCount = getFailedCount();
			details.searchEngines = searchEngines;
			callback(details);
		}

		function getFailedCount() {
			let c = 0;
			for (let i=0;i<icons.length;i++) {
				if (typeof icons[i].failed !== 'undefined') c++;
			}
			return c;
		}
		
		var counter = 0;
		for (let i=0;i<icons.length;i++) {
			if (typeof icons[i].base64String !== 'undefined') {
				searchEngines[i].icon_base64String = icons[i].base64String;
				counter++;
			}
		}
		
		if (Date.now() - timeout_start > timeout ) {
			details.hasTimedOut = true;
			
			for (let i=0;i<icons.length;i++) {
				if (typeof icons[i].base64String === 'undefined')
					searchEngines[i].icon_base64String = imgToBase64(icons[i]);
			}
			onComplete();
		}
		
		if (counter === icons.length) {
			onComplete();
		}
		
	}, 250);
	
	return icons;
}
		