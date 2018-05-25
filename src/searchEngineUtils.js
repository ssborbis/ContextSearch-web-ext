function searchJsonObjectToArray(engines) {
			
	let searchEngines = [];

	// iterate over search engines in search.json.mozlz4
	for (var engine of engines) {
		
		var search_url = "", params_str = "", method = "", params, template = "", searchForm = "", hidden = false;

		// hidden search engines
		if (engine._metaData && engine._metaData.hidden && engine._metaData.hidden == true) hidden = true;
		
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
			params_str = nameValueArrayToParamString(url.params);
		
			params = url.params;
		}
		
		if (params_str && method.toUpperCase() === "GET")
			search_url += ( (search_url.match(/[=&\?]$/)) ? "" : "?" ) + params_str
		
//		console.log(search_url);
		
		// push object to array for storage.local
		searchEngines.push({
			"searchForm": engine.__searchForm || "", 
			"query_string": search_url,
			"icon_url": engine._iconURL,
			"title": engine._name,
			"order": engine._metaData.order, 
			"icon_base64String": "", 
			"method": method || "GET", 
			"params": params, 
			"template": template, 
			"queryCharset": engine.queryCharset || "UTF-8", 
			"hidden": hidden
		});
	}
	
	// sort search engine array by order key
	searchEngines = searchEngines.sort(function(a, b){
		if(a.order < b.order) return -1;
		if(a.order > b.order) return 1;
		return 0;
	});
	
	return searchEngines;
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
	
	function tempImgToBase64(img) {
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
//		console.log(img.favicon_monogram);
		
		return c.toDataURL();
	}
	
	var icons = [];
	for (let se of searchEngines) {		
		var img = new Image();
		img.favicon_urls = [];		
		img.favicon_monogram = se.title.charAt(0).toUpperCase();
		
		if (se.icon_url.match(/^resource/) !== null || se.icon_url == "") {
			var url = new URL(se.query_string);
			img.src = url.origin + "/favicon.ico";

			img.favicon_urls = [
				"https://icons.better-idea.org/icon?url=" + url.hostname + "&size=16",
				"https://plus.google.com/_/favicon?domain=" + url.hostname,				
			];

		} else 
			img.src = se.icon_url;

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
				this.base64String = tempImgToBase64(this);
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
			for (let icon of icons) {
				if (typeof icon.failed !== 'undefined') c++;
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
					searchEngines[i].icon_base64String = tempImgToBase64(icons[i]);
			}
			onComplete();
		}
		
		if (counter === icons.length) {
			onComplete();
		}
		
	}, 250);

}
		