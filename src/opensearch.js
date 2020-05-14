function replaceOpenSearchParams(options) {
	
	// replace OpenSearch params
	template 	= options.template || "";
	searchterms = options.searchterms || "";
	url 		= options.url || "";
	userdomain 	= options.domain || ""
	
	let domains = getDomains(url);
	
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

function getDomainPaths(_url) {

	let url;
	
	if ( typeof _url === 'string' ) url = new URL(_url);
	else if ( _url instanceof URL ) url = _url;
	else {
		console.log(typeof _url, "cannot be read as url");
		return [];
	}
	
	let pathname = url.pathname.charAt(url.pathname.length - 1) === '/' ? url.pathname.slice(0, -1) : url.pathname;
		
	let pathParts = pathname.split('/');

	if (pathParts[pathParts.length - 1].indexOf('.') !== -1 ) pathParts.pop();

	let paths = [];

	for ( let i=0;i<pathParts.length;i++)
		paths.push( url.hostname + pathParts.slice(0,i+1).join('/') );
	
	// add domain if subdomain
	let domains = getDomains(url.href);
	let domain = domains.domain;
	
	if ( !paths.includes( domain ) )
		paths.unshift(domain);
	
	return paths;
}