window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

// not jQuery 
var $ = s => document.getElementById(s) || document.querySelector(s);

// array for storage.local
var userOptions = {};

// Browse button for manual import
$("#selectMozlz4FileButton").addEventListener('change', ev => {
	
	let searchEngines = [];
	let file = ev.target.files[0];
	
	if ( $('#cb_overwriteOnImport').checked && confirm(browser.i18n.getMessage("ConfirmDeleteCustomSearchEngines")) ) {
		userOptions.nodeTree.children = [];
		userOptions.searchEngines = [];
	}
	
	readMozlz4File(file, text => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		searchEngines = searchJsonObjectToArray(engines);

		$('#status_div').style.display='inline-block';
		statusMessage({
			img: browser.runtime.getURL("icons/spinner.svg"),
			msg: browser.i18n.getMessage("LoadingRemoteContent"),
			color: "transparent",
			invert: false
		});

		let newEngines = [];
		
		for (let se of searchEngines) {
			
			if (!userOptions.searchEngines.find( _se => _se.title === se.title)) {
				console.log(se.title + " not included in userOptions.searchEngines");
				
				// add to searchEngines
				newEngines.push(se);
				
				let node = {
					type: "searchEngine",
					title: se.title,
					id: se.id,
					hidden: se.hidden || false
				}

				// replace one-click nodes with same name
				let ocn = findNodes(userOptions.nodeTree, (_node, parent) => {
					if ( _node.type === 'oneClickSearchEngine' && _node.title === se.title ) {
						parent.children.splice(parent.children.indexOf(_node), 1, node);
						return true;
					}
					return false;
				});
				
				if ( ocn.length ) {
					console.log(se.title + " one-click engine found. Replacing node");
				} else {
					// add to nodeTree
					userOptions.nodeTree.children.push(node);
				}
				
			}
		}
		// end 1.3.2+
		
		// get remote icons for new engines
		loadRemoteIcon({
			searchEngines: newEngines, // 1.3.2+
		}).then( (details) => {
			
			// append the new engines
			userOptions.searchEngines = userOptions.searchEngines.concat(details.searchEngines);
			saveOptions();
			
			if (details.hasFailedCount) {
				statusMessage({
					img: "icons/alert.svg",
					msg: browser.i18n.getMessage("LoadingRemoteContentFail").replace("%1", details.hasFailedCount),
					color: "transparent",
					invert: false
				});
			} else if (details.hasTimedOut) {
				statusMessage({
					img: "icons/alert.svg",
					msg: browser.i18n.getMessage("LoadingRemoteContentTimeout"),
					color: "transparent",
					invert: false
				});
			} else {
				statusMessage({
					img: "icons/checkmark.svg",
					msg: browser.i18n.getMessage("ImportedEngines").replace("%1", searchEngines.length).replace("%2", details.searchEngines.length),
					color: "#41ad49",
					invert: true
				});
			}

			buildSearchEngineContainer();
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/crossmark.svg",
			msg: browser.i18n.getMessage("FailedToLoad"),
			color: "red",
			invert: true
		});
	});

});

function statusMessage(status) {				
	$('#status_img').src = status.img || "";
	$('#status').innerText = status.msg || "";
	
	let img = $('#status_img');
	
	img.parentNode.style.backgroundColor = status.color;
	img.style.filter = status.invert ? 'invert(1)' : 'none';
	img.style.height = "20px";

}

async function restoreOptions(restoreUserOptions) {

	if ( restoreUserOptions ) return onGot(restoreUserOptions);

	function onGot(uo) {

		userOptions = uo;

		function traverse(o, parentKey) {
			for ( let key in o) {

				let longKey = ( parentKey ) ? parentKey + "." + key : key;

				let value = longKey.split('.').reduce((a, b) => a[b], defaultUserOptions);

				let type = typeof value;

				if ( type === 'object' && !Array.isArray(o[key]) )
					traverse(o[key], longKey);

				let el = document.getElementById(longKey);

				if ( !el ) continue;

				if ( type === 'boolean')
					el.checked = o[key];

				if ( type === 'string' || type === 'number' )
					el.value = o[key];	
			}
		}

		// restore settings with matching ids
		traverse(uo, null);
		
		$('#quickMenuKey').innerText = keyCodeToString(uo.quickMenuKey) || browser.i18n.getMessage('ClickToSet');
		$('#contextMenuKey').innerText = keyCodeToString(uo.contextMenuKey) || browser.i18n.getMessage('ClickToSet');

		for (let p of document.getElementsByClassName('position')) {
			p.classList.remove('active')
			if (p.dataset.position === uo.quickMenuPosition)
				p.classList.add('active');
		}

		$('#s_searchBarDefaultView').value = uo.searchBarUseOldStyle ? "text" : "grid";
		$('#s_quickMenuDefaultView').value = uo.quickMenuUseOldStyle ? "text" : "grid";
		$('#s_sideBarDefaultView').checked = uo.sideBar.singleColumn ? "text" : "grid";
		
		$('#userStyles').disabled = !uo.userStylesEnabled;
	
		$('#c_highLightColor0').value = uo.highLight.styles[0].color;
		$('#c_highLightBackground0').value = uo.highLight.styles[0].background;
		$('#c_highLightColor1').value = uo.highLight.styles[1].color;
		$('#c_highLightBackground1').value = uo.highLight.styles[1].background;
		$('#c_highLightColor2').value = uo.highLight.styles[2].color;
		$('#c_highLightBackground2').value = uo.highLight.styles[2].background;
		$('#c_highLightColor3').value = uo.highLight.styles[3].color;
		$('#c_highLightBackground3').value = uo.highLight.styles[3].background;
		$('#c_highLightColorActive').value = uo.highLight.activeStyle.color;
		$('#c_highLightBackgroundActive').value = uo.highLight.activeStyle.background;
		$('#s_highLightOpacity').value = uo.highLight.opacity;

		$('#style_dark').disabled = !uo.nightMode;

		$('#cb_quickMenuToolsLockPersist').checked = (() => {
			let tool = uo.quickMenuTools.find( t => t.name === "lock"); 
			return (tool) ? tool.persist || false : false;
		})();

		$('#cb_quickMenuToolsRepeatSearchPersist').checked = (() => {
			let tool = uo.quickMenuTools.find( t => t.name === "repeatsearch"); 
			return (tool) ? tool.persist || false : false;
		})();

		$('#blockList').value = uo.blockList.filter(el => el.trim()).join('\n');
		
		(() => {
			[
				{	id: "quickMenuIconForm", uri: uo.quickMenuIcon.url }, // quickMenu icon
				{	id: "toolBarIconForm", uri: uo.searchBarIcon } // toolBar icon
			].forEach( o => {

				let f = $(o.id);

				let radios = f.querySelectorAll(`input[type="radio"]`);
				let radio = [...radios].find( r => r.value === o.uri );
				if ( radio ) radio.checked = true;
				else setIconOption(f, o.uri);
			})
		})();

		function toggleDomElement(dom_str, el_str, on) {
			let els = dom_str.split(",");
			let i_on = els.indexOf(el_str);
			let i_off = els.indexOf("!" + el_str);

			let index = i_on !== -1 ? i_on : i_off;

			if ( index === -1 ) 
				els.push( on ? el_str : "!" + el_str);
			else
				els[index] = on ? el_str : "!" + el_str;

			return els.join(",");
		}

		// set up layout toggles
		(() => {
			let els = uo.quickMenuDomLayout.split(",");
			$("#quickMenuContextualLayoutToolbar").checked = els.includes("contextsBar") || !els.includes("!contextsBar");
			$("#quickMenuContextualLayoutToolbar").addEventListener('change', e => {
				userOptions.quickMenuDomLayout = toggleDomElement(userOptions.quickMenuDomLayout, "contextsBar", e.target.checked);
			})
		})();

		// allow context menu on right-click
		(() => {
			function onChange(e) {
				document.querySelector('[data-i18n="HoldForContextMenu"]').style.display = ( $('#quickMenuMouseButton').value === "3" && $('#quickMenuOnMouseMethod').value === "click" ) ? null : 'none';
				$('quickMenuMoveContextMenuMethod').parentNode.style.display = $('quickMenuMouseButton').value === "3" ? null : 'none';
			}
			
			[$('#quickMenuMouseButton'), $('#quickMenuOnMouseMethod')].forEach( s => {
				s.addEventListener('change', onChange);	
				onChange();
			});
		})();

		document.dispatchEvent(new CustomEvent('userOptionsLoaded'));
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	return new Promise( async (resolve, reject) => {
		await browser.runtime.sendMessage({action: "checkForOneClickEngines"});
		let uo = await browser.runtime.sendMessage({action: "getUserOptions"});
		onGot(uo);
		resolve();
	});	
}

function saveOptions(e) {
	debounce(_saveOptions, 250, "saveOptionsDebouncer");
}

function _saveOptions(e) {
	
	function onSet() {
		browser.browserAction.setIcon({path: userOptions.searchBarIcon || 'icons/logo_notext.svg'});
		showSaveMessage(browser.i18n.getMessage("saved"), null, document.getElementById('saveNoticeDiv'));
		$('configSize').innerText = JSON.stringify(userOptions).length + " bytes";
		return Promise.resolve(true);
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	function traverse(o, parentKey) {
		for ( let key in o) {

			let longKey = ( parentKey ) ? parentKey + "." + key : key;

			let type = typeof o[key];

			if ( type === 'object' && !Array.isArray(o[key]) )
				traverse(o[key], longKey);

			let el = document.getElementById(longKey);

			if ( !el ) continue;

			if ( type === 'boolean')
				o[key] = el.checked;

			if ( type === 'string' )
				o[key] = el.value;	

			if ( type === 'number' ) {
			 let i = parseInt(el.value);
			 let f = parseFloat(el.value);

			 o[key] = i == f ? i : f;
			}
		}
	}

	// restore settings with matching ids
	traverse(userOptions, null);

	
	let uo = {

		searchBarUseOldStyle: $('#s_searchBarDefaultView').value === "text",
		quickMenuUseOldStyle: $('#s_quickMenuDefaultView').value === "text",

		searchBarHistory: userOptions.searchBarHistory,
		searchBarIcon: $('#toolBarIconForm input[type="radio"]:checked').value,
		quickMenuIcon: {
			url: $('#quickMenuIconForm input[type="radio"]:checked').value
		},
		
		sideBar: {
			singleColumn:$('#s_sideBarDefaultView').value === "text",
			hotkey: []
		},
		
		highLight: {
			opacity: parseFloat($('#s_highLightOpacity').value),
			
			styles: [
				{	
					color: $('#c_highLightColor0').value,
					background: $('#c_highLightBackground0').value
				},
				{	
					color: $('#c_highLightColor1').value,
					background: $('#c_highLightBackground1').value
				},
				{	
					color: $('#c_highLightColor2').value,
					background: $('#c_highLightBackground2').value
				},
				{	
					color: $('#c_highLightColor3').value,
					background: $('#c_highLightBackground3').value
				}
			],
			activeStyle: {
				color: $('#c_highLightColorActive').value,
				background: $('#c_highLightBackgroundActive').value
			}

		},

		userStylesGlobal: (() => {
			
			let styleText = "";

			let styleEl = document.createElement('style');

			document.head.appendChild(styleEl);

			styleEl.innerText = $('#userStyles').value;
			styleEl.sheet.disabled = true;

			let sheet = styleEl.sheet;
			
			if ( !sheet ) return;

			for ( let i in sheet.cssRules ) {
				let rule = sheet.cssRules[i];
				
				if ( /^[\.|#]CS_/.test(rule.selectorText) )
					styleText+=rule.cssText + "\n";
			}
		
			styleEl.parentNode.removeChild(styleEl);
			
			return styleText;
		})(),

		blockList: $('#blockList').value.split(/\r?\n/),
	};

	merge(uo, userOptions);

	// prevent DeadObjects
	var setting = browser.runtime.sendMessage({action: "saveUserOptions", userOptions: JSON.parse(JSON.stringify(userOptions))});
	return setting.then(onSet, onError);
}

function merge(source, target) {
  for (const [key, val] of Object.entries(source)) {
    if (val !== null && typeof val === `object`) {
      if (target[key] === undefined) {
        target[key] = new val.__proto__.constructor();
      }
      merge(val, target[key]);
    } else {
      target[key] = val;
    }
  }
  return target;
}

document.addEventListener("DOMContentLoaded", async e => {

	// build the DOM
	makeTabs();
	buildPositionWidget();
	setVersion();
	buildAdvancedOptions();
	buildImportExportButtons();
	buildHelpTab();
	buildClearSearchHistory();
	buildSaveButtons();
	buildThemes();
	buildSearchActions();
	hideBrowserSpecificElements();

	// restore settings and set INPUT values
	await restoreOptions();

	// build DOM objects requiring prefs restored
	buildShortcutTable();
	buildSearchEngineContainer();
	buildToolIcons();
	sortAdvancedOptions();
//	buildAdditionalSearchActionsTable();

	addDOMListeners();

	hashChange();
	buildUploadOnHash();

	document.body.style.opacity = 1;

	// testing moving tools to SEM
	(() => {

		let ts = userOptions.quickMenuTools;

		let folder = {
			type:"folder",
			title:"Tools Menu",
			children:[],
			hidden:false,
			id:"tools_menu"
		}

		ts.forEach(t => {

			let tool = QMtools.find( _t => _t.name === t.name);

			folder.children.push({
				type: "tool",
				hidden: t.disabled,
				title: tool.title,
				icon: tool.icon,
				tool: tool.name
			})
		})

		console.log(folder);
	});

});

function addDOMListeners() {

	$('#autoPasteFromClipboard').addEventListener('change', async (e) => {
		
		if ( e.target.checked === true ) {
			e.target.checked = await browser.permissions.request({permissions: ["clipboardRead"]});
			saveOptions();
		}
	});

	$('#autoCopy').addEventListener('change', async (e) => {
		if ( e.target.checked === true ) {
			e.target.checked = await browser.permissions.request({permissions: ["clipboardWrite"]});
			saveOptions();
		}
	});

	["quickMenuScale", "sideBar.scale", "findBar.scale", "quickMenuIconScale"].forEach( id => {
		$(id).addEventListener('input', ev => {
			$(`i_${id}`).value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
		});

		$(id).dispatchEvent(new Event('input'));
	});

	$('#userStylesEnabled').addEventListener('change', e => {
		$('#userStyles').disabled = ! e.target.checked;
	});

	$('#quickMenuKey').addEventListener('click', keyButtonListener);
	$('#contextMenuKey').addEventListener('click', keyButtonListener);

	$('#syncWithFirefoxSearch').addEventListener('change', e => {
		$('#searchEnginesParentContainer').style.display = e.target.checked ? "none" : null;
	});

	$('#b_requestClipboardWritePermissions').addEventListener('click', async () => {
		await browser.permissions.request({permissions: ['clipboardWrite']});
		window.close();
	})

	$('#b_requestClipboardReadPermissions').addEventListener('click', async () => {
		await browser.permissions.request({permissions: ['clipboardRead']});
		window.close();
	})

	$('#b_requestDownloadsPermissions').addEventListener('click', async () => {
		await browser.permissions.request({permissions: ['downloads']});
		window.close();
	})

	$('#b_requestNativeMessagingPermissions').addEventListener('click', async () => {
		await browser.permissions.request({permissions: ['nativeMessaging']});
		window.close();
	})

	document.querySelectorAll('.updateNativeApp').forEach(el => el.addEventListener('click', checkAndUpdateNativeApp));

	// hide other request buttons
	$('[data-tabid="requestPermissionsTab"]').addEventListener('click', async () => {
		const urlParams = new URLSearchParams(window.location.search);
		if ( urlParams.get("permission")) {
			document.querySelectorAll('[data-permission]').forEach( div => {
				if ( div.dataset.permission !== urlParams.get("permission"))
					div.style.display = 'none';
			})
		}
	})
}

document.addEventListener('userOptionsLoaded', e => {
	$('#searchEnginesParentContainer').style.display = $('#syncWithFirefoxSearch').checked ? "none" : null;
});

function keyButtonListener(e) {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	e.target.appendChild(img);
	e.target.addEventListener('keydown', function(evv) {
	
		if ( evv.key === "Escape" ) {
			e.target.innerText = browser.i18n.getMessage('ClickToSet');
			e.target.value = 0;
		} else {
			e.target.innerText = keyCodeToString(evv.which);
			e.target.value = evv.which;
		}
		
		saveOptions(e);
		
		}, {once: true} // parameter to run once, then delete
	); 
}

function fixNumberInput(el, _default, _min, _max) {

	if (isNaN(el.value) || el.value === "") el.value = _default;
	if (!el.value.isInteger) el.value = Math.floor(el.value);
	if (el.value > _max) el.value = _max;
	if (el.value < _min) el.value = _min;
}

function getKeyString(keys) {
	if ( Array.isArray(keys) ) {
		keys.forEach((key, index) => {
			keys[index] = keyCodeToString(key);
		});
		
		console.log(keys);
	} else {
	}
}

function keyCodeToString(code) {
	if ( code === 0 ) return null;
	
	return keyTable[code] /*|| String.fromCharCode(code)*/ || code.toString();
}

function keyArrayToButtons(arr, options) {

	options = options || {}
	
	let div = document.createElement('div');
	
	function makeButton(str) {
		let span = document.createElement(options.nodeType || 'span');
		span.innerText = str;
		span.className = options.className || null;
		span.style = options.style || null;
		return span;
	}
	
	if ( Array.isArray(arr) ) {
	
		if (arr.length === 0) {
			div.innerText = 'text' in options ? options.text : browser.i18n.getMessage('ClickToSet') || "Click to set";
		}
		
		for (let i=0;i<arr.length;i++) {

			let hk = arr[i]
			let key = keyCodeToString(hk);
			if (key.length === 1) key = key.toUpperCase();
			
			div.appendChild(makeButton(key));
		}
	} else if ( typeof arr === 'object' ) {
		if ( arr.alt ) div.appendChild(makeButton("Alt"));
		if ( arr.ctrl ) div.appendChild(makeButton("Ctrl"));
		if ( arr.meta ) div.appendChild(makeButton("Meta"));
		if ( arr.shift ) div.appendChild(makeButton("Shift"));
		
		div.appendChild(makeButton(arr.key));
	} else {
		console.error('keyCodeToString error')
		return;
	}
	
	let buttons = div.querySelectorAll(options.nodeType || 'span');
	for ( let i=1;i<buttons.length;i++ ) {
		let spacer = document.createElement('span');
		spacer.innerHTML = '&nbsp;+&nbsp;';
		div.insertBefore(spacer, buttons[i]);
	}
	
	return div;
}

window.addEventListener('hashchange', hashChange);
	
// switch to tab based on params
function hashChange(e) {	

	let hash = location.hash.split("#");
	
	let buttons = document.querySelectorAll('.tablinks');
	
	// no hash, click first button
	if ( !hash || !hash[1] ) {
		buttons[0].click();
		return;
	}
	
	for ( button of buttons ) {
		if ( button.dataset.tabid.toLowerCase() === (hash[1] + "tab").toLowerCase() ) {
			button.click();
			break;
		}
	}
}

function makeTabs() {
	
	let tabs = document.getElementsByClassName("tablinks");
	for (let tab of tabs) {
		tab.addEventListener('click', e => {

			document.querySelectorAll('.tabcontent').forEach( el => {
				el.style.display = "none";
			});
				
			// Get all elements with class="tablinks" and remove the class "active"
			for (let tablink of document.getElementsByClassName("tablinks"))
				tablink.classList.remove('active');

			// Show the current tab, and add an "active" class to the button that opened the tab
			document.getElementById(e.target.dataset.tabid).style.display = "block";
			e.currentTarget.classList.add('active');
			
			location.hash = e.target.dataset.tabid.toLowerCase().replace(/tab$/,"");
		});
	}
}

function buildToolIcons() {

	function getToolIconIndex(element) {
		return [].indexOf.call(document.querySelectorAll('.toolIcon'), element);
	}
	function dragstart_handler(ev) {
		ev.currentTarget.style.border = "dashed transparent";
		ev.dataTransfer.setData("text", getToolIconIndex(ev.target));
		ev.effectAllowed = "copyMove";
	}
	function dragover_handler(ev) {
		for (let icon of document.getElementsByClassName('toolIcon'))
			icon.style.backgroundColor='';
		
		ev.target.style.backgroundColor='#ddd';
		ev.preventDefault();
	}
	function drop_handler(ev) {
		ev.preventDefault();
		
		ev.target.style.border = '';
		ev.target.style.backgroundColor = '';
		let old_index = ev.dataTransfer.getData("text");
		let new_index = getToolIconIndex(ev.target);

		ev.target.parentNode.insertBefore(document.getElementsByClassName('toolIcon')[old_index], (new_index > old_index) ? ev.target.nextSibling : ev.target);
	}
	function dragend_handler(ev) {
		ev.target.style.border = '';
		saveQuickMenuTools();
	}
	function saveQuickMenuTools() {
		let tool_buttons = document.querySelectorAll('#toolIcons .toolIcon');

		userOptions.quickMenuTools = [];

		tool_buttons.forEach(b => {
			let tool = { name: b.name, disabled: b.disabled};

			if ( b.name === "lock" ) tool.persist = $('#cb_quickMenuToolsLockPersist').checked;
			if ( b.name === "repeatsearch" ) tool.persist = $('#cb_quickMenuToolsRepeatSearchPersist').checked;

			userOptions.quickMenuTools.push(JSON.parse(JSON.stringify(tool)));
		});

		saveOptions();
	}
	
	var toolIcons = [];
	
	QMtools.forEach( tool => {
		toolIcons.push({name: tool.name, src: tool.icon, title: tool.title, index: Number.MAX_VALUE, disabled: true});
	});

	toolIcons.forEach( toolIcon => {
		toolIcon.index = userOptions.quickMenuTools.findIndex( tool => tool.name === toolIcon.name );

		if (toolIcon.index === -1) {
			userOptions.quickMenuTools.push({name: toolIcon.name, disabled: true});
			toolIcon.index = userOptions.quickMenuTools.length -1;
		}
		toolIcon.disabled = userOptions.quickMenuTools[toolIcon.index].disabled;
	});

	toolIcons = toolIcons.sort(function(a, b) {
		return (a.index < b.index) ? -1 : 1;
	});

	for (let icon of toolIcons) {
		let img = document.createElement('div');
		img.disabled = icon.disabled;
		img.style.opacity = (img.disabled) ? .4 : 1;
		img.className = 'toolIcon';
		img.setAttribute('draggable', true);
		img.src = icon.src;
		img.setAttribute('data-title',icon.title);
		img.name = icon.name;
		img.classList.add('tool');
		img.style.setProperty('--mask-image', `url(${icon.src})`);

		img.addEventListener('dragstart',dragstart_handler);
		img.addEventListener('dragend',dragend_handler);
		img.addEventListener('drop',drop_handler);
		img.addEventListener('dragover',dragover_handler);

		img.addEventListener('click',e => {
			img.disabled = img.disabled || false;
			img.style.opacity = img.disabled ? 1 : .4;
			img.disabled = !img.disabled;
			saveQuickMenuTools();	
		});
		
		let t_toolIcons = $('#t_toolIcons');
		img.addEventListener('mouseover', e => {
			t_toolIcons.innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', e => {
			t_toolIcons.innerText = browser.i18n.getMessage(t_toolIcons.dataset.i18n);
		});

		$('#toolIcons').appendChild(img);
	}
}

function buildPositionWidget() {
	for (let el of document.getElementsByClassName('position')) {
		el.addEventListener('click', e => {
			for (let _el of document.getElementsByClassName('position'))
				_el.className = _el.className.replace(' active', '');
			el.className+=' active';
			$('#quickMenuPosition').value = el.dataset.position;
			saveOptions();
		});
		
		let t_position = $('#t_position');
		el.addEventListener('mouseover', e => {
			let parts = e.target.dataset.position.split(" ");
			t_position.innerText = browser.i18n.getMessage("PositionRelativeToCursor").replace("%1", browser.i18n.getMessage(parts[0])).replace("%2",browser.i18n.getMessage(parts[1]));
		});
		
		el.addEventListener('mouseout', e => {
			t_position.innerText = browser.i18n.getMessage(t_position.dataset.i18n);
		});
		
	}
	
}

function setVersion() {
	$('#version').innerText = "" + browser.runtime.getManifest().version;
}

// browser-specific modifications
function hideBrowserSpecificElements() {
	if (!browser.runtime.getBrowserInfo) {
		for (let el of document.querySelectorAll('[data-browser="firefox"]'))
			el.style.display = 'none';
	} else {
		browser.runtime.getBrowserInfo().then( info => {
			let version = info.version;
			document.querySelectorAll('[data-browser="firefox"][data-minversion]').forEach( el => {
				if ( parseFloat(el.dataset.minversion) > parseFloat(info.version) )
					el.style.display = 'none';
			});	
		});
	}
}

function showInfoMsg(el, msg) {
	let div = $('#info_msg');
		
	let parsed = new DOMParser().parseFromString(msg, `text/html`);
	let tag = parsed.getElementsByTagName('body')[0];
				
	div.innerHTML = null;
	let point = document.createElement('div');
	point.className = 'point';
	div.appendChild(point);
	div.appendChild(tag.firstChild);

	let rect = el.getBoundingClientRect()

	div.style.top = rect.top + window.scrollY + 26 + 'px';
	div.style.left = rect.left + rect.width / 2 + window.scrollX - 16 + 'px';
	
	if (rect.left > ( window.innerWidth - 220) )
		div.style.left = parseFloat(div.style.left) - 230 + "px";
	
	div.style.display = 'block';

}

// set up info bubbles
// function buildInfoBubbles() {
	
// 	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
// 	for (let el of i18n_tooltips) {
// 		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip') || el.dataset.msg || el.dataset.i18n_tooltip;
		
// 		el.addEventListener('mouseenter', e => {
// 			showInfoMsg(el, el.dataset.msg);
// 		});
		
// 		el.addEventListener('mouseleave', e => {
// 			$('#info_msg').style.display = 'none';
// 		});
// 	}
// }

// import/export buttons
function buildImportExportButtons() {
	
	function download(filename, json) {

		var blob = new Blob([json], {type: "application/json"});
		var url  = URL.createObjectURL(blob);

		var a = document.createElement('a');
		a.href        = url;
		a.download    = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	
	let b_export = $('#b_exportSettings');
	b_export.onclick = function() {

		let date = new Date().toISOString().replace(/:|\..*/g,"").replace("T", "_");
		
		if ( userOptions.exportWithoutBase64Icons ) {
			let uoCopy = Object.assign({}, userOptions);
			uoCopy.searchEngines.forEach( se => se.icon_base64String = "");
			findNodes(uoCopy.nodeTree, node => {
				if ( node.type === "oneClickSearchEngine" )
					node.icon = "";
			});
			download(`ContextSearchOptions_${date}.json`, JSON.stringify(uoCopy));
		} else {
			download(`ContextSearchOptions_${date}.json`, JSON.stringify(userOptions));
		}
	}
	
	let b_import = $('#b_importSettings');
	b_import.onclick = function() {
		$('#importSettings').click();
	}
	
	$('#importSettings').addEventListener('change', e => {
		var reader = new FileReader();

		// Closure to capture the file information.
		reader.onload = async () => {
			try {
				let newUserOptions = JSON.parse(reader.result);
				
				// run a few test to check if it's valid
				if ( 
					typeof newUserOptions !== 'object'
					|| newUserOptions.quickMenu === undefined
					|| !newUserOptions.searchEngines
					
				) {
					alert(browser.i18n.getMessage("ImportSettingsNotFoundAlert"));
					return;
				}
				
				// update imported options
				let _uo = await browser.runtime.sendMessage({action: "updateUserOptionsObject", userOptions: newUserOptions})
				
				try {
					_uo = await browser.runtime.sendMessage({action: "updateUserOptionsVersion", userOptions: _uo})		
				} catch ( error ) {
					console.log(error);
					if ( !confirm("Failed to update config. This may cause some features to not work. Install anyway?"))
						return;
				}

				// load icons to base64 if missing
				let overDiv = document.createElement('div');
				overDiv.style = "position:fixed;left:0;top:0;height:100%;width:100%;z-index:9999;background-color:rgba(255,255,255,.85);background-image:url(icons/spinner.svg);background-repeat:no-repeat;background-position:center center;background-size:64px 64px;line-height:100%";
				let msgDiv = document.createElement('div');
				msgDiv.style = "text-align:center;font-size:12px;color:black;top:calc(50% + 44px);position:relative;background-color:white";
				msgDiv.innerText = browser.i18n.getMessage("Fetchingremotecontent");
				overDiv.appendChild(msgDiv);
				document.body.appendChild(overDiv);
				let sesToBase64 = _uo.searchEngines.filter(se => !se.icon_base64String);
				let details = await loadRemoteIcon({searchEngines: sesToBase64, timeout:10000});
				_uo.searchEngines.forEach( (se,index) => {
					let updatedSe = details.searchEngines.find( _se => _se.id === se.id );
					
					if ( updatedSe ) _uo.searchEngines[index].icon_base64String = updatedSe.icon_base64String;
				});
				
				// load OCSE favicons
				if ( browser.search && browser.search.get ) {
					let ocses = await browser.search.get();
					findNodes(_uo.nodeTree, node => {
						if ( node.type === "oneClickSearchEngine" ) {
							let ocse = ocses.find(_ocse => _ocse.name === node.title);	
							if ( ocse ) node.icon = ocse.favIconUrl;
						}
					});
				} else {
					findNodes(_uo.nodeTree, node => {
						if ( node.type === "oneClickSearchEngine" ) node.hidden = true;
					});
				}

				userOptions = _uo;
				await browser.runtime.sendMessage({action: "saveUserOptions", userOptions: _uo});
				location.reload();
				

			} catch(err) {
				console.log(err);
				alert(browser.i18n.getMessage("InvalidJSONAlert"));
			}
		}

      // Read in the image file as a data URL.
      reader.readAsText(e.target.files[0]);
	});
}

// click element listed in the hash for upload buttons
function buildUploadOnHash() {
	let params = new URLSearchParams(window.location.search);
	
	if (params.has('click')) {
		document.getElementById(params.get('click')).click();
		history.pushState("", document.title, window.location.pathname);
	}
}



function buildHelpTab() {

	function traverse(node) {
		
		if (node.nodeType === 3 && node.nodeValue.trim())
			return node;

		for (let child of node.childNodes) {
			let c = traverse(child);
			if (c) return c;
		}
		
		return false;
	}
	
	let i18n = document.querySelectorAll('[data-i18n]');
	
	for (let el of i18n) {

		let textNode = traverse(el);
		
		if (browser.i18n.getMessage(el.dataset.i18n)) {
			textNode.nodeValue = browser.i18n.getMessage(el.dataset.i18n);
			
			if (el.title === "i18n_text")
				el.title = browser.i18n.getMessage(el.dataset.i18n);
		}

	}

	// replace new-style titles
	document.querySelectorAll('[title^="$"]').forEach( el => {
		el.title = browser.i18n.getMessage(el.title.replace(/^\$/, "") );
		el.style.cursor = "help";
	});

	// add locale-specific styling
	var link = document.createElement( "link" );
	link.href = browser.runtime.getURL('/_locales/' + browser.i18n.getUILanguage() + '/style.css');
	link.type = "text/css";
	link.rel = "stylesheet";
	document.getElementsByTagName( "head" )[0].appendChild( link );
	
	// set up localized help pages
	let help = $('#helpTab');
	
	let loaded = false;
	let iframe = document.createElement('iframe');
	
	iframe.style = 'display:none';
	iframe.onerror = function() {
		console.log('error');
	}
	
	iframe.onload = function() {
		console.log('loaded @ ' + iframe.src);
		var iframeDocument = iframe.contentDocument;
		
		if (!iframeDocument) return;
		
		var iframeBody = iframeDocument.body;
		
		const parser = new DOMParser();
		const parsed = parser.parseFromString(iframeBody.innerHTML, `text/html`);
		
		for (let child of parsed.getElementsByTagName('body')[0].childNodes) {
			help.appendChild(child);
		}

		help.removeChild(iframe);
		
		help.querySelectorAll("[data-gif]").forEach( el => {
			el.addEventListener('click', _e => {
				let div = document.createElement('div');
				div.style = 'position:fixed;top:0;bottom:0;left:0;right:0;background-color:rgba(0,0,0,.8);z-index:2;text-align:center';
				
				div.onclick = function() {
					div.parentNode.removeChild(div);
				}
				
				let img = document.createElement('img');
				img.src = el.dataset.gif;
				img.style.maxHeight = '75vh';
				img.style.marginTop = '12.5vh';
				img.style.maxWidth = '75vw';
					
				img.onload = function() {
					div.appendChild(img);
					el.style.backgroundImage = 'url("' + img.src + '")';
					el.style.backgroundSize = '100% 100%';
				}
				
				help.appendChild(div);
			});
		});
	}
	
	setTimeout(() => {
		if (!loaded) iframe.src = '/_locales/' + browser.runtime.getManifest().default_locale + '/help.html';
	}, 250);
	
	iframe.src = '/_locales/' + browser.i18n.getUILanguage() + '/help.html';
	
	help.appendChild(iframe);

}
	
function buildClearSearchHistory() {
	let div = $('#d_clearSearchHistory');
	div.animating = false;
	div.onclick = function() {
		if (div.animating) return false;
		div.animating = true;
		
		userOptions.searchBarHistory = [];
		saveOptions();
		
		let yes = document.createElement('div');
		yes.className = 'yes';
		yes.style.verticalAlign = 'top';
		yes.style.height = yes.style.width = '1em';
		div.appendChild(yes);
		
		yes.addEventListener('transitionend', e => {
			div.removeChild(yes);
			div.animating = false;
		});
		
		yes.getBoundingClientRect();
		yes.style.opacity = 0;
	}
}

function showSaveMessage(str, color, el) {

	// clear and set save message
	el.innerHTML = null;	
	let msgSpan = document.createElement('span');

	msgSpan.style = "display:inline-block;font-size:10pt;font-family:'Courier New', monospace;font-weight:600;opacity:1;transition:opacity 1s .75s;padding:1px 12px;border-radius:8px;box-shadow:4px 4px 8px #0003;border:2px solid var(--border1)";
	msgSpan.style.backgroundColor = "var(--bg-color2)";
	msgSpan.innerText = str;

	let div = document.createElement('div')
	div.className = 'yes';
	div.style.verticalAlign = 'middle';
	div.style.marginRight = '16px';
	div.style.marginLeft = '0';
	div.style.height = div.style.width = "1em";
	msgSpan.insertBefore(div, msgSpan.firstChild);

	el.appendChild(msgSpan);
	
	msgSpan.addEventListener('transitionend', e => {
		msgSpan.parentNode.removeChild(msgSpan);
	});

	msgSpan.getBoundingClientRect(); // reflow
	msgSpan.style.opacity = 0;
}

function buildSaveButtons() {
	document.querySelectorAll('BUTTON.saveOptions').forEach( button => {
		button.onclick = saveOptions;
	});
}

function buildSearchActions() {

	function addOption(el, keys) {

		let actions = {
			"openFolder": {i18n:"SearchActionsOpenFolder"},
			"openCurrentTab": {i18n: "SearchActionsCurrentTab"},
			"openNewTab": {i18n: "SearchActionsNewTab"},
			"openBackgroundTab": {i18n: "SearchActionsBackgroundTab"},
			"openBackgroundTabKeepOpen": {i18n: "SearchActionsBackgroundTabKeepOpen"},
			"openNewWindow": {i18n: "SearchActionsNewWindow"},
			"openNewIncognitoWindow": {i18n: "SearchActionsIncognitoWindow"},
			"openSideBarAction": {i18n: "SearchActionsSidebarAction", browser: "firefox", minversion: "62"},
			"keepMenuOpen": {i18n: "KeepMenuOpen"},
			"noAction": {i18n: "SearchActionsNoAction"}
		};

		for ( let key in actions ) {

			if ( !keys.includes(key) ) continue;

			let o = document.createElement('option');
			o.value = key;
			o.innerText = browser.i18n.getMessage(actions[key].i18n);

			for ( let data in actions[key]) 
				o.dataset[data] = actions[key][data];

			el.appendChild(o);
		}
	}

	document.querySelectorAll('[data-searchaction]').forEach( el => {
		addOption(el, el.dataset.searchaction.split(","));
	});
}

// generate new search.json.mozlz4 
$("#replaceMozlz4FileButton").addEventListener('change', ev => {
	
	let searchEngines = [];
	let file = ev.target.files[0];
	
	// create backup with timestamp
	exportFile(file, "search.json.mozlz4_" + Date.now() );
	
	readMozlz4File(file, text => { // on success

		// parse the mozlz4 JSON into an object
		var json = JSON.parse(text);	

		let nodes = findNodes(userOptions.nodeTree, n => ["searchEngine", "oneClickSearchEngine"].includes(n.type) );
		
		// console.log(json.engines);
		
		let ses = [];

		nodes.forEach( n => {
			if ( n.type === "searchEngine" ) {
				let se = userOptions.searchEngines.find( _se => _se.id === n.id );
				if ( se ) ses.push(CS2FF(se));
			}
			
			if ( n.type === "oneClickSearchEngine" ) {
				let ocse = json.engines.find( _ocse => _ocse._name === n.title );
				if ( ocse ) ses.push(ocse);
			}
		});

		for ( let i in ses) ses[i]._metaData.order = i;
		
		// console.log(ses);

		json.engines = ses;

		exportSearchJsonMozLz4(JSON.stringify(json));
		
	});
	
	function CS2FF(se) {

		let ff = {
			_name: se.title,
			_loadPath: "[other]addEngineWithDetails",
			description: se.title,
			__searchForm: se.searchForm,
			_iconURL: se.icon_base64String,
			_metaData: {
				alias: null,
				order: null
			},
			_urls: [
				{
					method: se.method,
					params: se.params,
					rels: [],
					template: se.template
				}
			],
			_isAppProvided: false,
			_orderHint: null,
			_telemetryId: null,
			_updateInterval: null,
			_updateURL: null,
			_iconUpdateURL: null,
			_filePath: null,
			_extensionID: null,
			_locale: null,
			_definedAliases: [],
			queryCharset: se.queryCharset.toLowerCase()
		}
		
		return ff;
	}
});

$('#nightmode').addEventListener('click', () => {
	userOptions.nightMode = !userOptions.nightMode;

	$('#style_dark').disabled = !userOptions.nightMode;
	saveOptions();
});

function buildThemes() {
	$('#quickMenuTheme').innerHTML = null;
	themes.forEach( t => {
		let option = document.createElement('option');
		option.value = t.name;
		option.innerText = browser.i18n.getMessage(t.name.replace(" ","_")) || t.name;
		$('#quickMenuTheme').appendChild(option);
	});
}

$('#b_cacheIcons').addEventListener('click', cacheAllIcons);

$('#b_uncacheIcons').addEventListener('click', e => {
	if ( confirm('remove all icon cache?'))	{
		uncacheIcons();
		saveOptions();
	}
});

function cacheAllIcons(e) {
	let result = cacheIcons();
	let msg = document.createElement('div');
	msg.style = "margin:2px";
	msg.innerText = "cache progress";
	e.target.parentNode.insertBefore(msg, e.target.nextSibling);

	let interval = setInterval(() => {
		msg.innerText = `caching ${result.count - 1} / ${userOptions.searchEngines.length}`;
	}, 100);

	result.oncomplete = function() {
		clearInterval(interval);
		if ( result.bad.length )
			msg.innerText = "some icons could not be cached";
		else
			msg.innerText = "done";

		setTimeout(() => {
			if (msg && msg.parentNode ) msg.parentNode.removeChild(msg);
		}, 5000);

		saveOptions();
	}

	result.cache();
}

function buildShortcutTable() {
	let table = $('#shortcutTable');

	setButtons = (el, key) => {
		el.innerText = null;
		el.appendChild(keyArrayToButtons(key));
	}

	defaultToUser = key => {
		return {
			alt: key.alt,
			shift: key.shift,
			ctrl: key.ctrl,
			meta: key.meta,
			key: key.key,
			id: key.id,
			enabled: key.enabled || false
		}
	}

	defaultShortcuts.sort((a,b) => a.name > b.name).forEach( s => {

		const us = userOptions.userShortcuts.find(_s => _s.id == s.id);
		const ds = defaultToUser(s);

		let tr = document.createElement('tr');
		tr.shortcut = s;
		tr.appendChild(document.createElement('td'));
		tr.appendChild(document.createElement('td'))
			.appendChild(document.createTextNode(browser.i18n.getMessage(s.name) || s.name || s.action));

		let span = tr.appendChild(document.createElement('td').appendChild(document.createElement('span')));
		span.title = browser.i18n.getMessage("ClickToSet");
		span.dataset.id = s.id;
		span.style = "cursor:pointer;user-select:none;";
		span.innerText = 'set';

		table.appendChild(tr);

		let input = document.createElement('input');
		input.type = "checkbox";
		input.checked = us ? us.enabled : false;

		input.onchange = () => {
			let key = userOptions.userShortcuts.find(_s => _s.id == s.id) || defaultToUser(s);
			key.enabled = input.checked;
			setUserShortcut(key);
		}

		tr.querySelector('td').appendChild(input);
		
		const b = tr.querySelector('span')
		setButtons(b, us || ds);

		b.onclick = async () => {

			let key = await shortcutListener(b);

			if ( !key )
				setUserShortcut(ds);
			else {
				key.id = ds.id;
				setUserShortcut(key);
			}

			setButtons(b, key || ds);
		}
	});

	function setUserShortcut(key) {
		if ( ! 'id' in key ) throw new Error('NO_ID');

		key = defaultToUser(key);

		let us = userOptions.userShortcuts.find( s => s.id == key.id);

		if ( us ) {
			key.enabled = us.enabled;
			userOptions.userShortcuts.splice(userOptions.userShortcuts.indexOf(us), 1, key);
		} else userOptions.userShortcuts.push(key);

		saveOptions();
	}

	function shortcutListener(hk, options) {

		options = options || {};

		return new Promise(resolve => {
				
			preventDefaults = e => {
				e.preventDefault();
				e.stopPropagation();
			}

			document.addEventListener('keydown', preventDefaults);
			document.addEventListener('keypress', preventDefaults);
			
			hk.innerHTML = '<img src="/icons/spinner.svg" style="height:1em;margin-right:10px;vertical-align:middle" /> ';
			hk.appendChild(document.createTextNode(browser.i18n.getMessage('PressKey')));
					
			document.addEventListener('keyup', e => {
				
				e.preventDefault();
				e.stopPropagation();
				
				if ( e.key === "Escape" ) {
					hk.innerHTML = null;
					hk.appendChild(keyArrayToButtons(options.defaultKeys || []));
					resolve(null);
					return;
				}
				
				let key = {
					alt: e.altKey,
					ctrl: e.ctrlKey,
					meta: e.metaKey,
					shift: e.shiftKey,
					key: e.key
				}
				
				hk.innerHTML = null;
				hk.appendChild(keyArrayToButtons(key));
									
				document.removeEventListener('keydown', preventDefaults);
				document.removeEventListener('keypress', preventDefaults);

				resolve(key);
				
			}, {once: true});
		});	
	}
}

function imageUploadHandler(el, callback) {

	el.addEventListener('change', e => {

		let file = e.target.files[0];
		
		var reader = new FileReader();
		
		reader.addEventListener("load", function () {
			
			let img = new Image();
			
			img.onload = function() {
				callback(img);
			}
			img.src = reader.result;
			
		}, false);
		
		reader.readAsDataURL(file);
		
	});
}

[$('toolBarIconForm'), $('quickMenuIconForm')].forEach( el => {
	imageUploadHandler(el, img => {
		let uri = imageToBase64(img, 32);
		setIconOption(el,  uri);
		saveOptions();
	});
});

function setIconOption(el, uri) {
	el.querySelector('.iconCustom').style.backgroundImage = `url(${uri})`;

	let lastOpt = el.querySelector('input[type="radio"][id$="3"]');
	lastOpt.checked = true;
	lastOpt.value = uri;
}

function buildAdvancedOptions() {

	function makeInput( key ) {

		let value = key.split('.').reduce((a, b) => a[b], defaultUserOptions);

		let type = typeof value;

		let el = document.createElement('input');

		el.id = key;

		if ( type === 'boolean')
			el.type = 'checkbox';

		if ( type === 'string' )
			el.type = 'input';
		
		if ( type === 'number' )
			el.type = 'number';

		return el;
	}

	advancedOptions.forEach( o => {
		let tr = document.createElement('tr');
		let td1 = document.createElement('td');
		let td2 = document.createElement('td');

		tr.appendChild(td1);
		tr.appendChild(td2);

		td1.innerText = o.id;
		td1.title = browser.i18n.getMessage(o.id.replace(".", "_") + "Tooltip") || o.i18n;
		td1.style.cursor = 'help';

		td2.appendChild(makeInput(o.id));


		$('advancedSettingsTable').appendChild(tr);
	})
}

function sortAdvancedOptions() {
	let table = $('#advancedSettingsTable');

	let trs = table.querySelectorAll('tr');

	trs = [...trs].sort((a,b) => {
		return a.querySelector('td').innerText > b.querySelector('td').innerText ? 1 : -1;
	});
	table.innerHTML = null;
	trs.forEach( tr => table.appendChild(tr));

	// // move 
	// let save = table.querySelector('.moveToEnd');
	// table.appendChild(save);
}

function syntaxHighlight(json) {
    if (typeof json != 'string') {
         json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function buildAdditionalSearchActionsTable() {
	let table = $("additionalSearchActionsTable");

	table.querySelectorAll("TR:not(.template)").forEach( tr => tr.parentNode.removeChild(tr));
	userOptions.customSearchActions.forEach( (sa,index) => {
		let row = table.querySelector(".template").cloneNode(true);
		row.className = null;

		table.appendChild(row);

		row.querySelector('.event').value = sa.event;
		row.querySelector('.button').value = sa.button;
		row.querySelector('.altKey').value = sa.altKey;
		row.querySelector('.ctrlKey').value = sa.ctrlKey;
		row.querySelector('.metaKey').value = sa.metaKey;
		row.querySelector('.shiftKey').value = sa.shiftKey;
	});
}

// "event":"mouseup",
// 		"button":0,
// 		"altKey":false,
// 		"ctrlKey":false,
// 		"metaKey":false,
// 		"shiftKey":false,
// 		"action": "",
// 		"folder":false

// window.addEventListener('focus', async e => {
// 	let uo = await browser.runtime.sendMessage({action: 'getUserOptions'});

// 	if ( JSON.stringify(uo) !== JSON.stringify(userOptions))
// 		console.log('changed');
// })

// saveOptions on every change
document.addEventListener('change', e => {
	
	// skip modal forms
	if ( e.target.closest('.editForm')) return;

	saveOptions();
});

$('b_manualEdit').addEventListener('click', e => {

	let on = $('advancedSettingsTable').style.display == 'none' ? true : false;

	if ( !on ) {

		if ( !confirm(browser.i18n.getMessage("manualeditwarning"))) return;

		$('t_manualEdit').style.height = window.innerHeight - 120 + "px";//$('advancedSettingsTable').getBoundingClientRect().height + "px";
		$('advancedSettingsTable').style.display = 'none';
		[$('t_manualEdit'), $('b_manualSave')].forEach( el => el.style.display=null );

		let o = JSON.parse(JSON.stringify(userOptions));
		delete o.searchEngines;
		delete o.searchBarHistory;
		delete o.nodeTree;

		const ordered = Object.keys(o).sort().reduce(
		  (obj, key) => { 
		    obj[key] = o[key]; 
		    return obj;
		  }, 
	  	{}
		);

		$('t_manualEdit').innerHTML = syntaxHighlight(JSON.stringify(ordered, null, 4))
	} else {
		 $('advancedSettingsTable').style.display = null;
		 [$('t_manualEdit'), $('b_manualSave')].forEach( el => el.style.display='none' );
		 $('b_manualSave').classList.remove('changed');
	}
})

$('t_manualEdit').addEventListener('input', e => {
	$('b_manualSave').classList.add('changed');
});

$('b_manualSave').addEventListener('click', e => {
	try {
		let uo = JSON.parse($('t_manualEdit').innerText);
		merge(uo, userOptions);

		restoreOptions(userOptions);
		saveOptions();

		$('b_manualSave').classList.remove('changed');

	} catch (err) { alert(err) }
	
});

$("#b_resetUserOptions").addEventListener('click', e => {
	if ( confirm(browser.i18n.getMessage("resetUserOptionsConfirm")) ) {
		newUserOptions = JSON.parse(JSON.stringify(defaultUserOptions));
		newUserOptions.searchEngines = JSON.parse(JSON.stringify(userOptions.searchEngines));
		newUserOptions.nodeTree = JSON.parse(JSON.stringify(userOptions.nodeTree));

		browser.runtime.sendMessage({action: "saveUserOptions", userOptions: newUserOptions})
			.then(() => location.reload());
	}
});

function createEditMenu() {

	let overdiv = document.createElement('div');
	overdiv.className = 'overDiv';
	overdiv.style.opacity = 0;
	document.body.appendChild(overdiv);

	// chrome fix for menu closing on text select events
	overdiv.onmousedown = e => {
		if ( overdiv !== e.target) return;
		overdiv.mousedown = true;
	}

	overdiv.onclick = e => {
		if ( !overdiv.mousedown ) return;
		if ( overdiv !== e.target) return;
	}

	let formContainer = document.createElement('div');
	formContainer.id = "floatingEditFormContainer";
	formContainer.style = "width:90%;height:90%;";

	let fb = document.createElement('ul');
	fb.id = 'qm_browser';
	fb.className = 'folderBrowser';

	formContainer.appendChild(fb);
	overdiv.appendChild(formContainer);

	let g = new Grid({browserId: fb.id});

	g.makeFolderBrowser();

	let iframe = document.createElement('iframe');
	formContainer.appendChild(iframe);

	function setSize() {
		let win = iframe.contentWindow
		let doc = win.document;
		let qm = win.qm;

		qm.insertBreaks();
		qm.style.width = null;
		qm.style.height = null;

		iframe.style.width = qm.getBoundingClientRect().width + "px";
		iframe.style.height = doc.body.clientHeight + "px";
	}

	window.addEventListener('message', e => {
		if ( e.data.action && e.data.action === "quickMenuResize") {
			setSize();
		}
	})

	iframe.onload = function() {
		iframe.contentWindow.document.addEventListener('quickMenuIframePreLoaded', setSize);
	}

	iframe.src = browser.runtime.getURL('quickmenu.html');

	overdiv.appendChild(formContainer);

	$('#main').classList.add('blur');

	overdiv.getBoundingClientRect();
	overdiv.style.opacity = null;
}

function createMaskIcon(src) {
	let tool = document.createElement('div');
	tool.className = 'tool';
	tool.style.setProperty('--mask-image', `url(${src})`);

	return tool;
}

async function checkAndUpdateNativeApp() {
	if ( !browser.runtime.sendNativeMessage ) return alert('Native app not connected!');

	browser.runtime.sendNativeMessage("contextsearch_webext", {checkForUpdate:true}).then( newVersion => {
		if ( newVersion ) {
			if (confirm("Update native app script to version " + newVersion + "?"))
				browser.runtime.sendNativeMessage("contextsearch_webext", {update:true});
		} else {
			alert('Latest version already installed');
		}
	});
}

async function checkForNativeAppUpdate() {
	if ( !browser.runtime.sendNativeMessage ) return false;

	return browser.runtime.sendNativeMessage("contextsearch_webext", {checkForUpdate:true});
}
