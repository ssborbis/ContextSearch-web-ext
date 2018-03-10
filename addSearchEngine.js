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
	
	document.body.appendChild(el);
	
	// Load html template for popup
	loadHTML(el.id, browser.runtime.getURL("/openSearchDialog.html"));
	
	var loadHTMLInterval = window.setInterval(() => {
		
		// Wait until the template is loaded
		if (el.getElementsByTagName('form') === null) return;
		window.clearInterval(loadHTMLInterval);
		
		// Build tooltips
		let info_msg = document.createElement('div');
		info_msg.id = "info_msg";
		document.body.appendChild(info_msg);
		
		for (let info of document.getElementsByClassName('info')) {
			info.addEventListener('mouseover', (e) => {
				let div = document.getElementById('info_msg');
				div.innerText = info.dataset.msg;
				div.style.top = info.getBoundingClientRect().top + window.scrollY + 'px';
				div.style.left = info.getBoundingClientRect().left + window.scrollX + 20 + 'px';
				div.style.display = 'block';
			});
			
			info.addEventListener('mouseout', (e) => {
				document.getElementById('info_msg').style.display = 'none';
			});
		}

		
		// Close button listener
		document.getElementById('span_close').onclick = function() {
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
		
		form.description.innerText = data.description;
		form.shortname.value = data.name;
		form.searchform.value = window.location.origin;
		
		let template = data.action;
		let param_str = data.query + "={searchTerms}";
	
		for (let i in data.params) {
			param_str+="&" + i + "=" + data.params[i];
		}
		
		if (form._method.value === "GET") {
			form.template.innerText = template + ((template.indexOf('?') === -1) ? "?":"&") + param_str;
			if (!data.action) form.template.innerText = "Unable to find a template for this search form. You can try doing a search and copying the resulting URL here, replacing your search terms with {searchTerms}";
		} else {
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
			
			document.getElementById('b_addCustomOpenSearchEngine').disabled = true;
			var loadingIconInterval = setInterval(() => {
				if (!form.icon.complete) return;
				
				clearInterval(loadingIconInterval);
				document.getElementById('b_addCustomOpenSearchEngine').disabled = false;

			},100);
		});
		
		// get the favicon
		form.icon.src = favicon_url;
		form.iconURL.value = favicon_url;

		// Set encoding
		for (let i=0;i<form._encoding.options.length;i++) {

			if (document.characterSet.toUpperCase() === form._encoding.options[i].value) {
				form._encoding.selectedIndex = i;
				break;
			}
		}

		// Get option buttons and add description widget
		let buttons = document.getElementsByClassName('_hover');
		for (let button of buttons) {
			
			if (!button.dataset.description) continue;

			button.addEventListener('mouseover', (ev) => {
				let desc = document.getElementById('d_optionDescription');
				desc.style.transition='none';
				desc.style.opacity=window.getComputedStyle(desc).opacity;
				desc.style.opacity=0;
				desc.innerText = button.dataset.description;
				desc.style.transition=null;
				desc.style.opacity=1;
			});
			button.addEventListener('mouseout', (ev) => {
				document.getElementById('d_optionDescription').style.opacity=0;
			});
		}

		// Set up official add-on if exists
		if (openSearchHref) {
			let div = document.getElementById('d_officialSearchEngine');
			div.onclick = function() {
				window.external.AddSearchProvider(openSearchHref);
			}
			div.style.display='';
		
		} 
		
		// Find Plugin listener
		document.getElementById('mycroftSearchEngineDiv').onclick = function() {
			window.open("http://mycroftproject.com/search-engines.html?name=" + window.location.hostname, "_blank");
		}
		
		// Form cancel
		document.getElementById('b_cancelCustomOpenSearchEngine').onclick = function() {
			form.style.maxHeight=null;
			document.getElementById('d_options').style.maxHeight=null;
		}

		// Form submit
		document.getElementById('b_addCustomOpenSearchEngine').onclick = function(ev) {
			
			// Check bad form values
			if (form.shortname.value.trim() == "") {
				alert('Must have a name');
				return;
			}
			if (form.description.value.trim() == "") {
				alert('Must have a description');
				return;
			}
			if (form.description.value.length > 1024 ) {
				alert('Description must 1024 or fewer characters');
				return;
			}
			if (form.post_params.value.indexOf('{searchTerms}') === -1 && form.template.value.indexOf('{searchTerms}') === -1) {
				alert('Template or params must include {searchTerms}');
				return;
			}
			if (form.template.value.match(/^http/i) === null) {
				alert('Template must be an URL (http://example.com/...)');
				return;
			}
			
			// disable button and show loading icon (prevents button spamming)
			ev.target.disabled = true;
			let spinner = document.createElement('img');
			spinner.src = browser.runtime.getURL("/icons/spinner.svg");
			spinner.style.height = "1em";
			ev.target.innerText = "";
			ev.target.appendChild(spinner);
			
			window.addEventListener('blur', (e) => {
				ev.target.removeChild(spinner);
				ev.target.innerText = "Add";
				ev.target.disabled = false;
			}, {once: true});

			var url = "http://opensearch-api.appspot.com" 
				+ "?SHORTNAME=" + encodeURIComponent(form.shortname.value) 
				+ "&DESCRIPTION=" + encodeURIComponent(form.description.value) 
				+ "&TEMPLATE=" + encodeURIComponent(encodeURI(form.template.value)) 
				+ "&POST_PARAMS=" + encodeURIComponent(form.post_params.value) 
				+ "&METHOD=" + form._method.value 
				+ "&ENCODING=" + form._encoding.value 
				+ "&ICON=" + encodeURIComponent(form.iconURL.value) 
				+ "&ICON_WIDTH=" + (form.icon.naturalWidth || 16) 
				+ "&ICON_HEIGHT=" + (form.icon.naturalHeight || 16) 
				+ "&SEARCHFORM=" + encodeURIComponent(form.searchform.value);
			
			console.log(url);

			// some sites require the background page calling window.external.AddSearchProvider
			browser.runtime.sendMessage({action: "addSearchEngine", url:url});

		}
		
		// Custom button listener
		document.getElementById('d_custom').onclick = function() {
			
			// hide options
			document.getElementById('d_options').style.maxHeight="0px";
			
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
