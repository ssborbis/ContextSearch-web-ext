function addSearchEnginePopup(data) {

	// Check for OpenSearch plugin
	var openSearchHref = null;
	let osLink = document.querySelector('link[type="application/opensearchdescription+xml"]')
	if (osLink !== null) openSearchHref = osLink.href;
	
//	console.log(data);

	// Create popup
	var el = document.createElement('div');
	el.id = 'openSearchDialog';
	
	// Remove old popups
	let el_popup = document.getElementById(el.id);
	if ( el_popup !== null ) document.body.removeChild(el_popup);
	
	// append popup
	document.body.appendChild(el);
	
	// Load html template for popup
	loadHTML(el.id, browser.runtime.getURL("/openSearchDialog.html"));
	
	var loadHTMLInterval = window.setInterval(() => {
		
		// Wait until the template is loaded
		if (el.getElementsByTagName('form') === null) return;
		window.clearInterval(loadHTMLInterval);
		
		// Build tooltips
		let info_msg = document.createElement('div');
		info_msg.id = "openSearchDialog_info_msg";
		document.body.appendChild(info_msg);
		
		for (let info of document.getElementsByClassName('openSearchDialog_info')) {
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

		
		// Close button listener
		document.getElementById('openSearchDialog_s_close').onclick = function() {
			el.style.opacity = 0;
			
			// remove after transition effect completes
			setTimeout(() => {
				document.body.removeChild(el);
			},250);
			
			// run native app to check for updated search.json.mozlz4 with enough delay to process file
			setTimeout(() => {
				browser.runtime.sendMessage({action: "nativeAppRequest"});
			}, 1000);
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
			
			document.getElementById('openSearchDialog_b_addCustomOpenSearchEngine').disabled = true;
			var loadingIconInterval = setInterval(() => {
				if (!form.icon.complete) return;
				
				clearInterval(loadingIconInterval);
				document.getElementById('openSearchDialog_b_addCustomOpenSearchEngine').disabled = false;

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
		let buttons = el.getElementsByClassName('_hover');
		for (let button of buttons) {
			
			if (!button.dataset.description) continue;

			// display button description
			button.addEventListener('mouseover', (ev) => {
				let desc = document.getElementById('openSearchDialog_d_optionDescription');
				desc.style.transition='none';
				desc.style.opacity=window.getComputedStyle(desc).opacity;
				desc.style.opacity=0;
				desc.innerText = button.dataset.description;
				desc.style.transition=null;
				desc.style.opacity=1;
			});
			
			// hide button description
			button.addEventListener('mouseout', (ev) => {
				document.getElementById('openSearchDialog_d_optionDescription').style.opacity=0;
			});
		}

		// Set up official add-on if exists
		if (openSearchHref) {
			let div = document.getElementById('openSearchDialog_d_officialSearchEngine');
			
			// Add button
			div.onclick = function() {
				
				// some sites require the background page calling window.external.AddSearchProvider
				browser.runtime.sendMessage({action: "addSearchEngine", url:openSearchHref});

			}
			
			// Show button
			div.style.display=null;
		
		} 
		
		// Find Plugin listener
		document.getElementById('openSearchDialog_d_mycroftSearchEngine').onclick = function() {
			window.open("http://mycroftproject.com/search-engines.html?name=" + window.location.hostname, "_blank");
		}
		
		// Form test
		document.getElementById('openSearchDialog_b_testCustomOpenSearchEngine').onclick = function() {
			testOpenSearch(form);
		}
		
		// Form cancel
		document.getElementById('openSearchDialog_b_cancelCustomOpenSearchEngine').onclick = function() {
			form.style.maxHeight=null;
			document.getElementById('openSearchDialog_d_options').style.maxHeight=null;
		}

		// Form submit
		document.getElementById('openSearchDialog_b_addCustomOpenSearchEngine').onclick = function(ev) {
			
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
			var url = "http://opensearch-api.appspot.com" 
				+ "?SHORTNAME=" + encodeURIComponent(form.shortname.value) 
				+ "&DESCRIPTION=" + encodeURIComponent(form.description.value) 
				+ "&TEMPLATE=" + encodeURIComponent(encodeURI(form.template.value)) 
				+ "&POST_PARAMS=" + encodeURIComponent(form.post_params.value) 
				+ "&METHOD=" + form._method.value 
				+ "&ENCODING=" + form._encoding.value 
				+ "&ICON=" + encodeURIComponent(encodeURI(form.iconURL.value)) 
				+ "&ICON_WIDTH=" + (form.icon.naturalWidth || 16) 
				+ "&ICON_HEIGHT=" + (form.icon.naturalHeight || 16) 
				+ "&SEARCHFORM=" + encodeURIComponent(encodeURI(form.searchform.value));
			
			console.log(url);

			if (userOptions.reloadMethod === 'manual') {
				userOptions.searchEngines.push({
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
				});
				
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions})
				.then(() => {
					browser.runtime.sendMessage({action: "updateUserOptions"})
				});
			}
			// some sites require the background page to call window.external.AddSearchProvider
			if (userOptions.reloadMethod === 'automatic' || confirm(form.shortName.value + " added to Manual list. Also try adding plugin to Firefox One-Click Search Engines?"))
				browser.runtime.sendMessage({action: "addSearchEngine", url:url});

		}
		
		// Custom button listener
		document.getElementById('openSearchDialog_d_custom').onclick = function() {
			
			// hide options
			document.getElementById('openSearchDialog_d_options').style.maxHeight="0px";
			
			// show form
			form.style.maxHeight = '1000px';
		}
		
		// Show popup
		el.style.opacity=1;
		
	},100);
}
function loadHTML(myDivId, url) {
    var xmlhttp;

    xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = function()	{
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
		   if(xmlhttp.status == 200) {
			   document.getElementById(myDivId).innerHTML = xmlhttp.responseText;
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
	
//	console.log(tempSearchEngine);
//	console.log(userOptions.searchEngines[userOptions.searchEngines.length - 1]);
	
	let searchTerms = window.prompt("Enter search terms","firefox");
	
	browser.runtime.sendMessage({"action": "testSearchEngine", "tempSearchEngine": tempSearchEngine, "searchTerms": searchTerms});
	
}
