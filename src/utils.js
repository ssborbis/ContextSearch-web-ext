window.TextEncoder = window.TextDecoder = null;

const debounce = (callback, time, id) => {
  window.clearTimeout(window[id]);
  window[id] = window.setTimeout(callback, time);
}

function runAtTransitionEnd(el, prop, callback, ms) {

	ms = ms || 25;

	if ( Array.isArray(prop)) {
		var remaining = prop.length;
		prop.forEach( _prop => {
			runAtTransitionEnd(el, _prop, () => {
				if ( --remaining === 0 ) callback();
			}, ms);
		});
		return;
	}

	let oldProp = null;
	let checkPropInterval = setInterval(() => {
		try {
			let newProp = window.getComputedStyle(el).getPropertyValue(prop);
			if ( newProp !== oldProp ) {
				oldProp = newProp;
				return;
			}

			clearInterval(checkPropInterval);
			callback();
		} catch (e) {
			clearInterval(checkPropInterval);
		}
		
	}, ms);
}

function recentlyUsedListToFolder() {

	let folder = {
		type: "folder",
		id: "___recent___",
		title: i18n('Recent'),
		children: [],
		parent: (window.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/history.svg')
	}

	userOptions.recentlyUsedList.forEach( (id,index) => {
		if ( index > userOptions.recentlyUsedListLength -1 ) return;
		let lse = findNode(userOptions.nodeTree, node => node.id === id);

		// filter missing nodes
		if ( lse ) folder.children.push(Object.assign({}, lse));
	});

	return folder;
}

function matchingEnginesToFolder(s) {

	let folder = {
		type: "folder",
		id: "___matching___",
		title: i18n('regexmatches'),
		children: [],
		parent: (window.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/regex.svg'),
		groupFolder: '',
		groupColor: '#88bbdd'
	}

	let matchingEngines = userOptions.searchEngines.filter( se => {

		if ( !se.matchRegex ) return false;

		return isMatchingRegex(se.matchRegex, s);

	});

	matchingEngines.forEach( se => {
		let node = findNode(userOptions.nodeTree, n => n.id === se.id )
		if ( node ) folder.children.push(Object.assign({}, node));
	});

	return folder;
}

function runMatchRegex(s, callback) {
	callback = callback || function() {};

	let lines = s.trim().split(/\n/);

	for ( let line of lines ) {

		line = line.trim();

		if ( !line ) continue;

		try { // match regex				
			let m = JSON.parse('[' + line.trim() + ']');
			let rgx = new RegExp(m[0], m[1] || 'g');

			callback( rgx );
			continue;
		} catch (error) {}

		try { // match regex
			let m = /^\/(.*)\/([a-z]+)$/.exec(line.trim());
			let rgx = new RegExp(m[1], m[2] || 'g');

			callback( rgx );
			continue;
		} catch (error) {}

		return false;
	}

	return true;
}

function runReplaceRegex(s, callback) {

	callback = callback || function() {};

	let lines = s.trim().split(/\n/);

	for ( let line of lines ) {

		line = line.trim();

		if ( !line ) continue;

		try { // replace regex					
			let m = JSON.parse('[' + line.trim() + ']');
			let rgx = new RegExp(m[0], m[2] || 'g');

			callback( rgx, m[1] );
			continue;
		} catch (error) {}

		try { // replace regex
			let m = /^\/(.*)(?<!\\)\/(.*)(?<!\\)\/([a-z]+)$/.exec(line.trim());
			let rgx = new RegExp(m[1], m[3] || 'g');

			callback( rgx, m[2].replaceAll("\\/", "/") );
			continue;
		} catch (error) {}

		return false;
	}

	return true;
}

const validateRegex = s => ( runMatchRegex(s) || runReplaceRegex(s) );

function isMatchingRegex(rgxStr, s) {
	let results = false;

	runMatchRegex(rgxStr, rgx => {
		if (rgx.test(s)) results = true;
	});

	return results;
}

function isTextBox(element) {

	return ( element && element.nodeType == 1 && 
		(
			element.nodeName == "TEXTAREA" ||
			(element.nodeName == "INPUT" && /^(?:text|email|number|search|tel|url|password)$/i.test(element.type)) ||
			element.isContentEditable
		)
	) ? true : false;
}

function createMaskIcon(src) {
	let tool = document.createElement('div');
	tool.className = 'tool';
	tool.style.setProperty('--mask-image', `url(${src})`);

	return tool;
}

const i18n_layout_titles = {
	"quickMenuElement": 	'quickmenu',
	"toolBar": 				'tools',
	"menuBar": 				'menubar',
	"titleBar": 			'title',
	"searchBarContainer": 	'search',
	"contextsBar": 			'contexts'
};

function isDarkMode() {
	return window.matchMedia && !!window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isSameStringMinusLineBreaks(str1, str2) {
	return str1.replace(/(\r\n|\r|\n|\s+)/g, "").trim() == str2.replace(/(\r\n|\r|\n|\s+)/g, "").trim();
}

async function isURLImage(url) {   
	let res = await fetch(url,{method:'HEAD'});
	let buff = await res.blob();
	return buff.type.startsWith('image/')
}

const log = console.log;
const debug = (...args) => {
	if ( userOptions && userOptions.developerMode )
		console.log(...args)
}
const i18n = browser.i18n.getMessage;
const sendMessage = browser.runtime.sendMessage;
