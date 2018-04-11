
// listen for right-mousedown and enable Add Custom Search menu item if no text is selected
function inputAddCustomSearchHandler(input) {
	input.addEventListener('mousedown', (ev) => {
		if (
			ev.which !== 3
			|| getSelectedText(input)
		) return;

		browser.runtime.sendMessage({action: "enableAddCustomSearch"});
	});
}

// Add Custom Search listener
for (let input of document.getElementsByTagName('input')) {
	inputAddCustomSearchHandler(input);
}

// Add listener for dynamically added inputs
var CS_observer = new MutationObserver((mutationsList) => {
	for(var mutation of mutationsList) {
        if (mutation.type == 'childList') {
			for (let node of mutation.addedNodes) {
				if (node.nodeName === "INPUT") {
					console.log("INPUT added dynamically to the DOM. Adding listener");
					inputAddCustomSearchHandler(node);
				}
			}
//			console.log(mutation);
//          console.log('A child node has been added or removed.');
        }
    }
});

CS_observer.observe(document.body, {childList: true, subtree: true});

function addSearchEnginePopup(data) {

	// Check for OpenSearch plugin
	var openSearchHref = null;
	let osLink = document.querySelector('link[type="application/opensearchdescription+xml"]')
	if (osLink !== null) openSearchHref = osLink.href;
	
//	console.log(data);

	// Create popup
	var el = document.createElement('div');
	el.id = 'CS_customSearchDialog';
	
	// Remove old popups
	let el_popup = document.getElementById(el.id);
	if ( el_popup !== null ) document.body.removeChild(el_popup);
	
	var container = document.createElement('div');
	container.id = "CS_customSearchEngineContainerDiv";
	container.style='position:fixed;z-index:2147483646;top:0;left:0;width:100%;height:100%;text-align:center;background-color:rgba(0,0,0,.85);transition: opacity .25s ease-in-out;opacity:0';
	
	// if 
	document.addEventListener('click', (e) => {
		if (
			!container.contains(e.target) 
			|| el.contains(e.target)
		) return false;
		
		closePopup();
	});
	
	container.appendChild(el);
	// append popup
	document.body.appendChild(container);
		
	// Load html template for popup
	loadHTML(el.id, browser.runtime.getURL("/CS_customSearchDialog.html"));
	
	var loadHTMLInterval = window.setInterval(() => {
		
		// Wait until the template is loaded
		if (el.getElementsByTagName('form') === null) return;
		window.clearInterval(loadHTMLInterval);
		
		// Build tooltips
		let info_msg = document.createElement('div');
		info_msg.id = "CS_customSearchDialog_info_msg";
		document.body.appendChild(info_msg);
		
		for (let img of document.getElementsByClassName('web_accessable_resource_image')) {
			console.log(img);
			img.src = browser.runtime.getURL(img.dataset.src);
		}
		
		for (let info of document.getElementsByClassName('CS_customSearchDialog_info')) {
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
		data.action = data.action || "";//window.location.href;
		data.params = data.params || {};
//		data.query = data.query || "q";
		
		let form = el.getElementsByTagName('form')[0];
		
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
		form.searchform.value = window.location.origin;
		
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
		
		// Look for favicons
		let favicon_link = document.querySelector('link[rel="icon"]') 
			|| document.querySelector('link[rel="shortcut icon"]') 
			|| document.querySelector('link[rel="apple-touch-icon"]');
		
		// data-type images are invalid, replace with generic favicon.ico
		let favicon_url = (favicon_link !== null && favicon_link.href.match(/^data/) === null) ? favicon_link.href : window.location.origin + "/favicon.ico";

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
		let buttons = el.getElementsByClassName('CS_addSearchEngineOption');
		for (let button of buttons) {
			
			if (!button.dataset.description) continue;

			// display button description
			button.addEventListener('mouseover', (ev) => {
				let desc = document.getElementById('CS_customSearchDialog_d_optionDescription');
				desc.style.transition='none';
				desc.style.opacity=window.getComputedStyle(desc).opacity;
				desc.style.opacity=0;
				desc.innerText = button.dataset.description;
				desc.style.transition=null;
				desc.style.opacity=1;
			});
			
			// hide button description
			button.addEventListener('mouseout', (ev) => {
				document.getElementById('CS_customSearchDialog_d_optionDescription').style.opacity=0;
			});
		}

		// Set up official add-on if exists
		if (openSearchHref) {
			let div = document.getElementById('CS_customSearchDialog_d_officialSearchEngine');
			
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
			window.open("http://mycroftproject.com/search-engines.html?name=" + window.location.hostname, "_blank");
		}
		
		// Form test
		document.getElementById('CS_customSearchDialog_b_testCustomOpenSearchEngine').onclick = function() {
			testOpenSearch(form);
		}
		
		// Form cancel
		document.getElementById('CS_customSearchDialog_b_cancelCustomOpenSearchEngine').onclick = function() {
			form.style.maxHeight=null;
			document.getElementById('CS_customSearchDialogOptions').style.maxHeight=null;
		}

		// Form submit
		document.getElementById('CS_customSearchDialog_b_addCustomOpenSearchEngine').onclick = function(ev) {
			
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
				alert('Template must be an URL (' + window.location.origin + '...)');
				return;
			}
			if (form.searchform.value.match(/^http/i) === null) {
				alert('Form path must be an URL (' + window.location.origin + ')');
				return;
			}
			if (form.iconURL.value.match(/^http/i) === null || form.iconURL.value == "") {
				alert('Icon must be an URL (' + window.location.origin + '/favicon.ico)');
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
			
			console.log(url);

			let hasBlurred = false;
			window.addEventListener('blur', () => {
//				console.log('blurred');
				hasBlurred = true;
			}, {once: true});
			
			window.addEventListener('focus', () => {
//				console.log('focused');


				if ( !hasBlurred ) return;
				if (userOptions.reloadMethod !== 'manual') return;
				
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
						console.log(response);
					});
					
				//	dialog.style.maxHeight = null;
				//	document.getElementById('CS_customSearchDialogOptions').style.maxHeight=null;
					closePopup();
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

		// Show popup
		container.style.opacity = el.style.opacity = 1;
		
	},100);
}
function loadHTML(myDivId, url) {
    var xmlhttp;

    xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = function()	{
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if(xmlhttp.status == 200) {
				let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'text/html');
				let tag = parsed.getElementsByTagName('body')[0];
				
				document.getElementById(myDivId).innerHTML = null;
				document.getElementById(myDivId).appendChild(tag.firstChild);
		//	   document.getElementById(myDivId).innerHTML = xmlhttp.responseText;
		   } else {
			   console.log('Error fetching ' + url);
		   }
		}
	}

	xmlhttp.open("GET", url, true);
	xmlhttp.send();
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
/*	if (form._method.value === "POST") {
		for (let pair of form.post_params.value.split("&")) {
			let p = pair.split("=");
			params.push({"name": p[0], "value": p[1] || ""});
		}
	}
*/
	console.log(params);
	
	params = paramStringToNameValueArray(form.post_params.value);
	
	console.log('here');

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
function closePopup() {
	let container = document.getElementById("CS_customSearchEngineContainerDiv");
	container.style.opacity = 0;
	
	// remove after transition effect completes
	setTimeout(() => {
		document.body.removeChild(container);
	},250);
	
	// run native app to check for updated search.json.mozlz4 with enough delay to process file
	setTimeout(() => {
		browser.runtime.sendMessage({action: "nativeAppRequest"});
	}, 1000);
}

function listenForFocusAndPromptToImport() {
	if (userOptions.reloadMethod === 'manual') {
		
		document.getElementById('CS_customSearchDialog_b_openOptions').onclick = function() {
			browser.runtime.sendMessage({action: "openOptions", hashurl: "#searchengines"});
			closePopup();	
		}
		
		window.addEventListener('focus', () => {
			document.getElementById('CS_customSearchDialogOptions').style.maxHeight="0px";
			let dialog = document.getElementById('CS_postSearchEngineInstall');
			dialog.style.maxHeight = '300px';
			let cancel = document.getElementById('CS_customSearchDialog_b_cancelSearchEngineInstall_two');
			cancel.onclick = function() {
				document.getElementById('CS_customSearchDialogOptions').style.maxHeight = null;
				dialog.style.maxHeight = null;
			}
		}, {once: true});
	}
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
							
			case "openSearchPopup":
				addSearchEnginePopup(message.data);
				break;
		}
	}
});
