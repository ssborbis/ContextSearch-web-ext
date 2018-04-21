// From BurningMoth AddSearch by Spencer T Obremski
// https://addons.mozilla.org/en-US/firefox/addon/burning-moth-add-search/

var S = {};

// Check for OpenSearch plugin
S.openSearchHref = "";
osLink = document.querySelector('link[type="application/opensearchdescription+xml"]')
if (osLink !== null) S.openSearchHref = osLink.href || "";

// Look for favicons
favicon_link = document.querySelector('link[rel="icon"]') 
	|| document.querySelector('link[rel="shortcut icon"]') 
	|| document.querySelector('link[rel="apple-touch-icon"]');
	
S.favicon_href = "";	
if (favicon_link !== null) S.favicon_href = favicon_link.href || "";

S.href = window.location.href;

var E = window.document.querySelector("input:focus");

// query parameter has name ? ...
if ( E && E.name ) {

	// search form data ...
	S.method = E.form.method;
	S.action = E.form.action;

	// query parameter ...
	S.query = E.name;

	// get additional parameters ...
	S.params = {};
	Object.values( E.form.elements ).forEach(function( el ){

		if (
			el.name
			&& el.name != S.query
			&& el.value
		) switch ( el.type ) {
			case 'radio':
			case 'checkbox':
				if ( el.checked ) S.params[ el.name ] = el.value;
				break;

			default:
				S.params[ el.name ] = el.value;
				break;
		}

	});

	// get/set name ...
	var M = window.document.querySelector('meta[property="og:site_name"]');
	S.name = M ? M.content : window.location.hostname;

	// get description ...
	M = window.document.querySelector('meta[property="og:description"], meta[name="description"]');
	S.description = M ? M.content : '';

}

S;