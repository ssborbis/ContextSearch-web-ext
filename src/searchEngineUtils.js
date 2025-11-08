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
			"icon": engine._iconURL,
			"title": engine._name,
			"order": engine._metaData.order, 
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

	// return svg as-is
	if (image.src.startsWith("data:image/svg+xml")) return image.src;

	if (image.src.toLowerCase().endsWith("svg")) return image.src;
	
	function isCanvasBlank(canvas) {
		var blank = document.createElement('canvas');
		blank.width = canvas.width;
		blank.height = canvas.height;

		return canvas.toDataURL() == blank.toDataURL();
	}
	
	let c = document.createElement('canvas');
	let ctx = c.getContext('2d');
	
	ctx.canvas.width = image.naturalWidth || maxSize;
	ctx.canvas.height = image.naturalHeight || maxSize;

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
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
    <rect x="1" y="1" width="21" height="21" rx="2" ry="2" fill="${options.backgroundColor || '#6ec179'}" stroke="${options.textColor || '#FFFFFF'}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1"/>
	<text x="50%" y="16" class="text" text-anchor="middle" fill="${options.textColor || '#FFFFFF'}" style="font-family: ${options.fontFamily || 'Georgia'};font-size:${options.fontSize || '12px'}">${options.text || ""}</text>
	</svg>`;

	return 'data:image/svg+xml;base64,' + btoa(svg);
}

async function promptForImage() {
	let od = document.createElement('div');
	od.style = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:99;text-align:center;background-color:rgba(255,255,255,.5)";
	let div = document.createElement('div');
	div.className = "promptForImage";
	
	div.innerHTML = `
		Icon URL<br />
		<input type='text' class='inputNice' /><br />
		<button>Save</button>
	`;
	
	let container = document.getElementById('searchEnginesParentContainer');
	
	od.appendChild(div);
	container.appendChild(od);
	
	od.onclick = function() { od.parentNode.removeChild(od);}
	
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
			var url = "";
			try {
				url = new URL(se.template || se.searchForm || window.location.href);
			} catch ( err ) {}
			// security policy may mean only the favicon may be converted by canvas
			img.favicon_urls = [
				url.origin + "/favicon.ico",
				"https://plus.google.com/_/favicon?domain=" + url.hostname,				
			];

			if (se.icon && se.icon.startsWith("resource") || se.icon == "") 
				img.src = img.favicon_urls.shift();
			else 
				img.src = se.icon;

			img.onload = function() {
				this.base64String = imageToBase64(this, userOptions.cacheIconsMaxSize);
				
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
					searchEngines[i].iconCache = icons[i].base64String;
					counter++;
				}
			}
			
			if (Date.now() - timeout_start > timeout ) {
				details.hasTimedOut = true;
				
				for (let i=0;i<icons.length;i++) {
					if (typeof icons[i].base64String === 'undefined')
						searchEngines[i].iconCache = createCustomIcon({text: icons[i].favicon_monogram});
				}
				onComplete();
			}
			
			if (counter === icons.length) {
				onComplete();
			}
			
		}, 250);
	});

}

function readOpenSearchUrl(url) {
	return new Promise( async (resolve, reject) => {
		
		let t = setTimeout(() => {
			console.error('Error fetching ' + url + " This may be due to Content Security Policy https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP");
			
			reject(false);
		}, 2000);
		
		let resp = await fetch(url);
		let text = await resp.text();

		if ( typeof DOMParser === 'undefined' ) {
			clearTimeout(t);
			console.error('DOMParser not supported');

			return reject('DOMParser not supported');
		}
		
		let parsed = new DOMParser().parseFromString(text, 'application/xml');

		if (parsed.documentElement.nodeName=="parsererror") {
			console.log('xml parse error');
			clearTimeout(t);
			resolve(false);
		}

		clearTimeout(t);
		resolve(parsed);
	});
}

function openSearchXMLToSearchEngine(xml) {
		
	let se = {};

	let shortname = xml.documentElement.querySelector("ShortName");
	if (shortname) se.title = shortname.textContent;
	else return Promise.reject();
	
	let description = xml.documentElement.querySelector("Description");
	if (description) se.description = description.textContent;
	else return Promise.reject();
	
	let inputencoding = xml.documentElement.querySelector("InputEncoding");
	if (inputencoding) se.queryCharset = inputencoding.textContent.toUpperCase();
	
	let url = xml.documentElement.querySelector("Url[template]");
	if (!url) return Promise.reject();
	
	let template = url.getAttribute('template');
	if (template) se.template = template;
	
	let searchform = xml.documentElement.querySelector("moz\\:SearchForm");
	if (searchform) se.searchForm = searchform.textContent;
	else if (template) se.searchForm = new URL(template).origin;
	
	let image = xml.documentElement.querySelector("Image");
	if (image) se.icon = image.textContent;
	else se.icon = new URL(template).origin + '/favicon.ico';
	
	let method = url.getAttribute('method');
	if (method) se.method = method.toUpperCase() || "GET";

	let params = [];
	for (let param of url.getElementsByTagName('Param')) {
		params.push({name: param.getAttribute('name'), value: param.getAttribute('value')})
	}
	se.params = params;
	
	if (se.params.length > 0 && se.method === "GET") {
		se.template = se.template + ( (se.template.match(/[=&\?]$/)) ? "" : "?" ) + nameValueArrayToParamString(se.params);
	}
	
	se.id = gen();

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}

function openSearchUrlToSearchEngine(url) {
	return readOpenSearchUrl(url).then( xml => {
		if ( !xml ) return false;
		
		return openSearchXMLToSearchEngine(xml);
	});
}

function findIcons(o) {

	o.service = o.service || "iconfinder";

	const finder = _o => {
		if ( !_o.url ) return console.error("findIcons: no url");
		if ( !_o.selector ) return console.error("findIcons: no selector");

		return browser.tabs.create({
				url: _o.url,
				active:false
			}).then(async tab => {
				await new Promise(r => setTimeout(r, 2000));

				let urls = await _executeScript({
					func: (selector) => [...document.querySelectorAll(selector)].map(img => img.src),
					tabId: tab.id,
					args: [_o.selector]
				});

				browser.tabs.remove(tab.id);
				return urls;
			});
	}

	const flaticon = s => {
		return finder({
			url: "https://www.flaticon.com/search?word=" + s.toLowerCase(),
			selector: ".link-icon-detail > IMG"
		});
	}

	const iconfinder = s => {
		return finder({
			url: "https://www.iconfinder.com/search?q=" + s.toLowerCase(),
			selector: ".icon-grid IMG"
		});
	}

	const icons8 = s => {
		return finder({
			url: "https://icons8.com/icons/set/" + s.toLowerCase(),
			selector: "img[data-image-id]"
		});
	}

	switch (o.service) {
		case "iconfinder": 
			return iconfinder(o.query);
		case "flaticon":
			return flaticon(o.query);
		case "icons8":
			return icons8(o.query);
	}
}

function getMonogramIcons(str, count=10) {

	let fonts = "Arial,Verdana,Helvetica,Tahoma,Trebuchet MS,Times New Roman,Georgia,Garamond,Courier New,Brush Script MT".split(",");

	let _urls = [];
	let palette = palettes.map(p => p.color).join("-");
	let colors = palette.split('-');

	let randomColors = [];
	for ( let i=0;i<count;i++) {
		randomColors.push(colors.splice([Math.floor(Math.random()*colors.length)],1));
	}

	randomColors.forEach( c => {
		_urls.push(createCustomIcon({
			text: str.charAt(0).toUpperCase(), 
			backgroundColor: '#' + c,
			fontFamily: fonts[Math.floor(Math.random()*fonts.length)]
		}));
	});

	return _urls;
}