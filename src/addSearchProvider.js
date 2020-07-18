function getSearchProviderUrlByTitle(title) {
	let link = document.head.querySelector(`link[rel="search"][title="${title}"]`);	
	return link ? link.href : null;
}

function setFavIconUrl(url) {
    var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = url;
    document.getElementsByTagName('head')[0].appendChild(link);
}

function addSearchProvider(url) {
	
	let link = document.createElement('link');
	link.rel = "search";
	link.type = "application/opensearchdescription+xml";
	link.href = url;

	let match = /SHORTNAME=(.*?)&DESCRIPTION/.exec(url);	
	if (!match[1]) return;

	link.title = decodeURIComponent(match[1]);
	
	document.head.appendChild(link);
	
	if ( userOptions.addSearchProviderHideNotification ) return;

	let div = document.createElement('div');
	div.style="position:fixed;top:0;right:0;background-color:rgba(200,200,200,.8);padding:20px;z-index:2147483647;width:220px;text-align:center;opacity:0;transition:opacity .5s ease-out";
	let img = new Image();
	img.src = browser.runtime.getURL('icons/AddSearchProvider.png');
	img.style.width = "200px";
	div.appendChild(img);
	div.appendChild(document.createElement('hr'));
	div.appendChild(document.createTextNode(browser.i18n.getMessage("addusingfirefoxsearchbar")));
	
	let cb = document.createElement('input');
	cb.type = "checkbox";
	cb.onchange = function() {
		userOptions.addSearchProviderHideNotification = cb.checked;
		browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	}
	div.appendChild(document.createElement('br'));
	div.appendChild(document.createElement('br'));
	div.appendChild(cb);
	div.appendChild(document.createTextNode(" Don't show this again"));
	
	document.body.appendChild(div);
	div.onclick = () => {
		div.style.opacity = 0;
		setTimeout(() => div.parentNode.removeChild(div), 500);
	}
	document.addEventListener('click', () => div.click(), {once: true});
	div.getBoundingClientRect();
	div.style.opacity = 1;
}