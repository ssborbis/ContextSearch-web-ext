function replaceOpenSearchParams(in_str, searchterms) {
	// replace OpenSearch params
	searchterms = searchterms || "";
	
	return in_str
		.replace(/{searchTerms}/g, searchterms.trim())
		.replace(/{count[\?]?}/g, "50")
		.replace(/{startIndex[\?]?}/g, "1")
		.replace(/{startPage[\?]?}/g, "1")
		.replace(/{language[\?]?}/g, navigator.language || navigator.userLanguage)
		.replace(/{inputEncoding[\?]?}/g, document.characterSet)
		.replace(/{outputEncoding[\?]?}/g, document.characterSet)
		.replace(/{.+?\?}/g,"") // optionals
		.replace(/{moz:.+?}/g, "") // moz specific
		.replace(/{.+?}/g, ""); // all others
}