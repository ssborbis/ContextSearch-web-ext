const advancedOptions = [
  {
    "id": "addSearchProviderHideNotification",
    "i18n": "Notice for Firefox users to add opensearch engines using the Firefox search bar"
  },
  {
    "id": "alwaysAllowTileRearranging",
    "i18n": "Always allow tiles to be rearranged in the menus"
  },
  {
    "id": "autoCopy",
    "i18n": "Selected text is copied to the clipboard"
  },
  {
    "id": "autoPasteFromClipboard",
    "i18n": "Text in the clipboard is pasted to searchbars when search menus are opened"
  },
  {
    "id": "cacheIconsMaxSize",
    "i18n": "Max width or height to resize icons for caching"
  },
  {
    "id": "contextMenuContextualLayoutFlattenLimit",
    "i18n": "Remove subfolders and flatten menu if only n number of engines are to be shown. 0 = no limit"
  },
  {
    "id": "contextMenuHotkeys",
    "i18n": "Append hotkey to context menu items using (&A) format for quick access"
  },
  {
    "id": "contextMenuRegexMatchedEngines",
    "i18n": "Show regex matching engines at the top of the menu"
  },
  {
    "id": "contextMenuTitle",
    "i18n": "Override context menu title. Use %s in place of searchTerms. blank = default"
  },
  {
    "id": "contextMenuUseContextualLayout",
    "i18n": "Display the context menu in subfolders according to the current context"
  },
  {
    "id": "contextMenuUseInnerText",
    "i18n": "Use the inner text of an element as the search term when no text is selected"
  },
  {
    "id": "disableNewTabSorting",
    "i18n": "Enable to let the browser decide how to sort new search result tabs. Useful to prevent conflicts with tab managers"
  },
  {
    "id": "exportWithoutBase64Icons",
    "i18n": "Exported configs are smaller by excluding icon data URIs. May cause custom icons to be lost"
  },
  {
    "id": "forceOpenReultsTabsAdjacent",
    "i18n": "force search results to appear in next tab"
  },
  {
    "id": "groupFolderRowBreaks",
    "i18n": "Enable to show inline group folders as block elements"
  },
  {
    "id": "groupLabelMoreTile",
    "i18n": "Show the more / less icon for group folders inside the label tile vs using a separate tile"
  },
  {
    "id": "omniboxDefaultToLastUsedEngine",
    "i18n": "Default to the most recent search engine used with the omnibox"
  },
  {
    "id": "openFoldersOnHoverTimeout",
    "i18n": "Number of milliseconds to hover before opening a folder. 500 = default, 0 = disabled"
  },
  {
    "id": "quickMenuAllowContextMenuNew",
    "i18n": "Systems that display the context menu on mousedown vs mouseup may need to enable the advanced option rightClickMenuOnMouseDownFix"
  },
  {
    "id": "quickMenuAutoMaxChars",
    "i18n": "Maximum number of characters to be selected and still open the quick menu using the Auto method. Selecting more that the number will not open the menu. 0 = no limit "
  },
  {
    "id": "quickMenuAutoTimeout",
    "i18n": "Cancels opening the quick menu if pausing for a set number of milliseconds before releasing the mouse button. 0 = disabled"
  },
  {
    "id": "quickMenuCancelDeadzone",
    "i18n": "How many pixels you can move the mouse before cancelling opening the quick menu using HOLD"
  },
  {
    "id": "quickMenuDomLayout",
    "i18n": "Override the quick menu layout using a comma-separated list of HTMLElement ids, i.e. ( menuBar, searchBarContainer, optionsBar, quickMenuElement, addEngineBar, titleBar, toolBar ). Not all ids need be used. Any listed will be moved to the end of the DOM tree. blank = default"
  },
  {
    "id": "quickMenuFocusOnOpen",
    "i18n": "set focus to the quick menu after opening"
  },
  {
    "id": "quickMenuHideSeparatorsInGrid",
    "i18n": "hide separators when using the quick menu in grid view"
  },
  {
    "id": "quickMenuHoldTimeout",
    "i18n": "Time in millisections to hold a mouse button before opening the quick menu using HOLD"
  },
  {
    "id": "quickMenuOpeningOpacity",
    "i18n": "Transparency level of the quick menu when opened. Becomes opaque on hover"
  },
  {
    "id": "quickMenuPreventPageClicks",
    "i18n": "Prevent mouse events on the current webpage while the quick menu is open"
  },
  {
    "id": "quickMenuRegexMatchedEngines",
    "i18n": "Show regex matching engines at the top of the menu"
  },
  {
    "id": "quickMenuSearchOnMouseUp",
    "i18n": "Allows a search to be performed from the quick menu on mouseup without requiring a mousedown. Useful when opening the menu on Hold and releasing the mouse on a search tile to perform a search."
  },
  {
    "id": "quickMenuShowHotkeysInTitle",
    "i18n": "Show hotkeys with titles"
  },
  {
    "id": "quickMenuShowRecentlyUsed",
    "i18n": "Show recently used engines at the top of the menu"
  },
  {
    "id": "quickMenuOnSimpleClick.useInnerText",
    "i18n": "Use the inner text of an element as the search term when no text is selected"
  },
  {
    "id": "quickMenuTilesDraggable",
    "i18n": "Search menu tiles can be rearranged by drag & drop"
  },
  {
    "id": "quickMenuToolbarRows",
    "i18n": "Maximum number of tool rows to display. 0 = no limit"
  },
  // {
  //   "id": "cb_quickMenuToolsLockPersist",
  //   "i18n": "The state of the lock tool will be remembered across sessions"
  // },
  // {
  //   "id": "cb_quickMenuToolsRepeatSearchPersist",
  //   "i18n": "The state of the repeat search tool will be remembered across sessions"
  // },
  {
    "id": "rememberLastOpenedFolder",
    "i18n": "Open menus to the last folder used"
  },
  {
    "id": "rightClickMenuOnMouseDownFix",
    "i18n": "Require a double-click to display the default context menu when using HOLD right mouse button to open the quick menu. Useful for preventing errant menus on systems that display the context menu on mouse down vs mouse up"
  },
  {
    "id": "searchBarHistoryLength",
    "i18n": "Maximum number of history entries to store"
  },
  {
    "id": "searchBarSuggestionsCount",
    "i18n": "Maximum number of Google suggestions to include"
  },
  {
    "id": "shakeSensitivity",
    "i18n": "Sensitivity for detecting a shake. Lower = more sensitive"
  },
  {
    "id": "sideBar.openOnResults",
    "i18n": "Open the sidebar on search results tabs"
  },
  {
    "id": "sideBar.openOnResultsMinimized",
    "i18n": "Open the sidebar on search results tabs minimized"
  },
  {
    "id": "sideBar.rememberState",
    "i18n": "Remember the opened state of the sidebar"
  }
];