var userOptions = {};

function readOpenSearchUrl(url, callback) {
	callback = callback || function() {};
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
				callback(parsed);
		   } else {
			   console.log('Error fetching ' + url);
		   }
		}
	}
	
	xmlhttp.ontimeout = function (e) {
		console.log('Timeout fetching ' + url);
		callback(false);
	};

	xmlhttp.open("GET", url, true);
	xmlhttp.timeout = 2000;
	xmlhttp.send();
}

function openSearchXMLToSearchEngine(xml) {
		
	return new Promise( (resolve, reject) => {	
	
		let se = {};
		
		let shortname = xml.documentElement.querySelector("ShortName");
		if (shortname) se.title = shortname.textContent;
		else reject();
		
		let description = xml.documentElement.querySelector("Description");
		if (description) se.description = description.textContent;
		else reject();
		
		let inputencoding = xml.documentElement.querySelector("InputEncoding");
		if (inputencoding) se.queryCharset = inputencoding.textContent.toUpperCase();
			
		let searchform = xml.documentElement.querySelector("moz\\:SearchForm");
		if (searchform) se.searchForm = searchform.textContent;
		
		let url = xml.documentElement.querySelector("Url[template]");
		if (url);
		else reject();
		
		let template = url.getAttribute('template');
		if (template) se.template = se.query_string = template;
		
		let image = xml.documentElement.querySelector("Image");
		if (image) se.icon_url = image.textContent;
		else se.icon_url = new URL(template).origin + '/favicon.ico';
		
		let method = url.getAttribute('method');
		if (method) se.method = method.toUpperCase();

		let params = [];
		for (let param of url.getElementsByTagName('Param')) {
			params.push({name: param.getAttribute('name'), value: param.getAttribute.value})
		}
		se.params = params;
		
		loadRemoteIcons({
			searchEngines: [se],
			timeout:5000, 
			callback: resolve
		});
		
	});

}

function formToSearchEngine() {
	
	let form = document.getElementById('customForm');
	return {
		"searchForm": form.searchform.value, 
		"query_string":form.template.value,
		"icon_url":form.iconURL.value,
		"title":form.shortname.value,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": imageToBase64(form.icon, 32), 
		"method": form._method.value, 
		"params": paramStringToNameValueArray(form.post_params.value), 
		"template": form.template.value, 
		"queryCharset": form._encoding.value, 
		"hidden": false
	};
}

function dataToSearchEngine(data) {
		
	let openSearchHref = data.openSearchHref;
	let favicon_href = data.favicon_href;
	let _location = new URL(data.href);

	// check data object
	data.name = data.name || "";
	data.action = data.action || "";//_location.href;
	data.params = data.params || {};
	data.method = data.method.toUpperCase() || "GET";
	
	let template = "";
	let param_str = data.query + "={searchTerms}";

	for (let i in data.params) {
		param_str+="&" + i + "=" + data.params[i];
	}
	
	if (data.method === "GET") {
		// If the form.action already contains url parameters, use & not ?
		template = data.action + ((data.action.indexOf('?') === -1) ? "?":"&") + param_str;	
	} else {
		// POST form.template = form.action
		template = data.action;
	}
	
	// build search engine from form data
	let se = {
		"searchForm": _location.origin, 
		"query_string":template,
		"icon_url": _location.origin + "/favicon.ico",
		"title": document.title,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": "", 
		"method": data.method, 
		"params": param_str, 
		"template": template, 
		"queryCharset": document.characterSet.toUpperCase()
	};
	
	return new Promise( (resolve, reject) => {
		loadRemoteIcons({
			searchEngines: [se],
			timeout:5000, 
			callback: resolve
		});
	});

}

function hasDuplicateName(name) {

	for (let se of userOptions.searchEngines)
		if (se.title == name) return true;
	
	return false;
}

function expandElement(el) {
	
	// get by node or id
	el = (el.nodeType) ? el : document.getElementById(el);
	
	if (!el) return;
	
	el.style.zIndex = -1;
	el.style.visibility = 'hidden';
	let transition = window.getComputedStyle(el).transition;
	el.style.transition = 'none';
	el.style.maxHeight = 'none';
	
	let height = window.getComputedStyle(el).height;
	
	el.style.maxHeight = '0px';
	window.getComputedStyle(el).maxHeight;
	el.style.visibility = null;
	el.style.zIndex = null;
	el.style.transition = null;
	el.style.maxHeight = height;
}

function showMenu(el) {
	
	el = (el.nodeType) ? el : document.getElementById(el);

	for (let child of el.parentNode.children)
		child.style.maxHeight = '0px';
	
	expandElement(el);
	
}

function buildOpenSearchAPIUrl() {
	
	let form = document.getElementById('customForm');
	
	if (!form) return false;
	
	// build the URL for the API
	return "https://opensearch-api.appspot.com" 
		+ "?SHORTNAME=" + encodeURIComponent(form.shortname.value) 
		+ "&DESCRIPTION=" + encodeURIComponent(form.description.value) 
		+ "&TEMPLATE=" + encodeURIComponent(encodeURI(form.template.value)) 
		+ "&POST_PARAMS=" + encodeURIComponent(form.post_params.value) 
		+ "&METHOD=" + form._method.value 
		+ "&ENCODING=" + form._encoding.value 
		+ "&ICON=" + encodeURIComponent(encodeURI(form.iconURL.value)) 
		+ "&ICON_WIDTH=" + (form.icon.naturalWidth || 16) 
		+ "&ICON_HEIGHT=" + (form.icon.naturalHeight || 16) 
		+ "&SEARCHFORM=" + encodeURIComponent(encodeURI(form.searchform.value))
		+ "&VERSION=" + encodeURIComponent(browser.runtime.getManifest().version);
}

function addSearchEnginePopup(data) {

	// if page offers an opensearch engine, grab the xml and copy the name into the simple form
	if (data.openSearchHref) {
		
		readOpenSearchUrl( data.openSearchHref, (xml) => {
			
			if (!xml) return false;

			openSearchXMLToSearchEngine(xml).then((details) => {
				
				if (!details) {
					console.log('Cannot build search engine from xml. Missing values');
					return false;
				}
			
				let se = details.searchEngines[0];
				
				if (se.title) 
					document.getElementById('simple').querySelector('input').value = se.title;
				
			});
			
		});
		
	} else if (data.name) {
		document.getElementById('simple').querySelector('input').value = data.name;
	} 

	//setup buttons
	document.getElementById('a_simple_moreOptions').onclick = function() {
		showMenu('CS_customSearchDialogOptions');
	}
	
	document.getElementById('a_simple_fewerOptions').onclick = function() {
		showMenu('simple');
	}
	
	document.getElementById('b_simple_add').onclick = function() {
		
		let el = document.getElementById('simple');
		let input = el.querySelector('input')
		let shortname = input.value;
		
		// check if name exists and alert
		if (hasDuplicateName(shortname)) {
			el.querySelector('label').firstChild.textContent = browser.i18n.getMessage("NameExists");
			el.querySelector('label').style.color = 'red';
			input.style.borderColor = 'pink';
			return;
		}
		
		if (!shortname.trim()) {
			el.querySelector('label').firstChild.textContent = browser.i18n.getMessage("NameInvalid");
			el.querySelector('label').style.color = 'red';
			input.style.borderColor = 'pink';
			return;
		}
		
		document.getElementById('customForm').shortname.value = shortname;

		dataToSearchEngine(data).then( (details) => {
			let se = details.searchEngines[0];
			se.title = shortname;

			browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: details.searchEngines[0]});

			// reassign the yes button to add official OpenSearch xml
			document.getElementById('b_simple_import_yes').onclick = function() {
				let url = buildOpenSearchAPIUrl();
				simpleImportHandler(url, true);
			}
			showMenu('simple_import');

		});

	}
	
	function simpleImportHandler(url, _confirm) {
		
		if (!url) return;
		
		let el = document.getElementById('simple_import');
		
		browser.runtime.sendMessage({action: "addSearchEngine", url:url});

		el.style.pointerEvents = 'none';
		el.querySelector('[name="yes"]').querySelector('img').src = '/icons/spinner.svg';
		
		window.addEventListener('focus', () => {
			el.style.pointerEvents = null;
			el.querySelector('[name="yes"]').querySelector('img').src = '/icons/checkmark.png';
			
			if (_confirm) {

				let simple_confirm = document.getElementById('simple_confirm');
				simple_confirm.querySelector('[name="yes"]').onclick = function() {
					closeCustomSearchIframe();
				}
				
				simple_confirm.querySelector('[name="no"]').onclick = function() {
					
					// remove the new engine
					browser.runtime.sendMessage({action: "removeContextSearchEngine", index: userOptions.searchEngines.length - 1});
					
					showMenu('simple_remove');
					setTimeout(() => {
						showMenu('customForm');
					}, 1000);
				}
				
				showMenu(simple_confirm);
				return;
			}
			
			closeCustomSearchIframe();
		}, {once: true});
	}

	document.getElementById('b_simple_import_yes').onclick = function(e) {	
		console.log('default onclick - assign at showMenu');
	}
	
	document.getElementById('b_simple_import_no').onclick = function() {
		closeCustomSearchIframe();
	}
	
	document.getElementById('b_simple_error_yes').onclick = function() {
		showMenu('CS_customSearchDialogOptions');
		
		// hide the simple button to prevent user from attempting to add invalid search engine
		document.getElementById('a_simple_fewerOptions').style.display = 'none';
	}
	
	document.getElementById('b_simple_error_no').onclick = function() {
		closeCustomSearchIframe();
	}
	
	let openSearchHref = data.openSearchHref;
	let favicon_href = data.favicon_href;
	let _location = new URL(data.href);
	
	// close iframe when clicking anywhere in the window
	document.addEventListener('click', (e) => {
		if ( document.body.contains(e.target) ) return false;	
		closeCustomSearchIframe();
	});

	// Build tooltips
	let info_msg = document.createElement('div');
	info_msg.id = "CS_info_msg";
	document.body.appendChild(info_msg);
	
	for (let info of document.getElementsByClassName('CS_info')) {
		info.addEventListener('mouseenter', (e) => {
			info_msg.innerText = info.dataset.msg;
			info_msg.style.top = info.getBoundingClientRect().top + window.scrollY + 'px';
			info_msg.style.left = info.getBoundingClientRect().left + window.scrollX + 20 + 'px';
			info_msg.style.display = 'block';
			info.getBoundingClientRect();
			info_msg.style.opacity = 1;
		});
		
		info.addEventListener('mouseleave', (e) => {
			info_msg.style.opacity = 0;
			setTimeout(() => {
				info_msg.style.display = 'none';
			},250);
		});
	}

	// probably a bad form
	if (!data.query) {
		// placeholder
	}
		
	// check data object
	data.name = data.name || "";
	data.action = data.action || "";//_location.href;
	data.params = data.params || {};
//		data.query = data.query || "q";
	
	let form = document.getElementById('customForm');
	
	// Set method (FORM.method is a default property, using _method)
	for (let i=0;i<form._method.options.length;i++) {
		if (data.method !== undefined && data.method.toUpperCase() === form._method.options[i].value) {
			form._method.selectedIndex = i;
			break;
		}
	}

	// set form fields based on injected code (getform.js)
	form.description.innerText = data.description;
	form.shortname.value = data.name;
	form.searchform.value = _location.origin;
	
	let template = data.action;
	let param_str = data.query + "={searchTerms}";

	for (let i in data.params) {
		param_str+="&" + i + "=" + data.params[i];
	}
	
	if (form._method.value === "GET") {
		
		// If the form.action already contains url parameters, use & not ?
		form.template.innerText = template + ((template.indexOf('?') === -1) ? "?":"&") + param_str;
		
		// display help message if <input> is not part of a proper <form>
		if (!data.action) form.template.innerText = browser.i18n.getMessage("TemplateMissingeMessage");
		
	} else {
		
		// POST form.template = form.action
		form.template.innerText = template;
		form.post_params.value = param_str;
		
	}

	// data-type images are invalid, replace with generic favicon.ico
	let favicon_url = (favicon_href && favicon_href.match(/^data/) === null) ? favicon_href : _location.origin + "/favicon.ico";

	// Listen for updates to iconURL, replace img.src and disable sending OpenSearch.xml request until loaded
	form.iconURL.addEventListener('change', (ev) => {
		form.icon.src = form.iconURL.value;
		
		form.add.disabled = true;
		var loadingIconInterval = setInterval(() => {
			if (!form.icon.complete) return;
			
			clearInterval(loadingIconInterval);
			form.add.disabled = false;

		},100);
	});
	
	// get the favicon
	form.icon.src = favicon_url;
	form.iconURL.value = favicon_url;

	// Set encoding field based on document.characterSet
	for (let i=0;i<form._encoding.options.length;i++) {

		if (document.characterSet.toUpperCase() === form._encoding.options[i].value) {
			form._encoding.selectedIndex = i;
			break;
		}
	}

	// Get option buttons and add description widget
	let buttons = document.querySelectorAll(".CS_menuItem > div");
	for (let button of buttons) {
		
		if (!button.dataset.msg) continue;

		// display button description
		button.addEventListener('mouseenter', (ev) => {
			let desc = button.parentNode.querySelector('.CS_optionDescription');
			desc.style.transition='none';
			desc.style.opacity=window.getComputedStyle(desc).opacity;
			desc.style.opacity=0;
			desc.innerText = button.dataset.msg;
			desc.style.transition=null;
			desc.style.opacity=1;
		});
		
		// hide button description
		button.addEventListener('mouseleave', (ev) => {
			button.parentNode.querySelector('.CS_optionDescription').style.opacity=0;
		});
	}

	// Set up official add-on if exists
	if (openSearchHref) {
		let div = document.getElementById('CS_optionInstallOfficialEngine');
		
		// Add button
		div.onclick = function() {
			
			readOpenSearchUrl( data.openSearchHref, (xml) => {

				if (!xml) {
					alert(browser.i18n.getMessage("ErrorParsing").replace("%1", data.openSearchHref));
					return;
				}
				
				openSearchXMLToSearchEngine(xml).then((details) => {
					
					let se = details.searchEngines[0];
				
					if (!se) {
						alert(browser.i18n.getMessage("ErrorParsing").replace("%1", data.openSearchHref));
						return;
					}
					
					if (hasDuplicateName(se.title)) {
						alert(browser.i18n.getMessage("EngineExists").replace("%1", se.title));
						return;
					}
					
				//	alert('adding search engine built from officla xml');
					 browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: se}).then((response) => {
						// // console.log(response);
					});
					
					// reassign the yes button to add official OpenSearch xml
					document.getElementById('b_simple_import_yes').onclick = function() {
						simpleImportHandler(data.openSearchHref);
					}
					
					showMenu('simple_import');
					
				});

			});
			
		}
		
		// Show button
		div.style.display=null;
	
	} 
	
	// Find Plugin listener
	document.getElementById('CS_customSearchDialog_d_mycroftSearchEngine').onclick = function() {
		listenForFocusAndPromptToImport();
		window.open("http://mycroftproject.com/search-engines.html?name=" + _location.hostname, "_blank");
	}
	
	// Form test
	form.test.onclick = function() {
		testOpenSearch(form);
	}
	
	// Form cancel
	form.cancel.onclick = function() {
		showMenu('CS_customSearchDialogOptions');
	}

	// Form submit
	form.add.onclick = function(ev) {
		
		// Check bad form values
		if (form.shortname.value.trim() == "") {
			alert(browser.i18n.getMessage("NameInvalid"));
			return;
		}
		for (let se of userOptions.searchEngines) {
			if (se.title == form.shortname.value) {
				alert(browser.i18n.getMessage("EngineExists").replace("%1",engine.title) + " " + browser.i18n.getMessage("EnterUniqueName"));
				return;
			}
		}
		if (form.description.value.trim() == "") {
			alert(browser.i18n.getMessage("DescriptionEmptyError"));
			return;
		}
		if (form.description.value.length > 1024 ) {
			alert(browser.i18n.getMessage("DescriptionSizeError"));
			return;
		}
		if (form.post_params.value.indexOf('{searchTerms}') === -1 && form.template.value.indexOf('{searchTerms}') === -1) {
			alert(browser.i18n.getMessage("TemplateIncludeError"));
			return;
		}
		if (form.template.value.match(/^http/i) === null) {
			alert(browser.i18n.getMessage("TemplateURLError") + ' (' + _location.origin + '...)');
			return;
		}
		if (form.searchform.value.match(/^http/i) === null) {
			alert(browser.i18n.getMessage("FormPathURLError") + ' (' + _location.origin + ')');
			return;
		}
		if (form.iconURL.value.match(/^http/i) === null || form.iconURL.value == "") {
			alert(browser.i18n.getMessage("IconURLError") + ' (' + _location.origin + '/favicon.ico)');
			return;
		}

		let se = formToSearchEngine();
		
	//	alert('Adding search engine from custom form');
	
		browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: se}).then((response) => {
	//		console.log(response);
		});
		
		// reassign the yes button to add form OpenSearch xml
		document.getElementById('b_simple_import_yes').onclick = function() {
			let url = buildOpenSearchAPIUrl();
			simpleImportHandler(url, true);
		}
		
		showMenu('simple_import');
	}
	
	// Custom button listener
	document.getElementById('CS_customSearchDialog_d_custom').onclick = function() {
		showMenu(form);
	}

	if (data.name)
		showMenu('simple');
	else
		showMenu('simple_error');
}

function testOpenSearch(form) {

	let params = [];

	console.log(params);
	
	params = paramStringToNameValueArray(form.post_params.value);

	let tempSearchEngine = {
		"searchForm": form.searchform.value, 
		"query_string":form.template.value,
		"icon_url": form.iconURL.value,
		"title": form.shortname.value,
		"order":"", 
		"icon_base64String": "", 
		"method": form._method.value, 
		"params": params, 
		"template": form.template.value, 
		"queryCharset": form._encoding.value
	};

	let searchTerms = window.prompt(browser.i18n.getMessage("EnterSearchTerms"),"firefox");
	
	browser.runtime.sendMessage({"action": "testSearchEngine", "tempSearchEngine": tempSearchEngine, "searchTerms": searchTerms});
	
}

// Close button listener
function closeCustomSearchIframe() {
	for (let el of document.getElementsByClassName('CS_menuItem')) {
		el.style.maxHeight = '0px';
	}
	setTimeout(() => {
		browser.runtime.sendMessage({action: "closeCustomSearch"});
	},250);
}

function listenForNewSearchEngines() {
	
	var nativeAppInterval = null;
	
	function handler(e) {
		if (e.detail) { // if search engines length has changed
		
			// remove the listener
			document.removeEventListener('getUserOptionsEvent', handler);
			
			// clear the interval
			clearInterval(nativeAppInterval);
			
			// show auto notification
			showMenu('CS_notifyAutomaticUpdated');
			
			// close iframe after x milliseconds
			setTimeout(closeCustomSearchIframe, 2000);
		}	
	}
	
	// attach listener on blur
	window.addEventListener('blur', () => {
		document.addEventListener('getUserOptionsEvent', handler);
	}, {once: true});
	
	// attach actions and timeout on focus
	window.addEventListener('focus', () => {

		// run a native app check on a 1s interval.
		nativeAppInterval = setInterval(() => {
			browser.runtime.sendMessage({action: "nativeAppRequest"});
		}, 1000);
		
		// timeout after x seconds and clear the listener and interval
		setTimeout(() => {
//			console.log('getUserOptionsEvent listener timeout');
			clearInterval(nativeAppInterval);
			document.removeEventListener('getUserOptionsEvent', handler);
		},5000);
		
	}, {once: true});
}

function listenForFocusAndPromptToImport() {

	if (userOptions.reloadMethod === 'automatic') {
		listenForNewSearchEngines();
		return;
	}
	
	let dialog = document.getElementById('CS_postSearchEngineInstall');
	
	dialog.querySelector('[name="import"]').onclick = function() {
		browser.runtime.sendMessage({action: "openOptions", hashurl:"#quickload"});
		closeCustomSearchIframe();	
	}
	
	window.addEventListener('focus', () => {
		
		dialog.querySelector('[name="moreInfo"]').onclick = function() {
			browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=help#help_importing"});
		}
		
		showMenu(dialog);
		
		dialog.querySelector('[name="cancel"]').onclick = function() {
			showMenu('CS_customSearchDialogOptions');
		}
		
	}, {once: true});
	
}

// i18n string replacement and styles
document.addEventListener('DOMContentLoaded', () => {

	function traverse(node) {
		
		if (node.nodeType === 3 && node.nodeValue.trim())
			return node;

		for (let child of node.childNodes) {
			let c = traverse(child);
			if (c) return c;
		}
		
		return false;
	}
	
	let i18n = document.querySelectorAll('[data-i18n]');
	
	for (let el of i18n) {

		let textNode = traverse(el);
		
		textNode.nodeValue = browser.i18n.getMessage(el.dataset.i18n);
	}
	
	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
	for (let el of i18n_tooltips) {
		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip');
	}
	
	console.log(browser.i18n.getUILanguage());
	
	var link = document.createElement( "link" );
	link.href = browser.runtime.getURL('/_locales/' + browser.i18n.getUILanguage() + '/style.css');
	link.type = "text/css";
	link.rel = "stylesheet";
	document.getElementsByTagName( "head" )[0].appendChild( link );
	
});

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

browser.runtime.sendMessage({action: "getFormData"}).then((message) => {
	addSearchEnginePopup(message.data);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.userOptions !== undefined) {

		document.dispatchEvent(new CustomEvent('getUserOptionsEvent', {
				
				// if search engines length has changed, true else false
				detail: ( userOptions.searchEngines.length !== message.userOptions.searchEngines.length )
			}
		));
		
		userOptions = message.userOptions || {};
	}
});
