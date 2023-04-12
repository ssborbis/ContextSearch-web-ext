const themes = [
	{ name: "lite", path: "/styles/lite.css"},
	{ name: "dark", path: "/styles/dark.css"},
	// { name: "sunset", path: "/styles/sunset.css"},
	// { name: "blue", path: "/styles/blue.css"},
	{ name: "modern", path: "/styles/modern.css"},
	{ name: "modern dark", path: "/styles/modern-dark.css", requires: ["/styles/modern.css"]},
	{ name: "modern purple", path: "/styles/modern-purple.css", requires: ["/styles/modern.css"]},
	{ name: "modern sunset", path: "/styles/modern-sunset.css", requires: ["/styles/modern.css"]},
	{ name: "modern glass", path: "/styles/modern-glass.css", requires: ["/styles/modern.css"]}
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

	let themeName = userOptions.quickMenuTheme;

	if ( userOptions.autoTheme ) {
		themeName = isDarkMode() ? userOptions.autoThemeDark : userOptions.autoThemeLite;
	}

	theme = theme || themes.find( t => t.name === themeName ) || themes[0];

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
			styleEl.id = "CS_userStyles";
			styleEl.onload = () => { resolve(true) }

			document.head.appendChild(styleEl);
			document.body.getBoundingClientRect();
		} else resolve();
	});
}

function removeUserStyles() {
	let style = document.getElementById('CS_userStyles');
	if (style) style.parentNode.removeChild(style);
}

async function changeTheme(i) {
	let currentLink = document.querySelector('link[rel="stylesheet"].theme:not(.requires)');

	let currentThemeIndex = themes.findIndex(t => currentLink.href.endsWith(t.path));

	let theme = themes[((i + currentThemeIndex) % themes.length + themes.length) % themes.length];

	// remove all themes and requires
	document.querySelectorAll('link[rel="stylesheet"].theme').forEach( link => {
		link.parentNode.removeChild(link);
	})

	await setTheme(theme);

	runAtTransitionEnd(document.body, ["width", "height"], () => {
		resizeMenu({openFolder:true});
	}, 150);

	userOptions.quickMenuTheme = theme.name;

	saveUserOptions();
}

function nextTheme() { changeTheme(1) }
function previousTheme() { changeTheme(-1) }
