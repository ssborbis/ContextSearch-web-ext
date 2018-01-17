function searchEngineObjectToArray(engines) {
			
	let searchEnginesArray = [];

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
		searchEnginesArray.push({"query_string":search_url,"icon_url":engine._iconURL,"title":engine._name,"order":engine._metaData.order, "icon_base64String": "", "method": method, "params": params, "template": template, "queryCharset": engine.queryCharset || "UTF-8"});
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
		hasTimeedOut: false,
		hasFailedCount: 0,	
	}
	
	var icons = [];
	for (var i=0;i<searchEngines.length;i++) {		
		var img = new Image();
		img.favicon_urls = [];
		img.index = i;
	//	img.favicon_monogram = searchEngines[i].title.charAt(0);
		
		if (searchEngines[i].icon_url.match(/^resource/) !== null || searchEngines[i].icon_url == "") {
			var url = new URL(searchEngines[i].query_string);
			img.src = url.origin + "/favicon.ico";
			img.favicon_urls = [
				"https://icons.better-idea.org/icon?url=" + url.hostname + "&size=16",
				"https://plus.google.com/_/favicon?domain=" + url.hostname,				
			];
			
			let domain_parts = url.host.split('.');
			if (domain_parts.length > 1) {
				let domain = url.protocol + "//" + domain_parts[domain_parts.length-2] + "." + domain_parts[domain_parts.length-1];
				if (domain !== url.host)
					img.favicon_urls.push(domain);
			}

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
			//	ctx.fillStyle = "#FFFFFF";
			//	ctx.font=ctx.canvas.height + "px Georgia";
			//	ctx.fillText(this.favicon_monogram,4,12);
			//	console.log(this.favicon_monogram);
				
				this.base64String = c.toDataURL();
				console.log("Failed to load favicon. Using color " + ctx.fillStyle);
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
			onComplete();
		}
		
		if (counter === icons.length) {
			onComplete();
		}
		
	}, 250);
	
	return icons;
}
		