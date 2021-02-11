const themes = [
	{ name: "lite", path: "/styles/lite.css"},
	{ name: "dark", path: "/styles/dark.css"},
	// { name: "sunset", path: "/styles/sunset.css"},
	// { name: "blue", path: "/styles/blue.css"},
	{ name: "modern", path: "/styles/modern.css"},
	{ name: "modern purple", path: "/styles/modern-purple.css", requires: ["/styles/modern.css"]},
	{ name: "modern sunset", path: "/styles/modern-sunset.css", requires: ["/styles/modern.css"]}
];

function addStylesheet(href) {
	return new Promise(resolve => {
		let link = document.createElement('link');

		link.onload = function() { resolve(link) }

		link.rel ="stylesheet";
		link.href = href;

		// insert before STYLE to allow userStyles to supersede theme styling
		let style = document.head.querySelector('style');
		if ( style ) document.head.insertBefore(link, style);
		else document.head.appendChild(link);
	});
}

async function setTheme(theme) {
	theme = theme || themes.find( t => t.name === userOptions.quickMenuTheme ) || themes[0];

	if ( theme.requires ) {
		for ( let l of theme.requires ) {
			let link = await addStylesheet(l);
			link.className = "theme requires"
		}
	}

	let link = await addStylesheet(theme.path);
	link.className = "theme";
	return link;
}

function setUserStyles() {
	return new Promise(resolve => {

		if ( userOptions.userStylesEnabled ) {
			// Append <style> element to <head>
			var styleEl = document.createElement('style');
			styleEl.innerText = userOptions.userStyles;
			styleEl.onload = () => { resolve(true) }

			document.head.appendChild(styleEl);
			document.body.getBoundingClientRect();
		} else resolve();
	});
}