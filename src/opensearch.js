function replaceOpenSearchParams(in_str, searchterms, url) {
	// replace OpenSearch params
	searchterms = searchterms || "";
	
	let domains = getDomains(url);
		
	return in_str
		.replace(/{searchTerms}/g, searchterms)
		.replace(/{count[\?]?}/g, "50")
		.replace(/{startIndex[\?]?}/g, "1")
		.replace(/{startPage[\?]?}/g, "1")
		.replace(/{language[\?]?}/g, (navigator) ? navigator.language || navigator.userLanguage : "")
		.replace(/{inputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{outputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{subdomain}/g, domains.subdomain || "")
		.replace(/{domain}/g, domains.domain || "")
		.replace(/{.+?\?}/g,"") // optionals
		.replace(/{moz:.+?}/g, "") // moz specific
		.replace(/{.+?}/g, ""); // all others
}

function nameValueArrayToParamString(arr) {
	
	if (typeof arr === 'string') return arr;
	let str = "";
	for (let p of arr) {
		str+= '&' + (p.name || "") + "=" + (p.value || "");
	}
	
	return str.slice(1);
}

function paramStringToNameValueArray(str) {
	
	if (!str.trim()) return [];
	let params = [];
	
	for (let pair of str.split("&")) {
		let p = pair.split("=");
		params.push({"name": p[0], "value": p[1] || ""});
	}
	
	return params;
}

function imageToBase64(image, maxSize) {
	
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
		
		return c.toDataURL();
		
	} catch (e) {
		
		console.log(e);
		
		// ctx.drawImage(image, 0, 0);
		
		// return c.toDataURL();
		
		return "";
	} 
	
}

function getDomains(url) {
	
	var countryCodes = ["af","ax","al","dz","as","ad","ao","ai","aq","ag","ar","am","aw","ac","au","at","az","bs","bh","bd","bb","eus","by","be","bz","bj","bm","bt","bo","bq","ba","bw","bv","br","io","vg","bn","bg","bf","mm","bi","kh","cm","ca","cv","cat","ky","cf","td","cl","cn","cx","cc","co","km","cd","cg","ck","cr","ci","hr","cu","cw","cy","cz","dk","dj","dm","do","tl","ec","eg","sv","gq","er","ee","et","eu","fk","fo","fm","fj","fi","fr","gf","pf","tf","ga","gal","gm","ps","ge","de","gh","gi","gr","gl","gd","gp","gu","gt","gg","gn","gw","gy","ht","hm","hn","hk","hu","is","in","id","ir","iq","ie","im","il","it","jm","jp","je","jo","kz","ke","ki","not","kw","kg","la","lv","lb","ls","lr","ly","li","lt","lu","mo","mk","mg","mw","my","mv","ml","mt","mh","mq","mr","mu","yt","mx","md","mc","mn","me","ms","ma","mz","mm","na","nr","np","nl","nc","nz","ni","ne","ng","nu","nf","nctr","kp","mp","no","om","pk","pw","ps","pa","pg","py","pe","ph","pn","pl","pt","pr","qa","ro","ru","rw","re","bq","bl","sh","kn","lc","mf","pm","vc","ws","sm","st","sa","sn","rs","sc","sl","sg","bq","sx","sk","si","sb","so","so","za","gs","kr","ss","es","lk","sd","sr","sj","sz","se","ch","sy","tw","tj","tz","th","tg","tk","to","tt","tn","tr","tm","tc","tv","ug","ua","ae","uk","us","vi","uy","uz","vu","va","ve","vn","wf","eh","ye","zm","zw"];
	
	var _URL = function() {
		try {
			return new URL(url);
		} catch (e) {
			return false;
		}
	}();
	
	if (!_URL) return {domain: "", subdomain:""};
	
	var subdomain = _URL.hostname || "";
	var domain = function() {
		if (!subdomain) return "";
		
		var parts = subdomain.split('.');
		
		let code = parts[parts.length-1];
			
		if (countryCodes.includes(code) && parts.length > 2)
			return parts[parts.length-3] + '.' + parts[parts.length-2] + '.' + parts[parts.length-1];
		else
			return parts[parts.length-2] + '.' + parts[parts.length-1];			
	}();
	
	return {domain: domain, subdomain:subdomain};
	
}

function readOpenSearchUrl(url) {
	
	return new Promise( (resolve, reject) => {
		var xmlhttp;

		xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = function()	{
			if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
				if(xmlhttp.status == 200) {

					let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'application/xml');
					
					if (parsed.documentElement.nodeName=="parsererror") {
						console.log('xml parse error');
						
						console.log(parsed);
						
						// // try to repair bad template urls
						// let regexStr = /<Url .* template="(.*)"/g;
						// let matches = regexStr.exec(xmlhttp.responseText);
						
						// if ( matches.length === 2 ) {
							// let template = matches[1];
							
							// template = template.replace(/&amp;/g, "&");
							// template = template.replace(/&/g, "&amp;");
							
							// console.log(template);
							
							// let newXML = xmlhttp.responseText.replace(matches[1], template);
							
							// console.log(newXML);
							
							
							
							// parsed = new DOMParser().parseFromString(newXML, 'application/xml');
							
							// if (parsed.documentElement.nodeName=="parsererror")
								parsed = false;
					//	}

					}
					resolve(parsed);
			   } else {
				   console.log('Error fetching ' + url);
				   reject(false);
			   }
			}
		}
		
		xmlhttp.ontimeout = function (e) {
			console.log('Timeout fetching ' + url);
			reject(false);
		};

		xmlhttp.open("GET", url, true);
		xmlhttp.timeout = 2000;
		xmlhttp.send();
	});
}


function openSearchXMLToSearchEngine(xml) {
		
	let se = {};

	let shortname = xml.documentElement.querySelector("ShortName");
	if (shortname) se.title = shortname.textContent;
	else reject();
	
	let description = xml.documentElement.querySelector("Description");
	if (description) se.description = description.textContent;
	else reject();
	
	let inputencoding = xml.documentElement.querySelector("InputEncoding");
	if (inputencoding) se.queryCharset = inputencoding.textContent.toUpperCase();
	
	let url = xml.documentElement.querySelector("Url[template]");
	if (!url) reject();
	
	let template = url.getAttribute('template');
	if (template) se.template = se.query_string = template;
	
	let searchform = xml.documentElement.querySelector("moz\\:SearchForm");
	if (searchform) se.searchForm = searchform.textContent;
	else if (template) se.searchForm = new URL(template).origin;
	
	let image = xml.documentElement.querySelector("Image");
	if (image) se.icon_url = image.textContent;
	else se.icon_url = new URL(template).origin + '/favicon.ico';
	
	let method = url.getAttribute('method');
	if (method) se.method = method.toUpperCase() || "GET";

	let params = [];
	for (let param of url.getElementsByTagName('Param')) {
		params.push({name: param.getAttribute('name'), value: param.getAttribute('value')})
	}
	se.params = params;
	
	if (se.params.length > 0 && se.method === "GET") {
		se.query_string = se.template + ( (se.template.match(/[=&\?]$/)) ? "" : "?" ) + nameValueArrayToParamString(se.params);
	}
	
	se.id = gen();

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}

// note: returns a promise to loadRemoteIcons
function dataToSearchEngine(data) {
	
	// useful when using page_action to trigger custom search iframe
	if (!data) return null;

	let favicon_href = data.favicon_href || "";

	let query_string = "";
	let params = [];
	
	// convert single object to array
	for (let k in data.params)
		params.push({name: k, value: data.params[k]});

	if (data.method === "GET" && data.query) {
		
		let param_str = data.query + "={searchTerms}";

		for (let i in data.params) {
			param_str+="&" + i + "=" + data.params[i];
		}
		// If the form.action already contains url parameters, use & not ?
		query_string = data.action + ((data.action.indexOf('?') === -1) ? "?":"&") + param_str;	
		
	} else {
		// POST form.template = form.action
		query_string = data.action;
		
		if (data.query)
			params.unshift({name: data.query, value: "{searchTerms}"});

	}
	
	// build search engine from form data
	let se = {
		"searchForm": data.origin, 
		"query_string":query_string,
		"icon_url": data.favicon_href || data.origin + "/favicon.ico",
		"title": data.title,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": "", 
		"method": data.method, 
		"params": params, 
		"template": data.action, 
		"queryCharset": data.characterSet.toUpperCase(),
		"description": data.description,
		"id": gen()
	};

	return loadRemoteIcon({
		searchEngines: [se],
		timeout:5000
	});

}
