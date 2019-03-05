window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

// not jQuery 
var $ = (s) => {
	return document.querySelector(s);
}

// array for storage.local
var userOptions = {};

// Browse button for manual import
$("#selectMozlz4FileButton").addEventListener('change', (ev) => {
	
	let searchEngines = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

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
					msg: browser.i18n.getMessage("LoadingRemoteContentFail").replace("%1", details.hasFailedCount),
					color: "transparent",
					invert: false
				});
			} else if (details.hasTimedOut) {
				statusMessage({
					img: "icons/alert.png",
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
				
			if (window.location.hash === '#quickload') {
				browser.runtime.sendMessage({action: "closeWindowRequest"});
			}
			
			buildSearchEngineContainer();
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/crossmark.svg",
			msg: "Failed to load search engines :(",
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

}



function restoreOptions() {

	function onGot(result) {

		userOptions = result.userOptions || {};

		$('#cb_quickMenu').checked = userOptions.quickMenu;	
		$('#n_quickMenuColumns').value = userOptions.quickMenuColumns;
		$('#n_quickMenuRows').value = userOptions.quickMenuRows;
		
		$('#b_quickMenuKey').value = userOptions.quickMenuKey;
		$('#b_quickMenuKey').innerText = keyCodeToString(userOptions.quickMenuKey) || browser.i18n.getMessage('ClickToSet');
		
		$('#b_contextMenuKey').value = userOptions.contextMenuKey;	
		$('#b_contextMenuKey').innerText = keyCodeToString(userOptions.contextMenuKey) || browser.i18n.getMessage('ClickToSet');
		$('#s_contextMenuSearchLinksAs').value = userOptions.contextMenuSearchLinksAs;
		
		$('#r_quickMenuOnKey').checked = userOptions.quickMenuOnKey;
		$('#cb_quickMenuOnHotkey').checked = userOptions.quickMenuOnHotkey;
		
		$('#d_hotkey').appendChild(keyArrayToButtons(userOptions.quickMenuHotkey));
		
		$('#cb_quickMenuOnMouse').checked = userOptions.quickMenuOnMouse;
		$('#s_quickMenuOnMouseMethod').value = userOptions.quickMenuOnMouseMethod;
		$('#cb_quickMenuSearchOnMouseUp').checked = userOptions.quickMenuSearchOnMouseUp;
		$('#r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		$('#cb_quickMenuAutoOnInputs').checked = userOptions.quickMenuAutoOnInputs;
		$('#cb_quickMenuOnLinks').checked = userOptions.quickMenuOnLinks;
		$('#cb_quickMenuOnImages').checked = userOptions.quickMenuOnImages;
		$('#cb_quickMenuCloseOnScroll').checked = userOptions.quickMenuCloseOnScroll,
		$('#cb_quickMenuCloseOnClick').checked = userOptions.quickMenuCloseOnClick,
		$('#s_quickMenuToolsPosition').value =  userOptions.quickMenuToolsPosition,
		$('#s_quickMenuSearchBar').value =  userOptions.quickMenuSearchBar,
		$('#cb_quickMenuSearchBarFocus').checked = userOptions.quickMenuSearchBarFocus,
		$('#cb_quickMenuSearchBarSelect').checked = userOptions.quickMenuSearchBarSelect,
		$('#range_quickMenuScale').value = userOptions.quickMenuScale;
		$('#range_quickMenuIconScale').value = userOptions.quickMenuIconScale;
		$('#i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		$('#i_quickMenuIconScale').value = (parseFloat(userOptions.quickMenuIconScale) * 100).toFixed(0) + "%";
		$('#n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		$('#n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;
		
		$('#s_quickMenuMouseButton').value = userOptions.quickMenuMouseButton.toString();
		$('#cb_contextMenu').checked = userOptions.contextMenu;
		// $('#i_searchJsonPath').value = userOptions.searchJsonPath.replace("/search.json.mozlz4","");
		$('#h_position').value = userOptions.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.className = p.className.replace(' active', '');
			if (p.dataset.position === userOptions.quickMenuPosition)
				p.className+=' active';
		}
		
		buildToolIcons();

		// $('#cb_automaticImport').checked = (userOptions.reloadMethod === 'automatic')

		$('#s_contextMenuClick').value = userOptions.contextMenuClick;
		$('#s_contextMenuMiddleClick').value = userOptions.contextMenuMiddleClick;
		$('#s_contextMenuRightClick').value = userOptions.contextMenuRightClick;
		$('#s_contextMenuShift').value = userOptions.contextMenuShift;
		$('#s_contextMenuCtrl').value = userOptions.contextMenuCtrl;
		
		$('#cb_contextMenuShowAddCustomSearch').checked = userOptions.contextMenuShowAddCustomSearch;
		
		$('#s_quickMenuLeftClick').value = userOptions.quickMenuLeftClick;
		$('#s_quickMenuRightClick').value = userOptions.quickMenuRightClick;
		$('#s_quickMenuMiddleClick').value = userOptions.quickMenuMiddleClick;
		$('#s_quickMenuShift').value = userOptions.quickMenuShift;
		$('#s_quickMenuCtrl').value = userOptions.quickMenuCtrl;
		$('#s_quickMenuAlt').value = userOptions.quickMenuAlt;
		
		$('#s_quickMenuFolderLeftClick').value = userOptions.quickMenuFolderLeftClick;
		$('#s_quickMenuFolderRightClick').value = userOptions.quickMenuFolderRightClick;
		$('#s_quickMenuFolderMiddleClick').value = userOptions.quickMenuFolderMiddleClick;
		$('#s_quickMenuFolderShift').value = userOptions.quickMenuFolderShift;
		$('#s_quickMenuFolderCtrl').value = userOptions.quickMenuFolderCtrl;
		$('#s_quickMenuFolderAlt').value = userOptions.quickMenuFolderAlt;
		$('#s_quickMenuSearchHotkeys').value = userOptions.quickMenuSearchHotkeys;
		$('#n_quickMenuAutoMaxChars').value = userOptions.quickMenuAutoMaxChars;
		$('#n_quickMenuOpeningOpacity').value = userOptions.quickMenuOpeningOpacity;
		$('#n_quickMenuAutoTimeout').value = userOptions.quickMenuAutoTimeout;
				
		$('#cb_searchBarSuggestions').checked = userOptions.searchBarSuggestions;
		$('#cb_searchBarEnableHistory').checked = userOptions.searchBarEnableHistory;
		$('#cb_searchBarDisplayLastSearch').checked = userOptions.searchBarDisplayLastSearch;
		$('#cb_searchBarUseOldStyle').checked = userOptions.searchBarUseOldStyle;
		$('#cb_searchBarCloseAfterSearch').checked = userOptions.searchBarCloseAfterSearch;
		$('#cb_quickMenuUseOldStyle').checked = userOptions.quickMenuUseOldStyle;
		$('#n_searchBarColumns').value = userOptions.searchBarColumns;
		
		$('#n_sideBarColumns').value = userOptions.sideBar.columns;
		$('#cb_sideBarUseOldStyle').checked = userOptions.sideBar.singleColumn;
		$('#s_sideBarWidgetPosition').value = userOptions.sideBar.widget.position;
		$('#cb_sideBarWidgetEnable').checked = userOptions.sideBar.widget.enabled;
		$('#cb_sideBarStartOpen').checked = userOptions.sideBar.startOpen;
		
		$('#t_userStyles').value = userOptions.userStyles;
		$('#cb_userStylesEnabled').checked = userOptions.userStylesEnabled;
		$('#t_userStyles').disabled = !userOptions.userStylesEnabled;
		$('#cb_enableAnimations').checked = userOptions.enableAnimations;
	//	$('#s_quickMenuTheme').value = userOptions.quickMenuTheme;
		$('#s_searchBarTheme').value = userOptions.searchBarTheme;
		
		$('#cb_highLightEnabled').checked = userOptions.highLight.enabled;
		$('#cb_highLightFollowDomain').checked = userOptions.highLight.followDomain;
		$('#cb_highLightFollowExternalLinks').checked = userOptions.highLight.followExternalLinks;
		
		$('#s_highLightStyle').value = userOptions.highLight.highlightStyle;
		
		$('#c_highLightColor0').value = userOptions.highLight.styles[0].color;
		$('#c_highLightBackground0').value = userOptions.highLight.styles[0].background;
		$('#c_highLightColor1').value = userOptions.highLight.styles[1].color;
		$('#c_highLightBackground1').value = userOptions.highLight.styles[1].background;
		$('#c_highLightColor2').value = userOptions.highLight.styles[2].color;
		$('#c_highLightBackground2').value = userOptions.highLight.styles[2].background;
		$('#c_highLightColor3').value = userOptions.highLight.styles[3].color;
		$('#c_highLightBackground3').value = userOptions.highLight.styles[3].background;
		$('#c_highLightColorActive').value = userOptions.highLight.activeStyle.color;
		$('#c_highLightBackgroundActive').value = userOptions.highLight.activeStyle.background;
		$('#s_highLightOpacity').value = userOptions.highLight.opacity;
		
		$('#cb_highLightFlashSelected').checked = userOptions.highLight.flashSelected;

		$('#cb_highLightNavBarEnabled').checked = userOptions.highLight.navBar.enabled;
		$('#cb_highLightShowFindBar').checked = userOptions.highLight.showFindBar;
		
		$('#cb_highLightMarkOptionsSeparateWordSearch').checked = userOptions.highLight.markOptions.separateWordSearch;
		$('#cb_highLightMarkOptionsIgnorePunctuation').checked = userOptions.highLight.markOptions.ignorePunctuation;
		$('#cb_highLightMarkOptionsCaseSensitive').checked = userOptions.highLight.markOptions.caseSensitive;
		$('#s_highLightMarkOptionsAccuracy').value = userOptions.highLight.markOptions.accuracy;
		
		$('#cb_findBarEnabled').checked = userOptions.highLight.findBar.enabled;
		$('#cb_findBarStartOpen').checked = userOptions.highLight.findBar.startOpen;
		$('#s_findBarPosition').value = userOptions.highLight.findBar.position;
		$('#s_findBarWindowType').value = userOptions.highLight.findBar.windowType;
		$('#d_findBarHotKey').appendChild(keyArrayToButtons(userOptions.highLight.findBar.hotKey));
		$('#cb_findBarShowNavBar').checked = userOptions.highLight.findBar.showNavBar;
		$('#n_findBarTimeout').value = userOptions.highLight.findBar.keyboardTimeout;

		buildSearchEngineContainer();
	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	browser.runtime.getBackgroundPage().then( w => {
		w.checkForOneClickEngines().then(c => { onGot(w);}, onError);
	}, onError);
	
}

function saveOptions(e) {

	function onSet() {
		return Promise.resolve(true);
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	userOptions = {
		searchEngines: userOptions.searchEngines,
		nodeTree: JSON.parse(JSON.stringify(userOptions.nodeTree)),
		quickMenu: $('#cb_quickMenu').checked,
		quickMenuColumns: parseInt($('#n_quickMenuColumns').value),
		quickMenuRows: parseInt($('#n_quickMenuRows').value),
		
		quickMenuKey: parseInt($('#b_quickMenuKey').value),
		contextMenuKey: parseInt($('#b_contextMenuKey').value),
		
		quickMenuOnKey: $('#r_quickMenuOnKey').checked,
		quickMenuOnHotkey: $('#cb_quickMenuOnHotkey').checked,
		quickMenuHotkey: function() {
			let arr = [];
			$('#d_hotkey').querySelectorAll('[data-keycode]').forEach( button => {
				arr.push(parseInt(button.dataset.keycode));
			});
			return arr;
		}(),
		quickMenuOnMouse: $('#cb_quickMenuOnMouse').checked,
		quickMenuOnMouseMethod: $('#s_quickMenuOnMouseMethod').value,
		quickMenuSearchOnMouseUp: $('#cb_quickMenuSearchOnMouseUp').checked,
		quickMenuMouseButton: parseInt($("#s_quickMenuMouseButton").value),
		quickMenuAuto: $('#r_quickMenuAuto').checked,
		quickMenuAutoOnInputs: $('#cb_quickMenuAutoOnInputs').checked,
		quickMenuOnLinks: $('#cb_quickMenuOnLinks').checked,
		quickMenuOnImages: $('#cb_quickMenuOnImages').checked,
		quickMenuScale: parseFloat($('#range_quickMenuScale').value),
		quickMenuIconScale: parseFloat($('#range_quickMenuIconScale').value),
		quickMenuOffset: {x: parseInt($('#n_quickMenuOffsetX').value), y: parseInt($('#n_quickMenuOffsetY').value)},
		quickMenuCloseOnScroll: $('#cb_quickMenuCloseOnScroll').checked,
		quickMenuCloseOnClick: $('#cb_quickMenuCloseOnClick').checked,
		quickMenuPosition: $('#h_position').value,
		contextMenuClick: $('#s_contextMenuClick').value,
		contextMenuMiddleClick: $('#s_contextMenuMiddleClick').value,
		contextMenuRightClick: $('#s_contextMenuRightClick').value,
		contextMenuShift: $('#s_contextMenuShift').value,
		contextMenuCtrl: $('#s_contextMenuCtrl').value,
		contextMenuSearchLinksAs: $('#s_contextMenuSearchLinksAs').value,
		contextMenuShowAddCustomSearch: $('#cb_contextMenuShowAddCustomSearch').checked,
		quickMenuLeftClick: $('#s_quickMenuLeftClick').value,
		quickMenuRightClick: $('#s_quickMenuRightClick').value,
		quickMenuMiddleClick: $('#s_quickMenuMiddleClick').value,
		quickMenuShift: $('#s_quickMenuShift').value,
		quickMenuCtrl: $('#s_quickMenuCtrl').value,
		quickMenuAlt: $('#s_quickMenuAlt').value,		
		quickMenuFolderLeftClick: $('#s_quickMenuFolderLeftClick').value,
		quickMenuFolderRightClick: $('#s_quickMenuFolderRightClick').value,
		quickMenuFolderMiddleClick: $('#s_quickMenuFolderMiddleClick').value,
		quickMenuFolderShift: $('#s_quickMenuFolderShift').value,
		quickMenuFolderCtrl: $('#s_quickMenuFolderCtrl').value,
		quickMenuFolderAlt: $('#s_quickMenuFolderAlt').value,
		quickMenuSearchHotkeys: $('#s_quickMenuSearchHotkeys').value,
		quickMenuSearchBar: $('#s_quickMenuSearchBar').value,
		quickMenuSearchBarFocus: $('#cb_quickMenuSearchBarFocus').checked,
		quickMenuSearchBarSelect: $('#cb_quickMenuSearchBarSelect').checked,
		quickMenuAutoMaxChars: parseInt($('#n_quickMenuAutoMaxChars').value) || 0,
		quickMenuOpeningOpacity: parseFloat($('#n_quickMenuOpeningOpacity').value) || .3,
		quickMenuAutoTimeout: parseInt($('#n_quickMenuAutoTimeout').value),
		
		contextMenu: $('#cb_contextMenu').checked,
		// searchJsonPath: function () {
			// let path = $('#i_searchJsonPath').value;
			// if (path.match(/\/search.json.mozlz4$/) === null && path != "")
				// path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
			// return path;
		// }(),
		quickMenuTools: function() {
			let tools = [];
			for (let toolIcon of document.getElementsByClassName('toolIcon'))
				tools.push({"name": toolIcon.name, "disabled": toolIcon.disabled})			
			return tools;
		}(),
		
		quickMenuToolsPosition: $('#s_quickMenuToolsPosition').value,
		// reloadMethod: ($('#cb_automaticImport').checked) ? 'automatic' : 'manual',
		
		searchBarUseOldStyle: $('#cb_searchBarUseOldStyle').checked,
		searchBarColumns: parseInt($('#n_searchBarColumns').value),
		searchBarCloseAfterSearch: $('#cb_searchBarCloseAfterSearch').checked,
		
		quickMenuUseOldStyle: $('#cb_quickMenuUseOldStyle').checked,
		
		 // take directly from loaded userOptions
		searchBarSuggestions: $('#cb_searchBarSuggestions').checked,
		searchBarEnableHistory: $('#cb_searchBarEnableHistory').checked,
		searchBarHistory: userOptions.searchBarHistory,
		searchBarDisplayLastSearch: $('#cb_searchBarDisplayLastSearch').checked,
		
		sideBar: {
			enabled: userOptions.sideBar.enabled,
			columns:parseInt($('#n_sideBarColumns').value),
			singleColumn:$('#cb_sideBarUseOldStyle').checked,
			hotkey: [],
			startOpen: $('#cb_sideBarStartOpen').checked,
			widget: {
				enabled: $('#cb_sideBarWidgetEnable').checked,
				position: $('#s_sideBarWidgetPosition').value,
				offset: userOptions.sideBar.widget.offset
			},
			windowType: userOptions.sideBar.windowType,
			offsets: userOptions.sideBar.offsets,
			position: userOptions.sideBar.position
		},
		
		highLight: {
			enabled: $('#cb_highLightEnabled').checked,
			followDomain: $('#cb_highLightFollowDomain').checked,
			followExternalLinks: $('#cb_highLightFollowExternalLinks').checked,
			showFindBar: $('#cb_highLightShowFindBar').checked,
			flashSelected: $('#cb_highLightFlashSelected').checked,
			highlightStyle: $('#s_highLightStyle').value,
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
			},
			navBar: {
				enabled: $('#cb_highLightNavBarEnabled').checked
			},
			findBar: {
				enabled: $('#cb_findBarEnabled').checked,
				startOpen: $('#cb_findBarStartOpen').checked,
				showNavBar: $('#cb_findBarShowNavBar').checked,
				hotKey: function() {
					let arr = [];
					$('#d_findBarHotKey').querySelectorAll('[data-keycode]').forEach( button => {
						arr.push(parseInt(button.dataset.keycode));
					});
					return arr;
				}(),
				position: $('#s_findBarPosition').value,
				keyboardTimeout: parseInt($('#n_findBarTimeout').value),
				windowType: $('#s_findBarWindowType').value,
				offsets: userOptions.highLight.findBar.offsets
			},
			markOptions: {
				separateWordSearch: $('#cb_highLightMarkOptionsSeparateWordSearch').checked,
				ignorePunctuation: $('#cb_highLightMarkOptionsIgnorePunctuation').checked,
				caseSensitive: $('#cb_highLightMarkOptionsCaseSensitive').checked,
				accuracy: $('#s_highLightMarkOptionsAccuracy').value
			}
		},
		
		userStyles: $('#t_userStyles').value,
		userStylesEnabled: $('#cb_userStylesEnabled').checked,
		userStylesGlobal: (() => {
			
			let styleText = "";

			let styleEl = document.createElement('style');

			document.head.appendChild(styleEl);

			styleEl.innerText = $('#t_userStyles').value;
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
	
		enableAnimations: $('#cb_enableAnimations').checked,
		quickMenuTheme: $('#s_searchBarTheme').value,
		searchBarTheme: $('#s_searchBarTheme').value
	}

	var setting = browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	return setting.then(onSet, onError);
}

document.addEventListener("DOMContentLoaded", makeTabs());
document.addEventListener("DOMContentLoaded", restoreOptions);

// listen to all checkboxes for change
document.querySelectorAll("input[type='checkbox'], input[type='color']").forEach( el => {
	el.addEventListener('change', saveOptions);
});

// listen to all select for change
document.querySelectorAll('select').forEach( el => {
	el.addEventListener('change', saveOptions);
});

$('#n_quickMenuColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 5, 1, 100);
	saveOptions(e);
});

$('#n_quickMenuRows').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 5, 1, 100);
	saveOptions(e);
});

$('#n_quickMenuOffsetX').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

$('#n_quickMenuOffsetY').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

$('#n_searchBarColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 4, 1, 100);
	saveOptions(e);
});

$('#n_sideBarColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 4, 1, 100);
	saveOptions(e);
});

$('#n_quickMenuAutoMaxChars').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 0, 0, 999);
	saveOptions(e);
});

$('#n_quickMenuAutoTimeout').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 1000, 0, 9999);
	saveOptions(e);
});

$('#n_quickMenuOpeningOpacity').addEventListener('change',  saveOptions);

$('#range_quickMenuScale').addEventListener('input', (ev) => {
	$('#i_quickMenuScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
$('#range_quickMenuScale').addEventListener('change', saveOptions);

$('#range_quickMenuIconScale').addEventListener('input', (ev) => {
	$('#i_quickMenuIconScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
$('#range_quickMenuIconScale').addEventListener('change', saveOptions);

$('#t_userStyles').addEventListener('change', saveOptions);

$('#cb_userStylesEnabled').addEventListener('change', (e) => {
	$('#t_userStyles').disabled = ! e.target.checked;
	saveOptions(e);
});

$('#b_quickMenuKey').addEventListener('click', keyButtonListener);
$('#b_contextMenuKey').addEventListener('click', keyButtonListener);

function keyButtonListener(e) {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	e.target.appendChild(img);
	e.target.addEventListener('keydown', function(evv) {
	
		if ( evv.which === 27 ) {
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

function keyCodeToString(code) {
	return keyTable[code] /*|| String.fromCharCode(code)*/ || code.toString();
}

function keyArrayToButtons(arr) {
	
	let div = document.createElement('div');
	
	if (arr.length === 0) {
		div.innerText = browser.i18n.getMessage('ClickToSet') || "Click to set";
	}
	
	for (let i=0;i<arr.length;i++) {

		let hk = arr[i]
		let span = document.createElement('span');
		let key = keyCodeToString(hk);
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
		$('#selectMozlz4FileButton').click();
	}
});

// switch to tab based on params
document.addEventListener('DOMContentLoaded', () => {
	
	let params = new URLSearchParams(location.search);
	
	if ( params.get('tab') )
		document.querySelector('button[data-tabid="' + params.get('tab') + '"]').click();

});

// Modify Options for BrowserAction
document.addEventListener("DOMContentLoaded", () => {
	if (window.location.hash === '#browser_action') {
		$('#left_div').style.display = 'none';
		$('#right_div').style.width = "auto";
		let loadButton = $("#selectMozlz4FileButton");
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

			e.target.getElementsByTagName('img')[0].className = 'fade-in';
				
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
		{name: 'link', src: "icons/link.svg", title: browser.i18n.getMessage('tools_OpenAsLink'), index: Number.MAX_VALUE, disabled: true},
		{name: 'disable', src: "icons/power.svg", title: browser.i18n.getMessage('tools_Disable'), index: Number.MAX_VALUE, disabled: true},
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
		
		let t_toolIcons = $('#t_toolIcons');
		img.addEventListener('mouseover', (e) => {
			t_toolIcons.innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', (e) => {
			t_toolIcons.innerText = browser.i18n.getMessage(t_toolIcons.dataset.i18n);
		});

		$('#toolIcons').appendChild(img);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	for (let el of document.getElementsByClassName('position')) {
		el.addEventListener('click', (e) => {
			for (let _el of document.getElementsByClassName('position'))
				_el.className = _el.className.replace(' active', '');
			el.className+=' active';
			$('#h_position').value = el.dataset.position;
			saveOptions();
		});
		
		let t_position = $('#t_position');
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
	$('#version').innerText = "" + browser.runtime.getManifest().version;
});

// browser-specific modifications
document.addEventListener("DOMContentLoaded", (e) => {
	if (!browser.runtime.getBrowserInfo) {
		for (let el of document.querySelectorAll('[data-browser="firefox"]'))
			el.style.display = 'none';
	} else {
		browser.runtime.getBrowserInfo().then( info => {
			let version = info.version;
			document.querySelectorAll('[data-browser="firefox"][data-minversion]').forEach( el => {
				if ( el.dataset.minversion > info.version )
					el.style.display = 'none';
			});	
		});
	}
	
	
});

function showInfoMsg(el, msg) {
	let div = $('#info_msg');
		
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
			$('#info_msg').style.display = 'none';
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
	
	let b_export = $('#b_exportSettings');
	b_export.onclick = function() {
		let text = JSON.stringify(userOptions);
		download("ContextSearchOptions.json", text);
	}
	
	let b_import = $('#b_importSettings');
	b_import.onclick = function() {
		if (window.location.hash === '#browser_action') {
			browser.runtime.sendMessage({action: "openOptions", hashurl:"?click=importSettings"});
			return;
		}
		$('#importSettings').click();
	}
	
	$('#importSettings').addEventListener('change', (e) => {
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
								userOptions = _uo;
								location.reload();
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
			el.addEventListener('click', (_e) => {
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
	
	setTimeout( () => {
		if (!loaded) {
			iframe.src = '/_locales/' + browser.runtime.getManifest().default_locale + '/help.html';
		}
	}, 250);
	
	iframe.src = '/_locales/' + browser.i18n.getUILanguage() + '/help.html';
	
	help.appendChild(iframe);

});

document.addEventListener('DOMContentLoaded', () => {
	
	['#d_hotkey', '#d_findBarHotKey'].forEach( id => {
	
		let hk = $(id);
		hk.onclick = function(evv) {
			
			function preventDefaults(e) {
				console.log('preventing defaults');
				e.preventDefault();
			}
			
			document.addEventListener('keydown', preventDefaults);
			
			hk.innerHTML = '<img src="/icons/spinner.svg" style="height:1em" /> ';
			hk.appendChild(document.createTextNode(browser.i18n.getMessage('PressKey')));
					
			document.addEventListener('keyup', (e) => {
				
				e.preventDefault();

				let keyArray = [];
				
				if ( e.which === 27 ) {
					keyArray = [];
					hk.innerHTML = null;
					hk.appendChild(keyArrayToButtons(keyArray));
					return;
				}
				
				if (e.ctrlKey) keyArray.push(17);
				if (e.altKey) keyArray.push(18);
				if (e.shiftKey) keyArray.push(16);
				
				keyArray.push(e.keyCode);
				
				hk.innerHTML = null;
				hk.appendChild(keyArrayToButtons(keyArray));
				
				saveOptions();
				
				document.removeEventListener('keydown', preventDefaults);
				
			}, {once: true});
			
		}
	});
});
	
document.addEventListener('DOMContentLoaded', () => {
	let div = $('#d_clearSearchHistory');
	div.animating = false;
	div.onclick = function() {
		if (div.animating) return false;
		div.animating = true;
		
		userOptions.searchBarHistory = [];
		saveOptions();
		
		let yes = document.createElement('div');
		yes.className = 'yes';
		div.appendChild(imgContainer);
		
		yes.addEventListener('transitionend', (e) => {
			div.removeChild(yes);
			div.animating = false;
		});
		
		yes.getBoundingClientRect();
		yes.style.opacity = 0;
		
	}
});

// setup disabled options
document.addEventListener('DOMContentLoaded', () => {
	
	(() => { // disable focus quick menu search bar when hotkeys enabled
		let select = $('#s_quickMenuSearchHotkeys');
		
		function toggle() {
			let cb1 = $('#cb_quickMenuSearchBarFocus');

			if (select.value === 'noAction') {
				cb1.disabled = false;
				cb1.parentNode.style.opacity = null;
			//	cb1.parentNode.querySelector('[data-disabled-msg]').style.display = 'none';
			} else {
				cb1.disabled = true;
				cb1.parentNode.style.opacity = .5;
			//	cb1.parentNode.querySelector('[data-disabled-msg]').style.display = null;
			}		
		}
		select.addEventListener('change', toggle);
		toggle();
	})();
	
	(() => {
		let cb = $('#cb_quickMenuUseOldStyle');
		let input = $('#n_quickMenuColumns');
		
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
		let cb = $('#cb_searchBarUseOldStyle');
		let input = $('#n_searchBarColumns');
		
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
		let cb = $('#cb_sideBarUseOldStyle');
		let input = $('#n_sideBarColumns');
		
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
