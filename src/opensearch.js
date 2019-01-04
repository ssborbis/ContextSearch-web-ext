function replaceOpenSearchParams(options) {
	
//	in_str, searchterms, url
	// replace OpenSearch params
	template 	= options.template || "";
	searchterms = options.searchterms || "";
	url 		= options.url || "";
	userdomain 	= options.domain || ""
	
	let domains = getDomains(url);
	
//	console.log(domain);
		
	return template
		.replace(/{searchTerms}/g, searchterms)
		.replace(/{count[\?]?}/g, "50")
		.replace(/{startIndex[\?]?}/g, "1")
		.replace(/{startPage[\?]?}/g, "1")
		.replace(/{language[\?]?}/g, (navigator) ? navigator.language || navigator.userLanguage : "")
		.replace(/{inputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{outputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{subdomain}/g, domains.subdomain || "")
		.replace(/{domain}/g, domains.domain || "")
		.replace(/{selectdomain}/g, userdomain || "")
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

function isCanvasBlank(canvas) {
    var blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;

    return canvas.toDataURL() == blank.toDataURL();
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
	
	// return numeric ip as-is
	if ( /\d+\.\d+\.\d+\.\d+/.test(url) ) return {domain:_URL.hostname, subdomain:_URL.hostname};

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






