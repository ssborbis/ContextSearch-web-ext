function searchJsonObjectToArray(engines) {
			
	let searchEngines = [];

	// iterate over search engines in search.json.mozlz4
	for (var engine of engines) {

		if ( !engine._urls ) {
			console.log('no data', engine._name);
			continue;
		}
		
		var params_str = "", method = "", params, template = "", searchForm = "", hidden = false;

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
			template = url.template;

			params = url.params;
		}
		
		if (params.length > 0 && method.toUpperCase() === "GET")
			template += ( (template.match(/[=&\?]$/)) ? "" : "?" ) + nameValueArrayToParamString(url.params);

		// push object to array for storage.local
		searchEngines.push({
			"searchForm": engine.__searchForm || "", 
			"icon_url": engine._iconURL,
			"title": engine._name,
			"order": engine._metaData.order, 
			"icon_base64String": "", 
			"method": method || "GET", 
			"params": params, 
			"template": template, 
			"queryCharset": engine.queryCharset || "UTF-8", 
			"hidden": hidden,
			"id": gen()
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


function imageToBase64(image, maxSize) {
	
	function isCanvasBlank(canvas) {
		var blank = document.createElement('canvas');
		blank.width = canvas.width;
		blank.height = canvas.height;

		return canvas.toDataURL() == blank.toDataURL();
	}
	
	let c = document.createElement('canvas');
	let ctx = c.getContext('2d');
	
	ctx.canvas.width = image.naturalWidth || 16;
	ctx.canvas.height = image.naturalHeight || 16;

	try {

		if ( maxSize && ( image.naturalWidth > maxSize || image.naturalHeight > maxSize ) ) {
			
			let whichIsLarger = (image.naturalWidth > image.naturalHeight) ? image.naturalWidth : image.naturalHeight;
			let scalePercent = maxSize / whichIsLarger;
			
			ctx.canvas.width = image.naturalWidth * scalePercent;
			ctx.canvas.height = image.naturalHeight * scalePercent;
			ctx.scale(scalePercent, scalePercent);
		}
		
		ctx.drawImage(image, 0, 0);
		
		if (isCanvasBlank(c)) {
			console.log('canvas is empty');
			console.log(image.naturalWidth + "x" + image.naturalHeight);
			return "";
		}
		
		return c.toDataURL();
		
	} catch (e) {
		
		console.log(e);
		
		// ctx.drawImage(image, 0, 0);
		
		// return c.toDataURL();
		
		return "";
	} 	
}

function createCustomIcon(options) {
	var c = document.createElement('canvas');
	var ctx = c.getContext('2d');
	ctx.canvas.width = options.width || 16;
	ctx.canvas.height = options.height || 16;
	ctx.fillStyle = options.backgroundColor || '#6ec179';
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	if ( options.image ) {
		
		let img = new Image();
		img.src = options.image;
		
		ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
	}

	ctx.font = (options.fontSize || "16px") + " " + (options.fontFamily || "Georgia");
	ctx.textAlign = 'center';
	ctx.textBaseline="middle"; 
	ctx.fillStyle = options.textColor || "#FFFFFF";
	ctx.fillText(options.text || "",ctx.canvas.width/2,ctx.canvas.height/2);
	
	return c.toDataURL();
}

function loadRemoteIcon(options) {
	
	return new Promise( (resolve,reject) => {
	
		var timeout_start = Date.now();
		var timeout = options.timeout || 15000;
		var searchEngines = options.searchEngines || [];
		
		let details = {
			searchEngines: [],
			hasTimedOut: false,
			hasFailedCount: 0
		}
		
		// when favicons fail, construct a simple image using canvas
	
		var icons = [];
		for (let se of searchEngines) {		
			var img = new Image();
			img.favicon_urls = [];		
			img.favicon_monogram = se.title.charAt(0).toUpperCase();

			var url = new URL(se.template || se.searchForm || window.location.href);
			
			// security policy may mean only the favicon may be converted by canvas
			img.favicon_urls = [
				url.origin + "/favicon.ico",
				"https://plus.google.com/_/favicon?domain=" + url.hostname,				
			];

			if (se.icon_url.startsWith("resource") || se.icon_url == "") 
				img.src = img.favicon_urls.shift();
			else 
				img.src = se.icon_url;

			img.onload = function() {
				this.base64String = imageToBase64(this, 32);
				
				// image was loaded but canvas was tainted
				if (!this.base64String) {
					img.src = browser.runtime.getURL("icons/search.svg");
					this.onerror();
				}
			};
			
			img.onerror = function() {			
				if (this.favicon_urls.length !== 0) {
					console.log("Failed getting favicon at " + this.src);
					this.src = this.favicon_urls.shift();
					console.log("Trying favicon at " + this.src);
				}
				else {
					this.base64String = createCustomIcon({text: this.favicon_monogram});
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
				resolve(details);
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
						searchEngines[i].icon_base64String = createCustomIcon({text: icons[i].favicon_monogram});
				}
				onComplete();
			}
			
			if (counter === icons.length) {
				onComplete();
			}
			
		}, 250);
	});

}

function gen() {
	return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}
