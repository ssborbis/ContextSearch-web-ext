window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();

// not jQuery 
var $ = s => {
	return document.querySelector(s);
}

// array for storage.local
var userOptions = {};

// Browse button for manual import
$("#selectMozlz4FileButton").addEventListener('change', ev => {
	
	let searchEngines = [];
	let file = ev.target.files[0];
	
	if ( $('#cb_overwriteOnImport').checked && confirm("This will delete all custom search engines, folders, bookmarklets, separators, etc. Are you sure?") ) {
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

async function restoreOptions() {

	function onGot(uo) {

		userOptions = uo;

		$('#cb_quickMenu').checked = uo.quickMenu;	
		$('#n_quickMenuColumns').value = uo.quickMenuColumns;
		$('#n_quickMenuRows').value = uo.quickMenuRows;
		$('#n_quickMenuRowsSingleColumn').value = uo.quickMenuRowsSingleColumn;
		
		$('#b_quickMenuKey').value = uo.quickMenuKey;
		$('#b_quickMenuKey').innerText = keyCodeToString(uo.quickMenuKey) || browser.i18n.getMessage('ClickToSet');
		
		$('#b_contextMenuKey').value = uo.contextMenuKey;	
		$('#b_contextMenuKey').innerText = keyCodeToString(uo.contextMenuKey) || browser.i18n.getMessage('ClickToSet');
		$('#s_contextMenuSearchLinksAs').value = uo.contextMenuSearchLinksAs;
		$('#cb_contextMenuOnLinks').checked = uo.contextMenuOnLinks;
		$('#cb_contextMenuOnImages').checked = uo.contextMenuOnImages;
		$('#r_quickMenuOnKey').checked = uo.quickMenuOnKey;			
		$('#cb_quickMenuOnMouse').checked = uo.quickMenuOnMouse;
		$('#s_quickMenuOnMouseMethod').value = uo.quickMenuOnMouseMethod;
		$('#cb_quickMenuSearchOnMouseUp').checked = uo.quickMenuSearchOnMouseUp;
		$('#r_quickMenuAuto').checked = uo.quickMenuAuto;
		$('#cb_quickMenuAutoAlt').checked = uo.quickMenuAutoAlt;
		$('#cb_quickMenuAutoShift').checked = uo.quickMenuAutoShift;
		$('#cb_quickMenuAutoCtrl').checked = uo.quickMenuAutoCtrl;
		$('#cb_quickMenuAutoOnInputs').checked = uo.quickMenuAutoOnInputs;
		$('#cb_quickMenuOnLinks').checked = uo.quickMenuOnLinks;
		
		$('#cb_quickMenuOnImages').checked = uo.quickMenuOnImages;
		$('#cb_quickMenuCloseOnScroll').checked = uo.quickMenuCloseOnScroll;
		$('#cb_quickMenuCloseOnClick').checked = uo.quickMenuCloseOnClick;
		$('#s_quickMenuToolsPosition').value = uo.quickMenuToolsPosition;
		$('#cb_quickMenuToolsAsToolbar').checked = uo.quickMenuToolsAsToolbar;
		$('#s_quickMenuSearchBar').value = uo.quickMenuSearchBar;
		$('#cb_quickMenuSearchBarFocus').checked = uo.quickMenuSearchBarFocus;
		$('#cb_quickMenuSearchBarSelect').checked = uo.quickMenuSearchBarSelect;
		$('#range_quickMenuScale').value = uo.quickMenuScale;
		$('#range_quickMenuIconScale').value = uo.quickMenuIconScale;
		// $('#i_quickMenuScale').value = (parseFloat(uo.quickMenuScale) * 100).toFixed(0) + "%";
		// $('#i_quickMenuIconScale').value = (parseFloat(uo.quickMenuIconScale) * 100).toFixed(0) + "%";
		$('#n_quickMenuOffsetX').value = uo.quickMenuOffset.x;
		$('#n_quickMenuOffsetY').value = uo.quickMenuOffset.y;
		
		$('#cb_quickMenuOnSimpleClick').checked = uo.quickMenuOnSimpleClick.enabled;
		$('#s_quickMenuOnSimpleClickButton').value = uo.quickMenuOnSimpleClick.button.toString();
		$('#cb_quickMenuOnSimpleClickAlt').checked = uo.quickMenuOnSimpleClick.alt;
		$('#cb_quickMenuOnSimpleClickCtrl').checked = uo.quickMenuOnSimpleClick.ctrl;
		$('#cb_quickMenuOnSimpleClickShift').checked = uo.quickMenuOnSimpleClick.shift;
		$('#cb_quickMenuSimpleClickUseInnerText').checked = uo.quickMenuOnSimpleClick.useInnerText;
		$('#cb_quickMenuOnDrag').checked = uo.quickMenuOnDrag;
		$('#cb_quickMenuDragAlt').checked = uo.quickMenuDragAlt;
		$('#cb_quickMenuDragShift').checked = uo.quickMenuDragShift;
		$('#cb_quickMenuDragCtrl').checked = uo.quickMenuDragCtrl;
		
		$('#s_quickMenuMouseButton').value = uo.quickMenuMouseButton.toString();
		$('#cb_contextMenu').checked = uo.contextMenu;
		$('#h_position').value = uo.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.classList.remove('active')
			if (p.dataset.position === uo.quickMenuPosition)
				p.classList.add('active');
		}
				
		$('#s_contextMenuClick').value = uo.contextMenuClick;
		$('#s_contextMenuMiddleClick').value = uo.contextMenuMiddleClick;
		$('#s_contextMenuRightClick').value = uo.contextMenuRightClick;
		$('#s_contextMenuShift').value = uo.contextMenuShift;
		$('#s_contextMenuCtrl').value = uo.contextMenuCtrl;
		
		$('#cb_contextMenuShowAddCustomSearch').checked = uo.contextMenuShowAddCustomSearch;
		$('#cb_contextMenuShowRecentlyUsed').checked = uo.contextMenuShowRecentlyUsed;
		$('#cb_contextMenuShowRecentlyUsedAsFolder').checked = uo.contextMenuShowRecentlyUsedAsFolder;
		$('#n_contextMenuRecentlyUsedLength').value = uo.recentlyUsedListLength;
		$('#cb_contextMenuShowFolderSearch').checked = uo.contextMenuShowFolderSearch;
		$('#i_contextMenuTitle').value = uo.contextMenuTitle;

		$('#cb_quickMenuShowRecentlyUsed').checked = uo.quickMenuShowRecentlyUsed;
		
		$('#s_quickMenuLeftClick').value = uo.quickMenuLeftClick;
		$('#s_quickMenuRightClick').value = uo.quickMenuRightClick;
		$('#s_quickMenuMiddleClick').value = uo.quickMenuMiddleClick;
		$('#s_quickMenuShift').value = uo.quickMenuShift;
		$('#s_quickMenuCtrl').value = uo.quickMenuCtrl;
		$('#s_quickMenuAlt').value = uo.quickMenuAlt;
		
		$('#s_quickMenuFolderLeftClick').value = uo.quickMenuFolderLeftClick;
		$('#s_quickMenuFolderRightClick').value = uo.quickMenuFolderRightClick;
		$('#s_quickMenuFolderMiddleClick').value = uo.quickMenuFolderMiddleClick;
		$('#s_quickMenuFolderShift').value = uo.quickMenuFolderShift;
		$('#s_quickMenuFolderCtrl').value = uo.quickMenuFolderCtrl;
		$('#s_quickMenuFolderAlt').value = uo.quickMenuFolderAlt;
		$('#s_quickMenuSearchHotkeys').value = uo.quickMenuSearchHotkeys;
		$('#s_quickMenuSearchHotkeysFolders').value = uo.quickMenuSearchHotkeysFolders;
		
		$('#cb_quickMenuShowHotkeysInTitle').checked = uo.quickMenuShowHotkeysInTitle;
		
		$('#n_quickMenuAutoMaxChars').value = uo.quickMenuAutoMaxChars;
		$('#n_quickMenuOpeningOpacity').value = uo.quickMenuOpeningOpacity;
		$('#n_quickMenuAutoTimeout').value = uo.quickMenuAutoTimeout;
		$('#cb_quickMenuAllowContextMenuNew').checked = uo.quickMenuAllowContextMenuNew;
		$('#cb_quickMenuFocusOnOpen').checked = uo.quickMenuFocusOnOpen;

		$('#cb_searchBarSuggestions').checked = uo.searchBarSuggestions;
		$('#cb_searchBarEnableHistory').checked = uo.searchBarEnableHistory;
		$('#cb_searchBarDisplayLastSearch').checked = uo.searchBarDisplayLastSearch;
		$('#s_searchBarDefaultView').value = uo.searchBarUseOldStyle ? "text" : "grid";
		$('#cb_searchBarCloseAfterSearch').checked = uo.searchBarCloseAfterSearch;
		$('#s_quickMenuDefaultView').value = uo.quickMenuUseOldStyle ? "text" : "grid";
		$('#n_searchBarColumns').value = uo.searchBarColumns;
		
		$('#n_sideBarColumns').value = uo.sideBar.columns;
		$('#s_sideBarDefaultView').checked = uo.sideBar.singleColumn ? "text" : "grid";
		$('#s_sideBarWidgetPosition').value = uo.sideBar.widget.position;
		$('#cb_sideBarWidgetEnable').checked = uo.sideBar.widget.enabled;
		$('#cb_sideBarStartOpen').checked = uo.sideBar.startOpen;
		$('#cb_sideBarCloseAfterSearch').checked = uo.sideBar.closeAfterSearch;
		$('#range_sideBarScale').value = uo.sideBar.scale;
		// $('#i_sideBarScale').value = (parseFloat(uo.sideBar.scale) * 100).toFixed(0) + "%";
		
		$('#t_userStyles').value = uo.userStyles;
		$('#cb_userStylesEnabled').checked = uo.userStylesEnabled;
		$('#t_userStyles').disabled = !uo.userStylesEnabled;
		$('#cb_enableAnimations').checked = uo.enableAnimations;
		$('#s_quickMenuTheme').value = uo.quickMenuTheme;
		
		$('#cb_highLightEnabled').checked = uo.highLight.enabled;
		$('#cb_highLightFollowDomain').checked = uo.highLight.followDomain;
		$('#cb_highLightFollowExternalLinks').checked = uo.highLight.followExternalLinks;
		
		$('#s_highLightStyle').value = uo.highLight.highlightStyle;
		
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
		
		$('#cb_highLightFlashSelected').checked = uo.highLight.flashSelected;

		$('#cb_highLightNavBarEnabled').checked = uo.highLight.navBar.enabled;
		$('#cb_highLightShowFindBar').checked = uo.highLight.showFindBar;
		
		$('#cb_highLightMarkOptionsSeparateWordSearch').checked = uo.highLight.markOptions.separateWordSearch;
		$('#cb_highLightMarkOptionsIgnorePunctuation').checked = uo.highLight.markOptions.ignorePunctuation;
		$('#cb_highLightMarkOptionsCaseSensitive').checked = uo.highLight.markOptions.caseSensitive;
		$('#s_highLightMarkOptionsAccuracy').value = uo.highLight.markOptions.accuracy;
		$('#n_highLightMarkOptionsLimit').value = uo.highLight.markOptions.limit;

		$('#cb_findBarMarkOptionsSeparateWordSearch').checked = uo.highLight.findBar.markOptions.separateWordSearch;
		$('#cb_findBarMarkOptionsIgnorePunctuation').checked = uo.highLight.findBar.markOptions.ignorePunctuation;
		$('#cb_findBarMarkOptionsCaseSensitive').checked = uo.highLight.findBar.markOptions.caseSensitive;
		$('#s_findBarMarkOptionsAccuracy').value = uo.highLight.findBar.markOptions.accuracy;
		$('#n_findBarMarkOptionsLimit').value = uo.highLight.findBar.markOptions.limit;
		
		$('#cb_findBarStartOpen').checked = uo.highLight.findBar.startOpen;
		$('#cb_findBarOpenInAllTabs').checked = uo.highLight.findBar.openInAllTabs;
		$('#cb_findBarSearchInAllTabs').checked = uo.highLight.findBar.searchInAllTabs;
		$('#s_findBarPosition').value = uo.highLight.findBar.position;
		$('#s_findBarWindowType').value = uo.highLight.findBar.windowType;
		$('#cb_findBarShowNavBar').checked = uo.highLight.findBar.showNavBar;
		$('#n_findBarTimeout').value = uo.highLight.findBar.keyboardTimeout;
		$('#range_findBarScale').value = uo.highLight.findBar.scale;

		$('#n_searchBarHistoryLength').value = uo.searchBarHistoryLength;
		$('#n_searchBarSuggestionsCount').value = uo.searchBarSuggestionsCount;
		$('#cb_groupLabelMoreTile').checked = uo.groupLabelMoreTile;
		$('#cb_autoCopy').checked = uo.autoCopy;
		$('#cb_rememberLastOpenedFolder').checked = uo.rememberLastOpenedFolder;
		$('#cb_autoPasteFromClipboard').checked = uo.autoPasteFromClipboard;
		$('#cb_allowHotkeysWithoutMenu').checked = uo.allowHotkeysWithoutMenu;
		
		$('#n_quickMenuHoldTimeout').value = uo.quickMenuHoldTimeout || 250;
		$('#cb_exportWithoutBase64Icons').checked = uo.exportWithoutBase64Icons;
		$('#cb_addSearchProviderHideNotification').checked = uo.addSearchProviderHideNotification;
		$('#cb_syncWithFirefoxSearch').checked = uo.syncWithFirefoxSearch;
		$('#cb_quickMenuTilesDraggable').checked = uo.quickMenuTilesDraggable; 
		$('#cb_disableNewTabSorting').checked = uo.disableNewTabSorting; 
		$('#cb_sideBarRememberState').checked = uo.sideBar.rememberState;
		$('#cb_sideBarOpenOnResults').checked = uo.sideBar.openOnResults;
		$('#cb_sideBarOpenOnResultsMinimized').checked = uo.sideBar.openOnResultsMinimized;
		$('#cb_quickMenuPreventPageClicks').checked = uo.quickMenuPreventPageClicks;
		$('#cb_omniboxDefaultToLastUsedEngine').checked = uo.omniboxDefaultToLastUsedEngine;
		$('#s_omniboxSearch').value = uo.omniboxSearch;
		$('#cb_contextMenuUseInnerText').checked = uo.contextMenuUseInnerText;
		$('#n_cacheIconsMaxSize').value = uo.cacheIconsMaxSize;
		$('#cb_forceOpenReultsTabsAdjacent').checked = uo.forceOpenReultsTabsAdjacent;

		$('#n_quickMenuToolbarRows').value = uo.quickMenuToolbarRows;

		$('#n_pageTilesRows').value = uo.pageTiles.rows;
		$('#n_pageTilesColumns').value = uo.pageTiles.columns;
		$('#cb_pageTilesEnabled').checked = uo.pageTiles.enabled;
		$('#s_pageTilesOpenMethod').value = uo.pageTiles.openMethod;
		$('#s_pageTilesPalette').value = uo.pageTiles.paletteString;
		$('#cb_pageTilesCloseOnShake').checked = uo.pageTiles.closeOnShake;
		
		$('#cb_contextMenuHotkeys').checked = uo.contextMenuHotkeys;

		$('#n_openFoldersOnHoverTimeout').value = uo.openFoldersOnHoverTimeout;
		$('#n_shakeSensitivity').value = uo.shakeSensitivity;
		$('#cb_rightClickMenuOnMouseDownFix').checked = uo.rightClickMenuOnMouseDownFix;
		$('#cb_quickMenuHideSeparatorsInGrid').checked = uo.quickMenuHideSeparatorsInGrid;
		$('#cb_groupFolderRowBreaks').checked = uo.groupFolderRowBreaks;
		$('#cb_quickMenuRegexMatchedEngines').checked = uo.quickMenuRegexMatchedEngines;
		$('#cb_contextMenuRegexMatchedEngines').checked = uo.contextMenuRegexMatchedEngines;
		$('#cb_alwaysAllowTileRearranging').checked = uo.alwaysAllowTileRearranging;
		$('#cb_contextMenuUseContextualLayout').checked = uo.contextMenuUseContextualLayout;	
		$('#n_contextMenuContextualLayoutFlattenLimit').value = uo.contextMenuContextualLayoutFlattenLimit;
		$('#i_quickMenuDomLayout').value = uo.quickMenuDomLayout;


		$('#style_dark').disabled = !uo.nightMode;

		$('#cb_quickMenuToolsLockPersist').checked = (() => {
			let tool = uo.quickMenuTools.find( t => t.name === "lock"); 
			return (tool) ? tool.persist || false : false;
		})();

		$('#cb_quickMenuToolsRepeatSearchPersist').checked = (() => {
			let tool = uo.quickMenuTools.find( t => t.name === "repeatsearch"); 
			return (tool) ? tool.persist || false : false;
		})();

		$('#t_blockList').value = uo.blockList.filter(el => el.trim()).join('\n');

		// toolBar icon
		(() => {
			let radios = document.querySelectorAll(`#toolBarIconForm input[type="radio"]`);
			let radio = [...radios].find( r => r.value === uo.searchBarIcon );
			if ( radio ) radio.checked = true;
			else setToolBarIconOption(uo.searchBarIcon);
		})();


		// allow context menu on right-click
		(() => {
			function onChange(e) {
				document.querySelector('[data-i18n="HoldForContextMenu"]').style.display = ( $('#s_quickMenuMouseButton').value === "3" && $('#s_quickMenuOnMouseMethod').value === "click" ) ? null : 'none';	
			}
			
			[$('#s_quickMenuMouseButton'), $('#s_quickMenuOnMouseMethod')].forEach( s => {
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
	
	function onSet() {
		browser.browserAction.setIcon({path: userOptions.searchBarIcon || 'icons/icon48.png'});
		showSaveMessage(browser.i18n.getMessage("saved"), null, document.getElementById('saveNoticeDiv'));
		return Promise.resolve(true);
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	userOptions = {
		searchEngines: userOptions.searchEngines,
		nodeTree: userOptions.nodeTree,
		lastUsedId: userOptions.lastUsedId,
		quickMenu: $('#cb_quickMenu').checked,
		quickMenuColumns: parseInt($('#n_quickMenuColumns').value),
		quickMenuRows: parseInt($('#n_quickMenuRows').value),
		quickMenuRowsSingleColumn: parseInt($('#n_quickMenuRowsSingleColumn').value),
		defaultGroupColor: userOptions.defaultGroupColor,
		defaultGroupColorText: userOptions.defaultGroupColorText,

		quickMenuKey: parseInt($('#b_quickMenuKey').value),
		contextMenuKey: parseInt($('#b_contextMenuKey').value),
		
		quickMenuOnKey: $('#r_quickMenuOnKey').checked,
		quickMenuOnDrag: $('#cb_quickMenuOnDrag').checked,
		quickMenuDragAlt: $('#cb_quickMenuDragAlt').checked,
		quickMenuDragShift: $('#cb_quickMenuDragShift').checked,
		quickMenuDragCtrl: $('#cb_quickMenuDragCtrl').checked,
		quickMenuOnMouse: $('#cb_quickMenuOnMouse').checked,
		quickMenuOnMouseMethod: $('#s_quickMenuOnMouseMethod').value,
		quickMenuSearchOnMouseUp: $('#cb_quickMenuSearchOnMouseUp').checked,
		quickMenuMouseButton: parseInt($("#s_quickMenuMouseButton").value),
		quickMenuAuto: $('#r_quickMenuAuto').checked,
		quickMenuAutoAlt: $('#cb_quickMenuAutoAlt').checked,
		quickMenuAutoShift: $('#cb_quickMenuAutoShift').checked,
		quickMenuAutoCtrl: $('#cb_quickMenuAutoCtrl').checked,
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
		contextMenuShowRecentlyUsed: $('#cb_contextMenuShowRecentlyUsed').checked,
		contextMenuShowRecentlyUsedAsFolder: $('#cb_contextMenuShowRecentlyUsedAsFolder').checked,
		contextMenuShowFolderSearch: $('#cb_contextMenuShowFolderSearch').checked,	
		contextMenuTitle: $('#i_contextMenuTitle').value,
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
		quickMenuSearchHotkeysFolders: $('#s_quickMenuSearchHotkeysFolders').value,
		quickMenuSearchBar: $('#s_quickMenuSearchBar').value,
		quickMenuSearchBarFocus: $('#cb_quickMenuSearchBarFocus').checked,
		quickMenuSearchBarSelect: $('#cb_quickMenuSearchBarSelect').checked,
		quickMenuAutoMaxChars: parseInt($('#n_quickMenuAutoMaxChars').value) || 0,
		quickMenuOpeningOpacity: parseFloat($('#n_quickMenuOpeningOpacity').value) || .3,
		quickMenuAutoTimeout: parseInt($('#n_quickMenuAutoTimeout').value),
		quickMenuAllowContextMenuNew: $('#cb_quickMenuAllowContextMenuNew').checked,
		quickMenuShowHotkeysInTitle: $('#cb_quickMenuShowHotkeysInTitle').checked,
		quickMenuFocusOnOpen: $('#cb_quickMenuFocusOnOpen').checked,
		
		quickMenuOnSimpleClick: {
			enabled: $('#cb_quickMenuOnSimpleClick').checked,
			button: parseInt($('#s_quickMenuOnSimpleClickButton').value),
			alt: $('#cb_quickMenuOnSimpleClickAlt').checked,
			ctrl: $('#cb_quickMenuOnSimpleClickCtrl').checked,
			shift: $('#cb_quickMenuOnSimpleClickShift').checked,
			useInnerText: $('#cb_quickMenuSimpleClickUseInnerText').checked
		},
		
		contextMenu: $('#cb_contextMenu').checked,
		contextMenuOnLinks: $('#cb_contextMenuOnLinks').checked,
		contextMenuOnImages: $('#cb_contextMenuOnImages').checked,
		
		quickMenuToolsPosition: $('#s_quickMenuToolsPosition').value,
		quickMenuToolsAsToolbar: $('#cb_quickMenuToolsAsToolbar').checked,

		searchBarUseOldStyle: $('#s_searchBarDefaultView').value === "text",
		searchBarColumns: parseInt($('#n_searchBarColumns').value),
		searchBarCloseAfterSearch: $('#cb_searchBarCloseAfterSearch').checked,
		
		quickMenuUseOldStyle: $('#s_quickMenuDefaultView').value === "text",
		
		 // take directly from loaded userOptions
		searchBarSuggestions: $('#cb_searchBarSuggestions').checked,
		searchBarEnableHistory: $('#cb_searchBarEnableHistory').checked,
		searchBarHistory: userOptions.searchBarHistory,
		searchBarDisplayLastSearch: $('#cb_searchBarDisplayLastSearch').checked,
		searchBarIcon: $('#toolBarIconForm input[type="radio"]:checked').value,
		
		sideBar: {
			enabled: userOptions.sideBar.enabled,
			columns:parseInt($('#n_sideBarColumns').value),
			singleColumn:$('#s_sideBarDefaultView').value === "text",
			hotkey: [],
			startOpen: $('#cb_sideBarStartOpen').checked,
			widget: {
				enabled: $('#cb_sideBarWidgetEnable').checked,
				position: $('#s_sideBarWidgetPosition').value,
				offset: userOptions.sideBar.widget.offset
			},
			windowType: userOptions.sideBar.windowType,
			offsets: userOptions.sideBar.offsets,
			position: userOptions.sideBar.position,
			height: userOptions.sideBar.height,
			closeAfterSearch: $('#cb_sideBarCloseAfterSearch').checked,
			rememberState: $('#cb_sideBarRememberState').checked,
			openOnResults: $('#cb_sideBarOpenOnResults').checked,
			openOnResultsMinimized: $('#cb_sideBarOpenOnResultsMinimized').checked,
			scale: parseFloat($('#range_sideBarScale').value),
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
				startOpen: $('#cb_findBarStartOpen').checked,
				openInAllTabs: $('#cb_findBarOpenInAllTabs').checked,
				searchInAllTabs: $('#cb_findBarSearchInAllTabs').checked,
				showNavBar: $('#cb_findBarShowNavBar').checked,
				position: $('#s_findBarPosition').value,
				keyboardTimeout: parseInt($('#n_findBarTimeout').value),
				windowType: $('#s_findBarWindowType').value,
				offsets: userOptions.highLight.findBar.offsets,
				markOptions: {
					separateWordSearch: $('#cb_findBarMarkOptionsSeparateWordSearch').checked,
					ignorePunctuation: $('#cb_findBarMarkOptionsIgnorePunctuation').checked,
					caseSensitive: $('#cb_findBarMarkOptionsCaseSensitive').checked,
					accuracy: $('#s_findBarMarkOptionsAccuracy').value,
					limit: parseInt($('#n_findBarMarkOptionsLimit').value)
				},
				scale: parseFloat($('#range_findBarScale').value),
			},
			markOptions: {
				separateWordSearch: $('#cb_highLightMarkOptionsSeparateWordSearch').checked,
				ignorePunctuation: $('#cb_highLightMarkOptionsIgnorePunctuation').checked,
				caseSensitive: $('#cb_highLightMarkOptionsCaseSensitive').checked,
				accuracy: $('#s_highLightMarkOptionsAccuracy').value,
				limit: parseInt($('#n_highLightMarkOptionsLimit').value)
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
		quickMenuTheme: $('#s_quickMenuTheme').value,
		
		searchBarHistoryLength: parseInt($('#n_searchBarHistoryLength').value),
		searchBarSuggestionsCount: parseInt($('#n_searchBarSuggestionsCount').value),
		groupLabelMoreTile: $('#cb_groupLabelMoreTile').checked,
		autoCopy: $('#cb_autoCopy').checked,
		autoPasteFromClipboard: $('#cb_autoPasteFromClipboard').checked,
		allowHotkeysWithoutMenu: $('#cb_allowHotkeysWithoutMenu').checked,
		rememberLastOpenedFolder: $('#cb_rememberLastOpenedFolder').checked,
		quickMenuHoldTimeout: parseInt($('#n_quickMenuHoldTimeout').value),
		exportWithoutBase64Icons: $('#cb_exportWithoutBase64Icons').checked,
		addSearchProviderHideNotification: $('#cb_addSearchProviderHideNotification').checked,
		syncWithFirefoxSearch: $('#cb_syncWithFirefoxSearch').checked,
		quickMenuTilesDraggable: $('#cb_quickMenuTilesDraggable').checked,
		recentlyUsedList: userOptions.recentlyUsedList,
		recentlyUsedListLength: parseInt($('#n_contextMenuRecentlyUsedLength').value),
		quickMenuShowRecentlyUsed: $('#cb_quickMenuShowRecentlyUsed').checked,
		disableNewTabSorting: $('#cb_disableNewTabSorting').checked,
		contextMenuHotkeys: $('#cb_contextMenuHotkeys').checked,
		quickMenuPreventPageClicks: $('#cb_quickMenuPreventPageClicks').checked,
		openFoldersOnHoverTimeout: parseInt($('#n_openFoldersOnHoverTimeout').value),
		omniboxDefaultToLastUsedEngine: $('#cb_omniboxDefaultToLastUsedEngine').checked,
		omniboxLastUsedIds: userOptions.omniboxLastUsedIds,
		omniboxSearch: $('#s_omniboxSearch').value,
		contextMenuUseInnerText: $('#cb_contextMenuUseInnerText').checked,
		cacheIconsMaxSize: parseInt($('#n_cacheIconsMaxSize').value),
		nightMode: userOptions.nightMode,
		userShortcuts: userOptions.userShortcuts,
		shakeSensitivity: parseInt($('#n_shakeSensitivity').value),
		forceOpenReultsTabsAdjacent: $('#cb_forceOpenReultsTabsAdjacent').checked,
		rightClickMenuOnMouseDownFix: $('#cb_rightClickMenuOnMouseDownFix').checked,
		quickMenuToolbarRows: parseInt($('#n_quickMenuToolbarRows').value),
		quickMenuHideSeparatorsInGrid: $('#cb_quickMenuHideSeparatorsInGrid').checked,
		groupFolderRowBreaks: $('#cb_groupFolderRowBreaks').checked,
		quickMenuRegexMatchedEngines: $('#cb_quickMenuRegexMatchedEngines').checked,
		contextMenuRegexMatchedEngines: $('#cb_contextMenuRegexMatchedEngines').checked,
		alwaysAllowTileRearranging: $('#cb_alwaysAllowTileRearranging').checked,
		contextMenuUseContextualLayout: $('#cb_contextMenuUseContextualLayout').checked,
		contextMenuContextualLayoutFlattenLimit: parseInt($('#n_contextMenuContextualLayoutFlattenLimit').value),
		quickMenuDomLayout: $('#i_quickMenuDomLayout').value,

		pageTiles: {
			enabled: $('#cb_pageTilesEnabled').checked,
			rows: parseInt($('#n_pageTilesRows').value),
			columns: parseInt($('#n_pageTilesColumns').value),
			openMethod: $('#s_pageTilesOpenMethod').value,
			grid: userOptions.pageTiles.grid,
			paletteString: $('#s_pageTilesPalette').value,
			closeOnShake: $('#cb_pageTilesCloseOnShake').checked
		},

		quickMenuTools: userOptions.quickMenuTools,
		blockList: $('#t_blockList').value.split(/\r?\n/),
		version: userOptions.version
	};

	// prevent DeadObjects
//	userOptions = JSON.parse(JSON.stringify(userOptions));

	var setting = browser.runtime.sendMessage({action: "saveUserOptions", userOptions: JSON.parse(JSON.stringify(userOptions))});
	return setting.then(onSet, onError);
}

document.addEventListener("DOMContentLoaded", async e => {

	// build the DOM
	makeTabs();
	//initAdvancedOptions();
	buildPositionWidget();
	setVersion();
	hideBrowserSpecificElements();
	buildInfoBubbles();
	buildImportExportButtons();
	buildHelpTab();
	buildClearSearchHistory();
	buildSaveButtons();
	hashChange();
	buildUploadOnHash();
	buildThemes();

	// restore settings and set INPUT values
	await restoreOptions();

	// build DOM objects requiring prefs restored
	buildShortcutTable();
	buildSearchEngineContainer();
	buildToolIcons();
	sortAdvancedOptions();

	document.body.style.opacity = 1;
	addDOMListeners();

});

function addDOMListeners() {

	$('#cb_autoPasteFromClipboard').addEventListener('change', async (e) => {
		
		if ( e.target.checked === true ) {
			e.target.checked = await browser.permissions.request({permissions: ["clipboardRead"]});
			saveOptions();
		}
	});

	$('#cb_autoCopy').addEventListener('change', async (e) => {
		if ( e.target.checked === true ) {
			e.target.checked = await browser.permissions.request({permissions: ["clipboardWrite"]});
			saveOptions();
		}
	});

	["quickMenuScale", "sideBarScale", "findBarScale", "quickMenuIconScale"].forEach( id => {
		$(`#range_${id}`).addEventListener('input', ev => {
			$(`#i_${id}`).value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
		});

		$(`#range_${id}`).dispatchEvent(new Event('input'));
	});

	$('#cb_userStylesEnabled').addEventListener('change', e => {
		$('#t_userStyles').disabled = ! e.target.checked;
	});

	$('#b_quickMenuKey').addEventListener('click', keyButtonListener);
	$('#b_contextMenuKey').addEventListener('click', keyButtonListener);

	$('#cb_syncWithFirefoxSearch').addEventListener('change', e => {
		$('#searchEnginesParentContainer').style.display = e.target.checked ? "none" : null;
	});

	$('#b_requestClipboardPermissions').addEventListener('click', async () => {
		await browser.permissions.request({permissions: ['clipboardWrite']});
		window.close();
	})
}

document.addEventListener('userOptionsLoaded', e => {
	$('#searchEnginesParentContainer').style.display = $('#cb_syncWithFirefoxSearch').checked ? "none" : null;
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
			$('#h_position').value = el.dataset.position;
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
				if ( el.dataset.minversion > info.version )
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
function buildInfoBubbles() {
	
	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
	for (let el of i18n_tooltips) {
		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip') || el.dataset.msg || el.dataset.i18n_tooltip;
		
		el.addEventListener('mouseenter', e => {
			showInfoMsg(el, el.dataset.msg);
		});
		
		el.addEventListener('mouseleave', e => {
			$('#info_msg').style.display = 'none';
		});
	}
}

// import/export buttons
function buildImportExportButtons() {
	
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
				// overDiv.innerText = "Fetching remote content";
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
						if ( node.type === "oneClickSearchEngine" && !node.icon ) {
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
	$('#s_quickMenuTheme').innerHTML = null;
	themes.forEach( t => {
		let option = document.createElement('option');
		option.value = option.innerText = t.name;
		$('#s_quickMenuTheme').appendChild(option);
	});
}

$('#b_cacheIcons').addEventListener('click', cacheAllIcons);

$('#b_uncacheIcons').addEventListener('click', e => {
	if ( confirm('remove all icon cache?'))	uncacheIcons();
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

		setTimeout(() => msg.parentNode.removeChild(msg), 5000);

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
		tr.innerHTML = `
			<td></td>
			<td>${s.name || s.action}</td>
			<td><span style="cursor:pointer;user-select:none;" title="${browser.i18n.getMessage("ClickToSet")}" data-id="${s.id}">set</span></td>
			`;
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

imageUploadHandler($('#toolBarIconPicker'), img => {
	let uri = imageToBase64(img, 32);
	setToolBarIconOption(uri);
	saveOptions();
});

function setToolBarIconOption(uri) {
	$('#toolBarIconForm .toolBarIconCustom').style.backgroundImage = `url(${uri})`;
	$('#toolBarIcon_3').checked = true;
	$('#toolBarIcon_3').value = uri;
}

function sortAdvancedOptions() {
	let table = $('#advancedSettingsTable');

	let trs = table.querySelectorAll('tr');

	trs = [...trs].sort((a,b) => {
		return a.querySelector('td').innerText > b.querySelector('td').innerText ? 1 : -1;
	});
	table.innerHTML = null;
	trs.forEach( tr => table.appendChild(tr));
}

// window.addEventListener('focus', async e => {
// 	let uo = await browser.runtime.sendMessage({action: 'getUserOptions'});

// 	if ( JSON.stringify(uo) !== JSON.stringify(userOptions))
// 		console.log('changed');
// })

// saveOptions on every change
document.addEventListener('change', e => {
	setTimeout(saveOptions, 250);
})