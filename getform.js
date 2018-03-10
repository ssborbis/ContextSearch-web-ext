// From BurningMoth AddSearch by Spencer T Obremski
// https://addons.mozilla.org/en-US/firefox/addon/burning-moth-add-search/

var S = {};
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