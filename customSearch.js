var userOptions = {};

function addSearchEnginePopup(data) {
	
	let openSearchHref = data.openSearchHref;
	let favicon_href = data.favicon_href;
	let _location = new URL(data.href);
	
	document.addEventListener('click', (e) => {
		if ( document.body.contains(e.target) ) return false;	
		closeCustomSearchIframe();
	});
	
	document.getElementById("CS_customSearchDialogClose").addEventListener('click', (e) => {
		closeCustomSearchIframe();
	});

	// Build tooltips
	let info_msg = document.createElement('div');
	info_msg.id = "CS_info_msg";
	document.body.appendChild(info_msg);
	
	for (let info of document.getElementsByClassName('CS_info')) {
		info.addEventListener('mouseover', (e) => {
			info_msg.innerText = info.dataset.msg;
			info_msg.style.top = info.getBoundingClientRect().top + window.scrollY + 'px';
			info_msg.style.left = info.getBoundingClientRect().left + window.scrollX + 20 + 'px';
			info_msg.style.display = 'block';
		});
		
		info.addEventListener('mouseout', (e) => {
			info_msg.style.display = 'none';
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
	
	let form = document.getElementsByTagName('form')[0];
	
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
		if (!data.action) form.template.innerText = "Unable to find a template for this search form. You can try doing a search and copying the resulting URL here, replacing your search terms with {searchTerms}";
		
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
		
		document.getElementById('CS_customSearchDialog_b_addCustomOpenSearchEngine').disabled = true;
		var loadingIconInterval = setInterval(() => {
			if (!form.icon.complete) return;
			
			clearInterval(loadingIconInterval);
			document.getElementById('CS_customSearchDialog_b_addCustomOpenSearchEngine').disabled = false;

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
		
		if (!button.dataset.description) continue;

		// display button description
		button.addEventListener('mouseenter', (ev) => {
			let desc = document.getElementById('CS_optionDescription');
			desc.style.transition='none';
			desc.style.opacity=window.getComputedStyle(desc).opacity;
			desc.style.opacity=0;
			desc.innerText = button.dataset.description;
			desc.style.transition=null;
			desc.style.opacity=1;
		});
		
		// hide button description
		button.addEventListener('mouseleave', (ev) => {
			document.getElementById('CS_optionDescription').style.opacity=0;
		});
	}

	// Set up official add-on if exists
	if (openSearchHref) {
		let div = document.getElementById('CS_optionInstallOfficialEngine');
		
		// Add button
		div.onclick = function() {
			
			listenForFocusAndPromptToImport();
			
			// some sites require the background page calling window.external.AddSearchProvider
			browser.runtime.sendMessage({action: "addSearchEngine", url:openSearchHref});

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
		form.style.maxHeight=null;
		document.getElementById('CS_customSearchDialogOptions').style.maxHeight=null;
	}

	// Form submit
	form.add.onclick = function(ev) {
		
		// Check bad form values
		if (form.shortname.value.trim() == "") {
			alert('Must have a name');
			return;
		}
		for (let se of userOptions.searchEngines) {
			if (se.title == form.shortname.value) {
				alert('Name must be unique. Search engine "' + form.shortname.value + '" already exists');
				return;
			}
		}
		if (form.description.value.trim() == "") {
			alert('Must have a description');
			return;
		}
		if (form.description.value.length > 1024 ) {
			alert('Description must be 1024 or fewer characters');
			return;
		}
		if (form.post_params.value.indexOf('{searchTerms}') === -1 && form.template.value.indexOf('{searchTerms}') === -1) {
			alert('Template or params must include {searchTerms}');
			return;
		}
		if (form.template.value.match(/^http/i) === null) {
			alert('Template must be an URL (' + _location.origin + '...)');
			return;
		}
		if (form.searchform.value.match(/^http/i) === null) {
			alert('Form path must be an URL (' + _location.origin + ')');
			return;
		}
		if (form.iconURL.value.match(/^http/i) === null || form.iconURL.value == "") {
			alert('Icon must be an URL (' + _location.origin + '/favicon.ico)');
			return;
		}
		
		// disable button and show loading icon (prevents button spamming)
		ev.target.disabled = true;
		let spinner = document.createElement('img');
		spinner.src = browser.runtime.getURL("/icons/spinner.svg");
		spinner.style.height = "1em";
		ev.target.innerText = "";
		ev.target.appendChild(spinner);
		
		// enable the button on window blur - typically this is from the AddSearchProvider() dialog
		window.addEventListener('blur', () => {
			ev.target.removeChild(spinner);
			ev.target.innerText = "Add";
			ev.target.disabled = false;
		}, {once: true});

		// build the URL for the API
		var url = "https://opensearch-api.appspot.com" 
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
		
//		console.log(url);

		if (userOptions.reloadMethod === 'automatic') {
			listenForNewSearchEngines();
		}

		window.addEventListener('focus', () => {
			
			if (userOptions.reloadMethod === 'automatic') {
				return;
			}
			
			let ok = document.getElementById('CS_customSearchDialog_b_confirmSearchEngineInstall');		
			let cancel = document.getElementById('CS_customSearchDialog_b_cancelSearchEngineInstall');
			
			form.style.maxHeight = null;
			let dialog = document.getElementById('CS_confirmSearchEngineInstall');
			dialog.style.maxHeight = '300px';

			ok.onclick = function() {
				let se = {
					"searchForm": form.searchform.value, 
					"query_string":form.template.value,
					"icon_url":form.iconURL.value,
					"title":form.shortname.value,
					"order":userOptions.searchEngines.length, 
					"icon_base64String": imageToBase64(form.icon), 
					"method": form._method.value, 
					"params": paramStringToNameValueArray(form.post_params.value), 
					"template": form.template.value, 
					"queryCharset": form._encoding.value, 
					"hidden": false
				};
				
				browser.runtime.sendMessage({action: "addCustomSearchEngine", searchEngine: se}).then((response) => {
//					console.log(response);
				});

				closeCustomSearchIframe();
			}
			
			cancel.onclick = function() {
				dialog.style.maxHeight = null;
				form.style.maxHeight = "1000px";
			}

		}, {once: true});
		
		
		// some sites require the background page to call window.external.AddSearchProvider
		browser.runtime.sendMessage({action: "addSearchEngine", url:url});

	}
	
	// Custom button listener
	document.getElementById('CS_customSearchDialog_d_custom').onclick = function() {
		
		// hide options
		document.getElementById('CS_customSearchDialogOptions').style.maxHeight="0px";
		
		// show form
		form.style.maxHeight = '1000px';
	}


}

function readOpenSearchUrl(url, callback) {
	callback = callback || function() {};
    var xmlhttp;

    xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = function()	{
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if(xmlhttp.status == 200) {
				let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'application/xml');
				callback(parsed);
		   } else {
			   console.log('Error fetching ' + url);
		   }
		}
	}

	xmlhttp.open("GET", url, true);
	xmlhttp.send();
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

	let searchTerms = window.prompt("Enter search terms","firefox");
	
	browser.runtime.sendMessage({"action": "testSearchEngine", "tempSearchEngine": tempSearchEngine, "searchTerms": searchTerms});
	
}

// Close button listener
function closeCustomSearchIframe() {	
	browser.runtime.sendMessage({action: "closeCustomSearch"});
}

function listenForNewSearchEngines() {
	
	var nativeAppInterval = null;
	
	function handler(e) {
		if (e.detail) { // if search engines length has changed
		
			// remove the listener
			document.removeEventListener('getUserOptionsEvent', handler);
			
			// clear the interval
			clearInterval(nativeAppInterval);
			
			// minimize all other menus
			for (let el of document.getElementsByClassName('CS_menuItem')) {
				el.style.maxHeight = "0px";
			}
			document.getElementsByTagName('form')[0].style.maxHeight = "0px";
			
			// show auto notification
			document.getElementById('CS_notifyAutomaticUpdated').style.maxHeight = '300px';
			
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
/*
function createMenu(details) {
	
	let container = document.createElement('div');
	container.className = 'CS_menuItem';
	
	let description = document.createElement('p');
	description.style = 'font-size:11pt;margin-bottom:8px;background-color:#222;padding:10px';
	description.innerHTML = details.description || "";
	
	for (let menuItem of details.menuItems) {
		
		let img = document.createElement('img');
		img.src =  menuItem.imageSrc || "";
		
		let div = document.createElement('div');

		div.appendChild(img);
		div.appendChild(document.createTextNode(menuItem.label));
		
		div.style.backgroundColor = menuItem.backgroundColor || "transparent";
		div.dataset.description = menuItem.description || "";

		div.onclick = menuItem.onclick || function() {};
		
		container.appendChild(div);

		// display button description
		div.addEventListener('mouseenter', (ev) => {
			let desc = document.getElementById('CS_optionDescription');
			desc.style.transition='none';
			desc.style.opacity=window.getComputedStyle(desc).opacity;
			desc.style.opacity=0;
			desc.innerText = div.dataset.description;
			desc.style.transition=null;
			desc.style.opacity=1;
		});
		
		// hide button description
		div.addEventListener('mouseleave', (ev) => {
			document.getElementById('CS_optionDescription').style.opacity=0;
		});
	}
	
	return container;
}
*/
function listenForFocusAndPromptToImport() {

	if (userOptions.reloadMethod === 'automatic') {
		listenForNewSearchEngines();
		return;
	}
	
	document.getElementById('CS_customSearchDialog_b_openOptions').onclick = function() {
		browser.runtime.sendMessage({action: "openOptions", hashurl: "#searchengines"});
		closeCustomSearchIframe();	
	}
	
	window.addEventListener('focus', () => {
		document.getElementById('CS_customSearchDialogOptions').style.maxHeight="0px";
		
/*		let dialog = createMenu({
			description: "ContextSearch is unable to determine if a new OpenSearch engine was installed when using Manual Import. Would you like to import your OpenSearch engines?",
			menuItems: [{
				backgroundColor: "#2198dd",
				imageSrc: "/icons/checkmark.png",
				label: "Yes",
				description: "Open Options to import search.json.mozlz4 file",
				onclick: function() {
					browser.runtime.sendMessage({action: "openOptions", hashurl: "#searchengines"});
					closeCustomSearchIframe();	
				}
			},
			{
				backgroundColor: "#e94c3b",
				imageSrc: "/icons/crossmark.png",
				label: "No",
				description: "Return to previous menu",
				onclick: function() {
					document.getElementById('CS_customSearchDialogOptions').style.maxHeight = null;
					dialog.style.maxHeight = null;
				}
			}]
		});
		document.getElementById("CS_customSearchDialog").appendChild(dialog);
		window.getComputedStyle(dialog).maxHeight;
*/		
		let dialog = document.getElementById('CS_postSearchEngineInstall');
		dialog.style.maxHeight = '300px';
		let cancel = document.getElementById('CS_customSearchDialog_b_cancelSearchEngineInstall_two');
		cancel.onclick = function() {
			document.getElementById('CS_customSearchDialogOptions').style.maxHeight = null;
			dialog.style.maxHeight = null;
		}
	}, {once: true});
	
}

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