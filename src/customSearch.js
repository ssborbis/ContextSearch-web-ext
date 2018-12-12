

let isFirefox = navigator.userAgent.match('Firefox') ? true : false;

var userOptions = {};

function formToSearchEngine() {
	
	let form = document.getElementById('customForm');
	return {
		"searchForm": form.searchform.value, 
		"description": form.description.value,
		"query_string":form.template.value,
		"icon_url":form.iconURL.value,
		"title":form.shortname.value,
		"order":userOptions.searchEngines.length, 
		"icon_base64String": imageToBase64(form.icon, 32), 
		"method": form._method.value, 
		"params": paramStringToNameValueArray(form.post_params.value), 
		"template": form.template.value, 
		"queryCharset": form._encoding.value, 
		"hidden": false,
		"id": gen()
		
	};
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
	
	// encode param values before encoding whole string
	let params = paramStringToNameValueArray(form.post_params.value);	
	for (let i=0;i<params.length;i++) {
		params[i].value = encodeURIComponent(params[i].value);
	}	
	let param_str = nameValueArrayToParamString(params);
	
	// build the URL for the API
	return "https://opensearch-api.appspot.com" 
		+ "?SHORTNAME=" + encodeURIComponent(form.shortname.value) 
		+ "&DESCRIPTION=" + encodeURIComponent(form.description.value) 
		+ "&TEMPLATE=" + encodeURIComponent(encodeURI(form.template.value)) 
//		+ "&POST_PARAMS=" + encodeURIComponent(form.post_params.value) 
		+ "&POST_PARAMS=" + encodeURIComponent(param_str) 
		+ "&METHOD=" + form._method.value 
		+ "&ENCODING=" + form._encoding.value 
		+ "&ICON=" + encodeURIComponent(encodeURI(form.iconURL.value)) 
		+ "&ICON_WIDTH=" + (form.icon.naturalWidth || 16) 
		+ "&ICON_HEIGHT=" + (form.icon.naturalHeight || 16) 
		+ "&SEARCHFORM=" + encodeURIComponent(encodeURI(form.searchform.value))
		+ "&VERSION=" + encodeURIComponent(browser.runtime.getManifest().version);
}

function addSearchEnginePopup(data) {

	let se = data.searchEngine || null;
	let openSearchUrl = data.openSearchUrl || null;
	let useOpenSearch = data.useOpenSearch || null;
	let _location = new URL(data.location) || null;
	
	let simple = document.getElementById('simple');
	
//	console.log(se);
	
	// if page offers an opensearch engine, grab the xml and copy the name into the simple form
	let ose = null;
	
	// no need to request another copy of the opensearch.xml if already using an os engine
	if (useOpenSearch) {
		
		ose = se;
		
		if (se.title) 
			simple.querySelector('input').value = se.title;
		
	} else {
		if (openSearchUrl) {
			
			readOpenSearchUrl( openSearchUrl ).then ((xml) => {

				if (!xml) return false;

				return openSearchXMLToSearchEngine(xml).then((details) => {
					
					if (!details) {
						console.log('Cannot build search engine from xml. Missing values');
						return false;
					}
				
					let se = details.searchEngines[0];
					ose = se;
					
					if (se.title) 
						simple.querySelector('input').value = se.title;
					
				});
				
			}, () => {
				console.log('error');
				simple.querySelector('input').value = se.title;
			});

			
		} else 
			simple.querySelector('input').value = se.title;
	}
		
	

	//setup buttons
	document.getElementById('a_simple_moreOptions').onclick = function() {

		if (isFirefox /* firefox */ )
			showMenu('CS_customSearchDialogOptions');
		else
			showMenu('customForm');

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

		browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: formToSearchEngine()});

		if ( isFirefox /* firefox */) {
			// reassign the yes button to add official OpenSearch xml
			document.getElementById('b_simple_import_yes').onclick = function() {

				// build the GET url for opensearch-api.appspot.com
				let url = buildOpenSearchAPIUrl();

				// if using OpenSearch engine and name has not changed, use url to OpenSearch.xml
				if (useOpenSearch && shortname === ose.title)
					url = openSearchUrl;
				
				simpleImportHandler(url, true);
			}
			showMenu('simple_import');
		} else {
			closeCustomSearchIframe();
		}

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
					browser.runtime.sendMessage({action: "removeContextSearchEngine", id: userOptions.searchEngines[userOptions.searchEngines.length - 1].id});
					
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
	
	let form = document.getElementById('customForm');
	
	// Set method (FORM.method is a default property, using _method)
	for (let i=0;i<form._method.options.length;i++) {
		if (se.method !== undefined && se.method.toUpperCase() === form._method.options[i].value) {
			form._method.selectedIndex = i;
			break;
		}
	}

	// set form fields
	form.description.innerText = se.description;
	form.shortname.value = se.title;
	form.searchform.value = se.searchForm;
	
	let template = se.template;
	
	if (form._method.value === "GET") {
		form.template.innerText = se.query_string;

		if (!template) form.template.innerText = browser.i18n.getMessage("TemplateMissingeMessage");
		
	} else {
		// POST form.template = form.action
		form.template.innerText = template;
		form.post_params.value = nameValueArrayToParamString(se.params);
		
	}

	// data-type images are invalid, replace with generic favicon.ico
	let favicon_url = (se.icon_url && !se.icon_url.startsWith("data")) ? se.icon_url : new URL(se.template).origin + "/favicon.ico";

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

	if (openSearchUrl && isFirefox /* firefox */) {
		let div = document.getElementById('CS_optionInstallOfficialEngine');
		
		// Add button
		div.onclick = function() {
			
			if (!ose) {
				alert(browser.i18n.getMessage("ErrorParsing").replace("%1", openSearchUrl));
				return;
			}
			
			if (hasDuplicateName(ose.title)) {
				alert(browser.i18n.getMessage("EngineExists").replace("%1", ose.title));
				return;
			}

			browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: ose}).then((response) => {
				console.log(response);
			});
			
			if ( isFirefox /* firefox */ ) {
				// reassign the yes button to add official OpenSearch xml
				document.getElementById('b_simple_import_yes').onclick = function() {
					simpleImportHandler(openSearchUrl);
				}
				
				showMenu('simple_import');
			} else {
				closeCustomSearchIframe();
			}
			
		}
		
		// Show button
		div.style.display=null;
	
	} 
	
	if (isFirefox) {
		// Find Plugin listener
		document.getElementById('CS_customSearchDialog_d_mycroftSearchEngine').onclick = function() {
			listenForFocusAndPromptToImport();
			window.open("http://mycroftproject.com/search-engines.html?name=" + _location.hostname, "_blank");
		}
		document.getElementById('CS_customSearchDialog_d_mycroftSearchEngine').style.display = 'inline-block';
		
	}
	
	// Form test
	form.test.onclick = function() {
		testOpenSearch(form);
	}
	
	// Form cancel
	form.cancel.onclick = function() {
		
		if ( isFirefox /* firefox */ )
			showMenu('CS_customSearchDialogOptions');
		else
			showMenu('simple');
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
				alert(browser.i18n.getMessage("EngineExists").replace("%1",se.title) + " " + browser.i18n.getMessage("EnterUniqueName"));
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
		if (typeof form.icon.naturalWidth != "undefined" && form.icon.naturalWidth == 0) {
			alert(browser.i18n.getMessage("IconLoadError") + ' (' + form.iconURL.value + ')');
			return;
		}

		let se = formToSearchEngine();
		
	//	alert('Adding search engine from custom form');
	
		browser.runtime.sendMessage({action: "addContextSearchEngine", searchEngine: se}).then((response) => {
	//		console.log(response);
		});
		
		if ( isFirefox /* firefox */ ) {
			// reassign the yes button to add form OpenSearch xml
			document.getElementById('b_simple_import_yes').onclick = function() {
				let url = buildOpenSearchAPIUrl();
				simpleImportHandler(url, true);
			}
			
			showMenu('simple_import');
		} else {
			closeCustomSearchIframe();
		}
	}
	
	// Custom button listener
	document.getElementById('CS_customSearchDialog_d_custom').onclick = function() {
		showMenu(form);
	}

	if (se.template)
		showMenu('simple');
	else
		showMenu('simple_error');
}

function testOpenSearch(form) {

	let params = [];

//	console.log(params);
	
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

	browser.runtime.sendMessage({action: "hasBrowserSearch"}).then( result => {
		
		console.log(result);

		if (result) {

			window.addEventListener('focus', () => {
				
				console.log('focused');
				
				// look for new one-click engines
				browser.runtime.sendMessage({action: "checkForOneClickEngines"}).then( newEngineCount => {
					
					console.log('found ' + newEngineCount + ' new engines');
					
					// do nothing if no engines added
					if ( !newEngineCount ) return;
					
					// show auto notification
					showMenu('CS_notifyAutomaticUpdated');

					let text = document.querySelector('[data-i18n="NewEngineImported"]');
					
					text.innerText = browser.i18n.getMessage("NewEngineImported", newEngineCount);
						
					// close iframe after x milliseconds
					setTimeout(closeCustomSearchIframe, 2000);
				});

			}, {once: true});
			
			return;
		} else {
			let dialog = document.getElementById('CS_postSearchEngineInstall');
	
			dialog.querySelector('[name="import"]').onclick = function() {
				browser.runtime.sendMessage({action: "openOptions", hashurl:"#quickload"});
				closeCustomSearchIframe();	
			}
			
			window.addEventListener('focus', () => {
				
				dialog.querySelector('[name="moreInfo"]').onclick = function() {
					browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=helpTab#help_importing"});
				}
				
				showMenu(dialog);
				
				dialog.querySelector('[name="cancel"]').onclick = function() {
					showMenu('CS_customSearchDialogOptions');
				}
				
			}, {once: true});
		}
	});

}

// close iframe when clicking anywhere in the window
document.addEventListener('click', (e) => {
	if ( document.body.contains(e.target) ) return false;	
	closeCustomSearchIframe();
});

// i18n string replacement and styles
document.addEventListener('DOMContentLoaded', () => {

		// Build tooltips
	let info_msg = document.createElement('div');
	info_msg.id = "CS_info_msg";
	document.body.appendChild(info_msg);
	
	for (let info of document.getElementsByClassName('CS_info')) {
		info.addEventListener('mouseenter', (e) => {
			info_msg.innerText = info.dataset.msg;
			info_msg.style.top = info.getBoundingClientRect().top + window.scrollY + 20 + 'px';
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
		
		if (browser.i18n.getMessage(el.dataset.i18n))
			textNode.nodeValue = browser.i18n.getMessage(el.dataset.i18n);
	}
	
	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
	for (let el of i18n_tooltips) {
		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip');
	}
	
//	console.log(browser.i18n.getUILanguage());
	
	var link = document.createElement( "link" );
	link.href = browser.runtime.getURL('/_locales/' + browser.i18n.getUILanguage() + '/style.css');
	link.type = "text/css";
	link.rel = "stylesheet";
	document.getElementsByTagName( "head" )[0].appendChild( link );
	
});

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
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

// listen for the custom engine to prompt to add
window.addEventListener("message", (e) => {

	if (e.data.action && e.data.action === "promptToSearch") {
		let ok = document.getElementById('b_simple_search_ok');

		ok.onclick = function() {
			browser.runtime.sendMessage({action: "closeCustomSearch"});
		}
		showMenu('simple_search');
	 } else
		addSearchEnginePopup(e.data);
}, {once: true});

// let the parent window know the iframe is loaded
document.addEventListener('DOMContentLoaded', () => {
	window.parent.postMessage({status: "complete"}, "*");
});

