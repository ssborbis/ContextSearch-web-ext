var defaultEngines = [
	{
		"searchForm": "https://www.google.com/",
		"template": "https://www.google.com/search?q={searchTerms}",
		"icon_url": "http://google.com/favicon.ico",
		"title": "Google",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://www.amazon.com/",
		"template": "https://www.amazon.com/exec/obidos/external-search/?field-keywords={searchTerms}&ie={inputEncoding}&mode=blended",
		"icon_url": "https://www.amazon.com/favicon.ico",
		"title": "Amazon.com",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://www.facebook.com/",
		"template": "https://www.facebook.com/search/top/?q={searchTerms}&opensearch=1",
		"icon_url": "http://facebook.com/favicon.ico",
		"title": "Facebook",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "http://www.youtube.com",
		"template": "http://www.youtube.com/results?search_type=search_videos&search_query={searchTerms}&search_sort=relevance&search_category=0&page={startPage?}",
		"icon_url": "http://youtube.com/favicon.ico",
		"title": "YouTube",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://twitter.com/",
		"template": "https://twitter.com/search?q={searchTerms}&source=desktop-search",
		"icon_url": "http://twitter.com/favicon.ico",
		"title": "Twitter",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "http://www.pinterest.com/search/pins/",
		"template": "http://www.pinterest.com/search/pins/?q={searchTerms}",
		"icon_url": "http://pinterest.com/favicon.ico",
		"title": "Pinterest",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://www.bing.com/",
		"template": "https://www.bing.com/search?q={searchTerms}",
		"icon_url": "http://bing.com/favicon.ico",
		"title": "Bing",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://duckduckgo.com/",
		"template": "https://duckduckgo.com/?q={searchTerms}",
		"icon_url": "http://duckduckgo.com/favicon.ico",
		"title": "DuckDuckGo",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://www.ebay.com/",
		"template": "https://www.ebay.com/sch/i.html?_nkw={searchTerms}",
		"icon_url": "http://ebay.com/favicon.ico",
		"title": "eBay",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://en.wikipedia.org/",
		"template": "https://en.wikipedia.org/wiki/Special:Search?search={searchTerms}",
		"icon_url": "http://wikipedia.org/favicon.ico",
		"title": "Wikipedia (en)",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://images.google.com/",
		"template": "https://www.google.com/searchbyimage?site=search&image_url={searchTerms}",
		"icon_url": "http://icons.iconarchive.com/icons/designbolts/3d-social/256/Google-plus-icon.png",
		"title": "Google Reverse Image Search",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	},
	{
		"searchForm": "https://www.google.com",
		"template": "https://www.google.com/search?q=site%3A{selectdomain}+{searchTerms}",
		"icon_url": "https://www.google.com/images/branding/product/ico/googleg_lodp.ico",
		"title": "Google Site Search",
		"icon_base64String": "",
		"method": "GET",
		"params": [],
		"queryCharset": "UTF-8",
		"hidden": false
	}
];