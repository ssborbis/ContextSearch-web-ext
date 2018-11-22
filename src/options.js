window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

// array for storage.local
var userOptions = {};

// Browse button for manual import
document.getElementById("selectMozlz4FileButton").addEventListener('change', (ev) => {
	
	let searchEngines = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		searchEngines = searchJsonObjectToArray(engines);

		document.getElementById('status_div').style.display='inline-block';
		statusMessage({
			img: browser.runtime.getURL("icons/spinner.svg"),
			msg: browser.i18n.getMessage("LoadingRemoteContent")
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
					hidden: false
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
					img: "icons/alert.png",
					msg: browser.i18n.getMessage("LoadingRemoteContentFail").replace("%1", details.hasFailedCount)
				//	msg: "Failed to load " + details.hasFailedCount + " icon(s). This can occur when Tracking Protection is enabled"
				});
			} else if (details.hasTimedOut) {
				statusMessage({
					img: "icons/alert.png",
					msg: browser.i18n.getMessage("LoadingRemoteContentTimeout")
				});
			} else {
				statusMessage({
					img: "icons/yes.png",
					msg: browser.i18n.getMessage("ImportedEngines").replace("%1", searchEngines.length).replace("%2", details.searchEngines.length)
					//msg: "Imported " + searchEngines.length + " engine(s) (" + details.searchEngines.length + " new)"
				});
			}
				
			if (window.location.hash === '#quickload') {
				browser.runtime.sendMessage({action: "closeWindowRequest"});
			}
			
			buildSearchEngineContainer();
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/no.png",
			msg: "Failed to load search engines :("
		});
	});
	
	function statusMessage(status) {				
		document.getElementById('status_img').src = status.img || "";
		document.getElementById('status').innerText = status.msg || "";
	}
});

function restoreOptions() {

	function onGot(result) {
		
		userOptions = result.userOptions || {};

		document.getElementById('cb_quickMenu').checked = userOptions.quickMenu;	
		document.getElementById('n_quickMenuColumns').value = userOptions.quickMenuColumns;
		document.getElementById('n_quickMenuRows').value = userOptions.quickMenuRows;
		
		document.getElementById('b_quickMenuKey').value = userOptions.quickMenuKey;
		document.getElementById('b_quickMenuKey').innerText = keyTable[userOptions.quickMenuKey] || "Set";
		
		document.getElementById('b_contextMenuKey').value = userOptions.contextMenuKey;	
		document.getElementById('b_contextMenuKey').innerText = keyTable[userOptions.contextMenuKey] || "Set";
		
		document.getElementById('r_quickMenuOnKey').checked = userOptions.quickMenuOnKey;
		document.getElementById('cb_quickMenuOnHotkey').checked = userOptions.quickMenuOnHotkey;
		
		document.getElementById('d_hotkey').appendChild(keyArrayToButtons(userOptions.quickMenuHotkey));
		
		document.getElementById('cb_quickMenuOnMouse').checked = userOptions.quickMenuOnMouse;
		document.getElementById('s_quickMenuOnMouseMethod').value = userOptions.quickMenuOnMouseMethod;
		document.getElementById('cb_quickMenuSearchOnMouseUp').checked = userOptions.quickMenuSearchOnMouseUp;
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		document.getElementById('cb_quickMenuAutoOnInputs').checked = userOptions.quickMenuAutoOnInputs;
		document.getElementById('cb_quickMenuCloseOnScroll').checked = userOptions.quickMenuCloseOnScroll,
		document.getElementById('cb_quickMenuCloseOnClick').checked = userOptions.quickMenuCloseOnClick,
		document.getElementById('s_quickMenuToolsPosition').value =  userOptions.quickMenuToolsPosition,
		document.getElementById('s_quickMenuSearchBar').value =  userOptions.quickMenuSearchBar,
		document.getElementById('cb_quickMenuSearchBarFocus').checked = userOptions.quickMenuSearchBarFocus,
		document.getElementById('cb_quickMenuSearchBarSelect').checked = userOptions.quickMenuSearchBarSelect,
		document.getElementById('range_quickMenuScale').value = userOptions.quickMenuScale;
		document.getElementById('range_quickMenuIconScale').value = userOptions.quickMenuIconScale;
		document.getElementById('i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		document.getElementById('i_quickMenuIconScale').value = (parseFloat(userOptions.quickMenuIconScale) * 100).toFixed(0) + "%";
		document.getElementById('n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		document.getElementById('n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;
		
		document.getElementById('s_quickMenuMouseButton').value = userOptions.quickMenuMouseButton.toString();
		document.getElementById('cb_contextMenu').checked = userOptions.contextMenu;
		document.getElementById('i_searchJsonPath').value = userOptions.searchJsonPath.replace("/search.json.mozlz4","");
		document.getElementById('h_position').value = userOptions.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.className = p.className.replace(' active', '');
			if (p.dataset.position === userOptions.quickMenuPosition)
				p.className+=' active';
		}
		
		buildToolIcons();

		document.getElementById('cb_automaticImport').checked = (userOptions.reloadMethod === 'automatic')

		document.getElementById('s_contextMenuClick').value = userOptions.contextMenuClick;
		document.getElementById('s_contextMenuShift').value = userOptions.contextMenuShift;
		document.getElementById('s_contextMenuCtrl').value = userOptions.contextMenuCtrl;
		
		document.getElementById('cb_contextMenuShowAddCustomSearch').checked = userOptions.contextMenuShowAddCustomSearch;
		
		document.getElementById('s_quickMenuLeftClick').value = userOptions.quickMenuLeftClick;
		document.getElementById('s_quickMenuRightClick').value = userOptions.quickMenuRightClick;
		document.getElementById('s_quickMenuMiddleClick').value = userOptions.quickMenuMiddleClick;
		document.getElementById('s_quickMenuShift').value = userOptions.quickMenuShift;
		document.getElementById('s_quickMenuCtrl').value = userOptions.quickMenuCtrl;
		document.getElementById('s_quickMenuAlt').value = userOptions.quickMenuAlt;
		
		document.getElementById('s_quickMenuFolderLeftClick').value = userOptions.quickMenuFolderLeftClick;
		document.getElementById('s_quickMenuFolderRightClick').value = userOptions.quickMenuFolderRightClick;
		document.getElementById('s_quickMenuFolderMiddleClick').value = userOptions.quickMenuFolderMiddleClick;
		document.getElementById('s_quickMenuFolderShift').value = userOptions.quickMenuFolderShift;
		document.getElementById('s_quickMenuFolderCtrl').value = userOptions.quickMenuFolderCtrl;
		document.getElementById('s_quickMenuFolderAlt').value = userOptions.quickMenuFolderAlt;
		document.getElementById('s_quickMenuSearchHotkeys').value = userOptions.quickMenuSearchHotkeys;
		document.getElementById('n_quickMenuAutoMaxChars').value = userOptions.quickMenuAutoMaxChars;
		document.getElementById('n_quickMenuOpeningOpacity').value = parseFloat(userOptions.quickMenuOpeningOpacity);
				
		document.getElementById('cb_searchBarSuggestions').checked = userOptions.searchBarSuggestions;
		document.getElementById('cb_searchBarEnableHistory').checked = userOptions.searchBarEnableHistory;
		document.getElementById('cb_searchBarUseOldStyle').checked = userOptions.searchBarUseOldStyle;
		document.getElementById('cb_searchBarCloseAfterSearch').checked = userOptions.searchBarCloseAfterSearch;
		document.getElementById('cb_quickMenuUseOldStyle').checked = userOptions.quickMenuUseOldStyle;
		document.getElementById('n_searchBarColumns').value = userOptions.searchBarColumns;
		document.getElementById('s_sideBarWidgetPosition').value = userOptions.sideBar.widget.position;
		document.getElementById('cb_sideBarWidgetEnable').checked = userOptions.sideBar.widget.enabled;
		
		document.getElementById('t_userStyles').value = userOptions.userStyles;
			
		buildSearchEngineContainer();
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.runtime.getBackgroundPage();
	getting.then(onGot, onError);
	
}

function saveOptions(e) {

	function onSet() {
		browser.runtime.sendMessage({action: "updateUserOptions", "userOptions": userOptions});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	userOptions = {
		searchEngines: userOptions.searchEngines,
		nodeTree: JSON.parse(JSON.stringify(userOptions.nodeTree)),
		quickMenu: document.getElementById('cb_quickMenu').checked,
		quickMenuColumns: parseInt(document.getElementById('n_quickMenuColumns').value),
		quickMenuRows: parseInt(document.getElementById('n_quickMenuRows').value),
		
		quickMenuKey: parseInt(document.getElementById('b_quickMenuKey').value),
		contextMenuKey: parseInt(document.getElementById('b_contextMenuKey').value),
		
		quickMenuOnKey: document.getElementById('r_quickMenuOnKey').checked,
		quickMenuOnHotkey: document.getElementById('cb_quickMenuOnHotkey').checked,
		quickMenuHotkey: function() {
			let arr = [];
			document.getElementById('d_hotkey').querySelectorAll('[data-keycode]').forEach( button => {
				arr.push(parseInt(button.dataset.keycode));
			});
			return arr;
		}(),
		quickMenuOnMouse: document.getElementById('cb_quickMenuOnMouse').checked,
		quickMenuOnMouseMethod: document.getElementById('s_quickMenuOnMouseMethod').value,
		quickMenuSearchOnMouseUp: document.getElementById('cb_quickMenuSearchOnMouseUp').checked,
		quickMenuMouseButton: parseInt(document.getElementById("s_quickMenuMouseButton").value),
		quickMenuAuto: document.getElementById('r_quickMenuAuto').checked,
		quickMenuAutoOnInputs: document.getElementById('cb_quickMenuAutoOnInputs').checked,
		quickMenuScale: parseFloat(document.getElementById('range_quickMenuScale').value),
		quickMenuIconScale: parseFloat(document.getElementById('range_quickMenuIconScale').value),
		quickMenuOffset: {x: parseInt(document.getElementById('n_quickMenuOffsetX').value), y: parseInt(document.getElementById('n_quickMenuOffsetY').value)},
		quickMenuCloseOnScroll: document.getElementById('cb_quickMenuCloseOnScroll').checked,
		quickMenuCloseOnClick: document.getElementById('cb_quickMenuCloseOnClick').checked,
		quickMenuPosition: document.getElementById('h_position').value,
		contextMenuClick: document.getElementById('s_contextMenuClick').value,
		contextMenuShift: document.getElementById('s_contextMenuShift').value,
		contextMenuCtrl: document.getElementById('s_contextMenuCtrl').value,
		contextMenuShowAddCustomSearch: document.getElementById('cb_contextMenuShowAddCustomSearch').checked,
		quickMenuLeftClick: document.getElementById('s_quickMenuLeftClick').value,
		quickMenuRightClick: document.getElementById('s_quickMenuRightClick').value,
		quickMenuMiddleClick: document.getElementById('s_quickMenuMiddleClick').value,
		quickMenuShift: document.getElementById('s_quickMenuShift').value,
		quickMenuCtrl: document.getElementById('s_quickMenuCtrl').value,
		quickMenuAlt: document.getElementById('s_quickMenuAlt').value,		
		quickMenuFolderLeftClick: document.getElementById('s_quickMenuFolderLeftClick').value,
		quickMenuFolderRightClick: document.getElementById('s_quickMenuFolderRightClick').value,
		quickMenuFolderMiddleClick: document.getElementById('s_quickMenuFolderMiddleClick').value,
		quickMenuFolderShift: document.getElementById('s_quickMenuFolderShift').value,
		quickMenuFolderCtrl: document.getElementById('s_quickMenuFolderCtrl').value,
		quickMenuFolderAlt: document.getElementById('s_quickMenuFolderAlt').value,
		quickMenuSearchHotkeys: document.getElementById('s_quickMenuSearchHotkeys').value,
		quickMenuSearchBar: document.getElementById('s_quickMenuSearchBar').value,
		quickMenuSearchBarFocus: document.getElementById('cb_quickMenuSearchBarFocus').checked,
		quickMenuSearchBarSelect: document.getElementById('cb_quickMenuSearchBarSelect').checked,
		quickMenuAutoMaxChars: parseInt(document.getElementById('n_quickMenuAutoMaxChars').value) || 0,
		quickMenuOpeningOpacity: parseFloat(document.getElementById('n_quickMenuOpeningOpacity').value) || .3,
		
		contextMenu: document.getElementById('cb_contextMenu').checked,
		searchJsonPath: function () {
			let path = document.getElementById('i_searchJsonPath').value;
			if (path.match(/\/search.json.mozlz4$/) === null && path != "")
				path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
			return path;
		}(),
		quickMenuTools: function() {
			let tools = [];
			for (let toolIcon of document.getElementsByClassName('toolIcon'))
				tools.push({"name": toolIcon.name, "disabled": toolIcon.disabled})			
			return tools;
		}(),
		
		quickMenuToolsPosition: document.getElementById('s_quickMenuToolsPosition').value,
		reloadMethod: (document.getElementById('cb_automaticImport').checked) ? 'automatic' : 'manual',
		
		searchBarUseOldStyle: document.getElementById('cb_searchBarUseOldStyle').checked,
		searchBarColumns: parseInt(document.getElementById('n_searchBarColumns').value),
		searchBarCloseAfterSearch: document.getElementById('cb_searchBarCloseAfterSearch').checked,
		
		quickMenuUseOldStyle: document.getElementById('cb_quickMenuUseOldStyle').checked,
		
		 // take directly from loaded userOptions
		searchBarSuggestions: document.getElementById('cb_searchBarSuggestions').checked,
		searchBarEnableHistory: document.getElementById('cb_searchBarEnableHistory').checked,
		searchBarHistory: userOptions.searchBarHistory,
		
		sideBar: {
			enabled: userOptions.sideBar.enabled,
			hotkey: [],
			widget: {
				enabled: document.getElementById('cb_sideBarWidgetEnable').checked,
				position: document.getElementById('s_sideBarWidgetPosition').value,
				offset: userOptions.sideBar.widget.offset
			}
		},
		
		userStyles: document.getElementById('t_userStyles').value
	}
	
//	var setting = browser.storage.local.set({"userOptions": userOptions});
	var setting = browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	setting.then(onSet, onError);
}

document.addEventListener("DOMContentLoaded", makeTabs());
document.addEventListener("DOMContentLoaded", restoreOptions);

// listen to all checkboxes for change
document.querySelectorAll("input[type='checkbox']").forEach( el => {
	el.addEventListener('change', saveOptions);
});

// listen to all select for change
document.querySelectorAll('select').forEach( el => {
	el.addEventListener('change', saveOptions);
});

document.getElementById('n_quickMenuColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 5, 1, 100);
	saveOptions(e);
});

document.getElementById('n_quickMenuRows').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 5, 1, 100);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetX').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetY').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('n_searchBarColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 4, 1, 100);
	saveOptions(e);
});

document.getElementById('n_quickMenuAutoMaxChars').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 0, 0, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOpeningOpacity').addEventListener('change',  saveOptions);

document.getElementById('range_quickMenuScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
document.getElementById('range_quickMenuScale').addEventListener('change', saveOptions);

document.getElementById('range_quickMenuIconScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuIconScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
document.getElementById('range_quickMenuIconScale').addEventListener('change', saveOptions);
document.getElementById('b_checkSearchJsonPath').addEventListener('click', checkSearchJsonPath);
document.getElementById('i_searchJsonPath').addEventListener('change', checkSearchJsonPath);
document.getElementById('i_searchJsonPath').addEventListener('keydown', (ev) => {
	if (
		ev.repeat ||
		ev.which !== 13
	) return false;
	
	ev.target.blur();
});

document.getElementById('t_userStyles').addEventListener('change', saveOptions);

function checkSearchJsonPath() {

	let el = document.getElementById('div_searchJsonPathResponse');
	let ev_target = document.getElementById('i_searchJsonPath');
	
	el.innerText = browser.i18n.getMessage("Validating");
	
	ev_target.value = ev_target.value.replace(/\\/g, "/").trim();
	if (ev_target.value == "") {
		el.innerText = "";
		return false;
	}
	
	let path = ev_target.value;
	
	if (path.match(/\/search.json.mozlz4$/) === null) {
		path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
	}
	
	saveOptions();

	function onResponse(response) {

		if (response.error) {
			el.innerHTML = "<img src='/icons/no.png' style='height:16px;vertical-align:middle;' />&nbsp;&nbsp;&nbsp;";
			let span = document.createElement('span');
			span.innerText = response.error;
			el.appendChild(span);
			return false;
		}

		let tn = document.createTextNode("   " + browser.i18n.getMessage("ImportSuccessful"));
		el.innerHTML = "<img src='/icons/yes.png' style='height:16px;vertical-align:middle;' />";
		el.appendChild(tn);

		// if response is a userOptions object
		if (response && response.searchEngines) {	
			console.log('building search engine container');
			buildSearchEngineContainer(response.searchEngines);
		}
	}
	
	function onError(error) {
		console.log(error);
		el.innerHTML = "<img src='/icons/yes.png' style='height:16px;vertical-align:middle;' />&nbsp;&nbsp;&nbsp;";
		el.textContent = browser.i18n.getMessage("NativeAppImportError").replace("%1", error.message || "no error message");
		el.style.color = 'red';
	}

	var sending = browser.runtime.sendMessage({action: "nativeAppRequest", force: true});
	sending.then(onResponse, onError);	
}

document.getElementById('b_quickMenuKey').addEventListener('click', keyButtonListener);
document.getElementById('b_contextMenuKey').addEventListener('click', keyButtonListener);

function keyButtonListener(e) {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	e.target.appendChild(img);
	e.target.addEventListener('keydown', function(evv) {
		evv.preventDefault();
		
		if ( evv.which === 27 ) {
			e.target.innerHTML = '&nbsp;';
			e.target.value = 0;
		} else {
			e.target.innerText = keyTable[evv.which];
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

function keyArrayToButtons(arr) {
	
	let div = document.createElement('div');
	
	if (arr.length === 0) {
		div.innerText = 'Click To Set';
	}
	
	for (let i=0;i<arr.length;i++) {

		let hk = arr[i]
		let span = document.createElement('span');
		let key = keyTable[hk];
		if (key.length === 1) key = key.toUpperCase();
		
		span.innerText = key;
		span.dataset.keycode = hk;
		span.className = 'keyboardButton';
		span.style = 'min-width:auto;padding:3px 10px;';
		div.appendChild(span);
		
		if ( i + 1 < arr.length) {
			let p = document.createElement('span');
			p.innerHTML = '&nbsp;&nbsp;+&nbsp;&nbsp;';
			div.appendChild(p);
		}
	}
	
	return div;
}

// Modify Options for quickload popup
document.addEventListener('DOMContentLoaded', () => {

	if (window.location.hash === '#quickload') {
		history.pushState("", document.title, window.location.pathname);
		
		document.querySelector('button[data-tabid="enginesTab"]').click();
		document.getElementById('selectMozlz4FileButton').click();
	}
});

// switch to tab based on params
document.addEventListener('DOMContentLoaded', () => {
	
	let params = new URLSearchParams(location.search);

	if (params.get('tab') === 'help')
		document.querySelector('button[data-tabid="helpTab"]').click();
	
	if (params.get('tab') === 'searchengines')
		document.querySelector('button[data-tabid="enginesTab"]').click();

});

// Modify Options for BrowserAction
document.addEventListener("DOMContentLoaded", () => {
	if (window.location.hash === '#browser_action') {
		document.getElementById('left_div').style.display = 'none';
		document.getElementById('right_div').style.width = "auto";
		let loadButton = document.getElementById("selectMozlz4FileButton");
		loadButton.onclick = (e) => {
			browser.runtime.sendMessage({action:"openOptions", hashurl:"#quickload"});
			e.preventDefault();
		}
	}
});

function makeTabs() {
	
	let tabs = document.getElementsByClassName("tablinks");
	for (let tab of tabs) {
		tab.addEventListener('click', (e) => {

			for (let tabcontent of document.getElementsByClassName("tabcontent"))
				tabcontent.style.display = "none";
			
			for (let _tab of tabs)
				_tab.getElementsByTagName('img')[0].style.display='none';
			
			e.target.getElementsByTagName('img')[0].className = 'fade-in';
			e.target.getElementsByTagName('img')[0].style.display='inline-block';
				
			// Get all elements with class="tablinks" and remove the class "active"
			for (let tablink of document.getElementsByClassName("tablinks")) 
				tablink.className = tablink.className.replace(" active", "");

			// Show the current tab, and add an "active" class to the button that opened the tab
			document.getElementById(e.target.dataset.tabid).style.display = "block";
			e.currentTarget.className += " active";
		});
	}
	tabs[0].click();
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
		saveOptions();
	}
	
	let toolIcons = [
		{name: 'close', src: "icons/close.png", title: browser.i18n.getMessage('tools_Close'), index: Number.MAX_VALUE, disabled: true},
		{name: 'copy', src: "icons/clipboard.png", title: browser.i18n.getMessage('tools_Copy'), index: Number.MAX_VALUE, disabled: true},
		{name: 'link', src: "icons/link.png", title: browser.i18n.getMessage('tools_OpenAsLink'), index: Number.MAX_VALUE, disabled: true},
		{name: 'disable', src: "icons/power.png", title: browser.i18n.getMessage('tools_Disable'), index: Number.MAX_VALUE, disabled: true},
		{name: 'lock', src: "icons/lock.png", title: browser.i18n.getMessage('tools_Lock'), index: Number.MAX_VALUE, disabled: true}
	];
	
	toolIcons.forEach( toolIcon => {
		toolIcon.index = userOptions.quickMenuTools.findIndex( tool => tool.name === toolIcon.name );
		toolIcon.disabled = userOptions.quickMenuTools[toolIcon.index].disabled;
	});

	toolIcons = toolIcons.sort(function(a, b) {
		return (a.index < b.index) ? -1 : 1;
	});

	for (let icon of toolIcons) {
		let img = document.createElement('img');
		img.disabled = icon.disabled;
		img.style.opacity = (img.disabled) ? .4 : 1;
		img.className = 'toolIcon';
		img.setAttribute('draggable', true);
		img.src = icon.src;
		img.setAttribute('data-title',icon.title);
		img.name = icon.name;

		img.addEventListener('dragstart',dragstart_handler);
		img.addEventListener('dragend',dragend_handler);
		img.addEventListener('drop',drop_handler);
		img.addEventListener('dragover',dragover_handler);

		img.addEventListener('click',(e) => {
			e.target.disabled = e.target.disabled || false;
			e.target.style.opacity = e.target.disabled ? 1 : .4;
			e.target.disabled = !e.target.disabled;	
			saveOptions();
		});
		
		let t_toolIcons = document.getElementById('t_toolIcons');
		img.addEventListener('mouseover', (e) => {
			t_toolIcons.innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', (e) => {
			t_toolIcons.innerText = browser.i18n.getMessage(t_toolIcons.dataset.i18n);
		});

		document.getElementById('toolIcons').appendChild(img);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	for (let el of document.getElementsByClassName('position')) {
		el.addEventListener('click', (e) => {
			for (let _el of document.getElementsByClassName('position'))
				_el.className = _el.className.replace(' active', '');
			el.className+=' active';
			document.getElementById('h_position').value = el.dataset.position;
			saveOptions();
		});
		
		let t_position = document.getElementById('t_position');
		el.addEventListener('mouseover', (e) => {
			let parts = e.target.dataset.position.split(" ");
			t_position.innerText = browser.i18n.getMessage("PositionRelativeToCursor").replace("%1", browser.i18n.getMessage(parts[0])).replace("%2",browser.i18n.getMessage(parts[1]));
		});
		
		el.addEventListener('mouseout', (e) => {
			t_position.innerText = browser.i18n.getMessage(t_position.dataset.i18n);
		});
		
	}
	
});

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('version').innerText = "" + browser.runtime.getManifest().version;
});

// show/hide content based on native app compatibility
document.addEventListener("DOMContentLoaded", (e) => {
	
	function onChecks() {
		console.log('Native Messenger addon installed');
	}
	
	function onError() {
		console.log('Native Messenger addon not installed. Removing native content');
		
		for (let el of document.getElementsByTagName('native'))
			el.style.display = 'none';
		
	}
	
	let nativeChecking = browser.runtime.sendMessage("contextsearch.webext.native.messenger@ssborbis.addons.mozilla.org", {action: "check"});
	
	nativeChecking.then(onChecks, onError);

});

// browser-specific modifications
document.addEventListener("DOMContentLoaded", (e) => {
	if (!browser.runtime.getBrowserInfo) {
		for (let el of document.querySelectorAll('[data-browser="firefox"]'))
			el.style.display = 'none';
	}
});

function showInfoMsg(el, msg) {
	let div = document.getElementById('info_msg');
		
	let parsed = new DOMParser().parseFromString(msg, `text/html`);
	let tag = parsed.getElementsByTagName('body')[0];
				
	div.innerHTML = null;
	div.appendChild(tag.firstChild);

	div.style.top = el.getBoundingClientRect().top + window.scrollY + 10 + 'px';
	div.style.left = el.getBoundingClientRect().left + window.scrollX + 20 + 'px';
	
	if (el.getBoundingClientRect().left > ( window.innerWidth - 220) )
		div.style.left = parseFloat(div.style.left) - 230 + "px";
	
	div.style.display = 'block';
}

// set up info bubbles
document.addEventListener("DOMContentLoaded", () => {
	
	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
	for (let el of i18n_tooltips) {
		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip') || el.dataset.msg;
	}
	
	for (let el of document.getElementsByClassName('info')) {
		el.addEventListener('mouseover', (e) => {
			showInfoMsg(el, el.dataset.msg);
		});
		
		el.addEventListener('mouseout', (e) => {
			document.getElementById('info_msg').style.display = 'none';
		});
	}
});

// import/export buttons
document.addEventListener("DOMContentLoaded", () => {
	
	function download(filename, text) {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);

		element.style.display = 'none';
		document.body.appendChild(element);

		element.click();

		document.body.removeChild(element);
	}
	
	let b_export = document.getElementById('b_exportSettings');
	b_export.onclick = function() {
		let text = JSON.stringify(userOptions);
		download("ContextSearchOptions.json", text);
	}
	
	let b_import = document.getElementById('b_importSettings');
	b_import.onclick = function() {
		if (window.location.hash === '#browser_action') {
			browser.runtime.sendMessage({action: "openOptions", hashurl:"?click=importSettings"});
			return;
		}
		document.getElementById('importSettings').click();
	}
	
	document.getElementById('importSettings').addEventListener('change', (e) => {
		var reader = new FileReader();

		// Closure to capture the file information.
		reader.onload = function() {
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
				browser.runtime.getBackgroundPage().then((w) => {
					w.updateUserOptionsVersion(newUserOptions).then((_uo) => {

						browser.runtime.sendMessage({action: "getDefaultUserOptions"}).then((message) => {
							
							let defaultUserOptions = message.defaultUserOptions;

							for (let key in defaultUserOptions) {	
								_uo[key] = (_uo[key] !== undefined) ? _uo[key] : defaultUserOptions[key];
							}

							browser.runtime.sendMessage({action: "saveUserOptions", userOptions: _uo}).then(() => {
								browser.runtime.sendMessage({action: "updateUserOptions"}).then(() => {
									userOptions = _uo;
									location.reload();
								});
							});
						});
					});
				});

			} catch(err) {
				alert(browser.i18n.getMessage("InvalidJSONAlert"));
			}
		}

      // Read in the image file as a data URL.
      reader.readAsText(e.target.files[0]);
	});
});

// click element listed in the hash for upload buttons
document.addEventListener('DOMContentLoaded', () => {
	let params = new URLSearchParams(window.location.search);
	
	if (params.has('click')) {
		document.getElementById(params.get('click')).click();
		history.pushState("", document.title, window.location.pathname);
	}
});	

document.addEventListener('DOMContentLoaded', () => {

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

	// add locale-specific styling
	var link = document.createElement( "link" );
	link.href = browser.runtime.getURL('/_locales/' + browser.i18n.getUILanguage() + '/style.css');
	link.type = "text/css";
	link.rel = "stylesheet";
	document.getElementsByTagName( "head" )[0].appendChild( link );
	
	// set up localized help pages
	let help = document.getElementById('helpTab');
	
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
	}
	
	setTimeout( () => {
		if (!loaded) {
			iframe.src = '/_locales/' + browser.runtime.getManifest().default_locale + '/help.html';
		}
	}, 250);
	
	iframe.src = '/_locales/' + browser.i18n.getUILanguage() + '/help.html';
	
	help.appendChild(iframe);

});

document.addEventListener('DOMContentLoaded', () => {
	
	let hk = document.getElementById('d_hotkey');
	hk.onclick = function() {
		
		hk.innerHTML = '<img src="/icons/spinner.svg" style="height:1em" /> ';
		hk.appendChild(document.createTextNode(browser.i18n.getMessage('PressKey')));
				
		document.addEventListener('keyup', (e) => {
			
			e.preventDefault();
			
			let keyArray = [];
			
			if (e.ctrlKey) keyArray.push(17);
			if (e.altKey) keyArray.push(18);
			if (e.shiftKey) keyArray.push(16);
			
			keyArray.push(e.keyCode);
			
			hk.innerHTML = null;
			hk.appendChild(keyArrayToButtons(keyArray));
			
			saveOptions();
			
		}, {once: true});
		
	}
});
	
document.addEventListener('DOMContentLoaded', () => {
	let div = document.getElementById('d_clearSearchHistory');
	div.animating = false;
	div.onclick = function() {
		if (div.animating) return false;
		div.animating = true;
		
		userOptions.searchBarHistory = [];
		saveOptions();
		
		let img = document.createElement('img');
		img.src = "/icons/yes.png";
		img.style.height = '20px';
		img.style.marginLeft = '20px';
		img.style.opacity = 1;
		img.style.transition = 'opacity 2s ease-out 1s';
		img.style.verticalAlign = 'middle';
		div.appendChild(img);
		
		img.addEventListener('transitionend', (e) => {
			div.removeChild(img);
			div.animating = false;
		});
		
		img.getBoundingClientRect();
		img.style.opacity = 0;
		
	}
});

// setup disabled options
document.addEventListener('DOMContentLoaded', () => {
	
	(() => { // disable focus quick menu search bar when hotkeys enabled
		let select = document.getElementById('s_quickMenuSearchHotkeys');
		
		function toggle() {
			let cb1 = document.getElementById('cb_quickMenuSearchBarFocus');

			if (select.value === 'noAction') {
				cb1.disabled = false;
				cb1.parentNode.style.opacity = null;
				cb1.parentNode.querySelector('[data-disabled-msg]').style.display = 'none';
			} else {
				cb1.disabled = true;
				cb1.parentNode.style.opacity = .5;
				cb1.parentNode.querySelector('[data-disabled-msg]').style.display = null;
			}		
		}
		select.addEventListener('change', toggle);
		toggle();
	})();
	
	(() => {
		let cb = document.getElementById('cb_quickMenuUseOldStyle');
		let input = document.getElementById('n_quickMenuColumns');
		
		function toggle() {

			if (!cb.checked) {
				input.disabled = false;
				input.style.opacity = null;
			//	input.querySelector('[data-disabled-msg]').style.display = 'none';
			} else {
				input.disabled = true;
				input.style.opacity = .5;
			//	input.querySelector('[data-disabled-msg]').style.display = null;
			}		
		}
		cb.addEventListener('change', toggle);
		toggle();
	})();
	
	(() => {
		let cb = document.getElementById('cb_searchBarUseOldStyle');
		let input = document.getElementById('n_searchBarColumns');
		
		function toggle() {

			if (!cb.checked) {
				input.disabled = false;
				input.style.opacity = null;
			//	input.querySelector('[data-disabled-msg]').style.display = 'none';
			} else {
				input.disabled = true;
				input.style.opacity = .5;
			//	input.querySelector('[data-disabled-msg]').style.display = null;
			}		
		}
		cb.addEventListener('change', toggle);
		toggle();
	})();
});
