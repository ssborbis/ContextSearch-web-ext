function replaceOpenSearchParams(in_str, searchterms) {
	// replace OpenSearch params
	searchterms = searchterms || "";
	
	return in_str
		.replace(/{searchTerms}/g, searchterms)
		.replace(/{count[\?]?}/g, "50")
		.replace(/{startIndex[\?]?}/g, "1")
		.replace(/{startPage[\?]?}/g, "1")
		.replace(/{language[\?]?}/g, (navigator) ? navigator.language || navigator.userLanguage : "")
		.replace(/{inputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{outputEncoding[\?]?}/g, (document) ? document.characterSet || "" : "")
		.replace(/{.+?\?}/g,"") // optionals
		.replace(/{moz:.+?}/g, "") // moz specific
		.replace(/{.+?}/g, ""); // all others
}

function nameValueArrayToParamString(arr) {
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
//	maxSize = maxSize || 32;

	let c = document.createElement('canvas');
	let ctx = c.getContext('2d');
	ctx.canvas.width = image.naturalWidth || 16;
	ctx.canvas.height = image.naturalHeight || 16;
	try {
		ctx.drawImage(image, 0, 0);
	/*	
		if (image.naturalWidth > maxSize || image.naturalHeight > maxSize) {
			let whichIsLarger = (image.naturalWidth > image.naturalHeight) ? image.naturalWidth : image.naturalHeight;
			let scalePercent = maxSize / whichIsLarger;
			
			ctx.scale(scalePercent, scalePercent);
		}
	*/	
		return c.toDataURL();
	} catch (error) {
		return "";
	}
}
