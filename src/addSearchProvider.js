function addSearchProvider(url) {
	
	//url = "https://opensearch-api.appspot.com/?SHORTNAME=test%20xml&DESCRIPTION=Your%20customizable%20and%20curated%20collection%20of%20the%20best%20in%20trusted%20news%20plus%20coverage%20of%20sports%2C%20entertainment%2C%20money%2C%20weather%2C%20travel%2C%20health%20and%20lifestyle%2C%20combined%20with%20Outlook%2FHotmail%2C%20Facebook%2C%20Twitter%2C%20Bing%2C%20Skype%20and%20more.&TEMPLATE=https%3A%2F%2Fwww.bing.com%2Fsearch%3Fscope%3Dweb%26q%3D%257BsearchTerms%257D%26form%3DPRUSEN%26mkt%3Den-us%26httpsmsn%3D1%26msnews%3D1%26rec_search%3D1%26refig%3D54e16d2a44f04866b50bde7761f52050&POST_PARAMS=&METHOD=GET&ENCODING=UTF-8&ICON=https%3A%2F%2Fstatic-global-s-msn-com.akamaized.net%2Fhp-eus%2Fsc%2F2b%2Fa5ea21.ico&ICON_WIDTH=32&ICON_HEIGHT=32&SEARCHFORM=https%3A%2F%2Fwww.msn.com&VERSION=1.23";

	let link = document.createElement('link');
	link.rel = "search";
	link.type = "application/opensearchdescription+xml";
	
	link.href = url;
	
	console.log(url);
	
	let match = /SHORTNAME=(.*?)&DESCRIPTION/.exec(url);
	
	if (match[1]) {
		console.log(match[1]);
		link.title = decodeURIComponent(match[1]);
		document.head.appendChild(link);
	}
}