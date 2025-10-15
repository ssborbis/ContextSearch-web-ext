function debounce(callback, time, id) {
  self.clearTimeout(self[id]);
  self[id] = self.setTimeout(callback, time);
}

function throttle(callback, time, id) {
	if (self[id]) return;

  self[id] = self.setTimeout(() => {
  	self.clearTimeout(self[id]);
  	delete self[id];
  }, time);
  
  callback();
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

function recentlyUsedListToFolder(context) {

	let folder = {
		type: "folder",
		id: "___recent___",
		title: i18n('Recent'),
		children: [],
		parent: (self.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/history.svg')
	}

	userOptions.recentlyUsedList.forEach( (id,index) => {
		if ( index > userOptions.recentlyUsedListLength -1 ) return;
		let lse = findNode(userOptions.nodeTree, node => node.id === id);

		// filter missing nodes
		if ( lse ) folder.children.push(Object.assign({}, lse));

		// filter contexts 
		if ( context && filterContexts ) {
			filterContexts(folder, contexts);
		}
	});

	return folder;
}

function matchingEnginesToFolder(s) {

	let folder = {
		type: "folder",
		id: "___matching___",
		title: i18n('regexmatches'),
		children: [],
		parent: (self.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/regex.svg'),
		groupFolder: '',
		groupColor: '#88bbdd'
	}

	if ( !s ) return folder;

	let matchingEngines = findNodes(userOptions.nodeTree, se => {

		if ( !se.matchRegex ) return false;

		return isMatchingRegex(se.matchRegex, s);

	});

	matchingEngines.forEach( se => {
		folder.children.push(Object.assign({}, se));
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
			|| element.closest("[contenteditable='true']")
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
	"toolBar": 						'tools',
	"menuBar": 						'menubar',
	"titleBar": 					'title',
	"searchBarContainer": 'search',
	"contextsBar": 				'contexts'
};

function isDarkMode() {
	return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isSameStringMinusLineBreaks(str1, str2) {
	return str1.replace(/(\r\n|\r|\n|\s+)/g, "").trim() == str2.replace(/(\r\n|\r|\n|\s+)/g, "").trim();
}

function gen() {
	return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}

const debug = (...args) => {
	if ( userOptions && userOptions.developerMode ) {
		try {
			let e = new Error();
			let stack = e.stack.trim().split('\n').pop();
			console.debug(...args, stack.replace(/.*\/(.*$:?)/, "$1"));
		} catch (error) {}
	}
}
const i18n = browser.i18n.getMessage;
const sendMessage = (o) => {
	if ( typeof notify === "function" ) return notify(o);
	else return browser.runtime.sendMessage(o);
}

function appendSanitizedHTML(html_str, el) {
	const parser = new DOMParser();
	const parsed = parser.parseFromString(html_str, `text/html`);
	const tags = parsed.body.childNodes;
	for (let i=0; i<tags.length;i++) {
		el.append(tags[i].cloneNode(true));
	}
}

async function hasPermission(permission) {
	try {
		if ( permission === '<all_urls>')
			return await browser.permissions.contains({origins: [permission]});
		else
			return await browser.permissions.contains({permissions: [permission]});
	} catch (error) {
		return false;
	}
}

function requestPermission(permission) {
	sendMessage({action: "openOptions", hashurl:"?permission=" + permission + "#requestPermissions"});
}

async function _executeScript(o) {

	if ( browser?.scripting?.executeScript ) { // v3
		
		const executeOptions = {
			target: {
				tabId: o.tabId,
				frameIds: [o.frameId],
				allFrames: o.allFrames
			},
			func: o.func,
			args: o.args,
			files: [o.file]
		}

		if ( !("func" in o )) delete executeOptions.function;
		if ( !("args" in o )) delete executeOptions.args;
		if ( !("frameId" in o )) delete executeOptions.target.frameIds;
		if ( !("allFrames" in o )) delete executeOptions.target.allFrames;
		if ( !("file" in o )) delete executeOptions.files;

		return browser.scripting.executeScript(executeOptions)
			.then(result => result.shift()?.result )
			.catch(error => debug(error));
	} else { // v2

		const _args = o.args ? o.args.map(a => {
			if ( typeof a === 'string' ) return '"' + a + '"';
			else return a.toString();
		}) : "";

		let code = "";
		if ( "func" in o ) code = "(" + o.func.toString() + ")(" + _args.toString() + ")";
		
		const executeOptions = {
			frameId: o.frameId,
			allFrames: o.allFrames,
			code: code,
			file: o.file
		}

		if ( !("frameId" in o )) delete executeOptions.frameId;
		if ( !("allFrames" in o )) delete executeOptions.allFrames;
		if ( !("file" in o )) delete executeOptions.file;
		if ( !("func" in o )) delete executeOptions.code;

		return browser.tabs.executeScript(o.tabId, executeOptions).then(result => result.shift())
			.catch(error => debug(error));
	}
}

class CopyPaste {
	constructor() {}

	static async read() {

		if ( ! await sendMessage({action: "hasPermission", permission: "clipboardRead"}) ) {
			requestPermission("clipboardRead");
			return "";
		}
		try {

			if ( !navigator.clipboard ) {
				console.log('navigator.clipboard not found');
				return "";
			}
			const t = await navigator.clipboard.readText();
			return t;
		} catch(error) {
			return "";
		}

	}

	static async write(str) {
		return navigator.clipboard.write([
	      new ClipboardItem({
	      	"text/plain": new Blob([str], { type: "text/plain" }),
	      })
	  ]);
	}

	static async copyRich() {

		const selection = document.getSelection();

	    // no selection. just get the searchTerms
	    if (!selection.rangeCount) {
	    	return CopyPaste.write(quickMenuObject.searchTerms);
	    } 

	    let range = selection.getRangeAt(0);  // Get the selected range

	    // Get the HTML content of the selection
	    const htmlContent = selection.toString();
	    const selectedHtml = range.cloneContents(); // Get the selected HTML (including tags, images, etc.)

	    if ( !htmlContent ) {
	    	return CopyPaste.write(quickMenuObject.searchTerms);
	    }

	    // Create a temporary div to hold the HTML content
	    const tempDiv = document.createElement('div');
	    tempDiv.appendChild(selectedHtml);  // Append the selected content to the div

	    // Copy the content to the clipboard using the Clipboard API
	    await navigator.clipboard.write([
	        new ClipboardItem({
	        	"text/plain": new Blob([tempDiv.innerText], { type: "text/plain" }),
	            "text/html": new Blob([tempDiv.innerHTML], { type: "text/html" })
	        })
	    ])
	    .then(() => {
	        console.log('Copied to clipboard successfully!');
	        return true;
	    })
	    .catch(err => {
	        console.error('Error copying rich text: ', err);
	        return false;
	    });
	} 

	static copyFallback() {
		let active = document.activeElement;
		const text = getRawSelectedText(document.activeElement) || quickMenuObject.searchTerms;

		if ( active && typeof active.selectionStart !== 'undefined' ) {
			return {start: active.selectionStart, end: active.selectionEnd};
		}

		save = () => {

			if ( active && typeof active.selectionStart !== 'undefined' ) {
				return {start: active.selectionStart, end: active.selectionEnd};
			}
		    const selection = window.getSelection();

		    return selection.rangeCount === 0 ? null : selection.getRangeAt(0);
		};

		// Restore the selection
		restore = (range) => {
			if ( active && typeof active.selectionStart !== 'undefined' ) {
				active.selectionStart = range.start;
				active.selectionEnd = range.end;
				active.focus();
				return;
			}
		    const selection = window.getSelection();

		    if ( range ) {
		    	selection.removeAllRanges();
		   		selection.addRange(range);
		   	}
		};

		window.suspendSelectionChange = true;

		let activeRange = save();
		
		var t = document.createElement("textarea");

		// Avoid scrolling to bottom
		t.style.top = "-1000px";
		t.style.left = "-1000px";
		t.style.position = "fixed";
		t.style.width = 0;
		t.style.height = 0;

		// execCommand('copy') will not work with hidden inputs
		// t.style.display = "none";

		t.value = text;

		document.body.appendChild(t);
		t.focus();
		t.select();

		try {
			document.execCommand('copy');
		} catch (_err) {
			console.log(_err);
		}

		document.body.removeChild(t);

		restore(activeRange);
		active.focus();

		// delay required in Waterfox
		setTimeout(() => window.suspendSelectionChange = false, 10);
	}

	static async copyImage(imageURL){
		const dataURI = await sendMessage({action: "fetchURI", url: imageURL});
		const blob = await (await fetch(dataURI)).blob();
		const item = new ClipboardItem({ [blob.type]: blob });
		navigator.clipboard.write([item]);
	}

	static async copy(msg) {
		if ( navigator?.clipboard ) {
			if ( ! await sendMessage({action: "hasPermission", permission: "clipboardWrite"}) ) {
				return requestPermission("clipboardWrite");
			}

			if ( userOptions.autoCopyImages && quickMenuObject.searchTermsObject.image ) {
				console.log('attempting to copy image to clipboard');
				return CopyPaste.copyImage(quickMenuObject.searchTermsObject.image);
			}

			if ( msg ) 
				return CopyPaste.write(msg);
			else
				return CopyPaste.copyRich();
		}	else 
			return CopyPaste.copyFallback();
	}

	static setSessionClipboard(msg) {
		return sendMessage({action: "setSessionClipboard", clipboardObject: {message: msg, date: Date.now()}});
	}

	static getSessionClipboard() {
		return sendMessage({action: "getSessionClipboard"});
	}

	static templateUsesClipboard(template) {
		if ( !template ) return false;
		return template.match(/{clipboard}|%c/) ? true: false;
	}
}
