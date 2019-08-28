var QMtools = [
	{
		name: 'close', 
		icon: "icons/close.png", 
		title: browser.i18n.getMessage('tools_Close'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			addTileEventHandlers(tile, (e) => {
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
			});
			
			return tile;
		}
	},
	{
		name: 'copy', 
		icon: "icons/clipboard.png", 
		title: browser.i18n.getMessage('tools_Copy'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
					
			addTileEventHandlers(tile, (e) => {

				let input = document.createElement('input');
				input.type = "text";
				input.value = getSearchBar().value;
				document.body.appendChild(input);

				input.select();
				
				if ( !document.queryCommandSupported('copy') ) {
					console.log('copy not supported');
					return;
				}

				document.execCommand("copy");
				
				// chrome requires execCommand be run from background
				browser.runtime.sendMessage({action: 'copy', msg: getSearchBar().value});
				
				tile.style.backgroundImage = `url(${browser.runtime.getURL('icons/checkmark.svg')})`;
				setTimeout( () => {
					tile.style.backgroundImage = `url(${browser.runtime.getURL(this.icon)})`;
				}, 500);
			});
			
			return tile;
		}
	},
	{
		name: 'link', 
		icon: "icons/link.svg", 
		title: browser.i18n.getMessage('tools_OpenAsLink'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			// enable/disable link button on very basic 'is it a link' rules
			function setDisabled() {
				if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
					tile.dataset.disabled = true;
				} else {
					tile.dataset.disabled = false;
				}
			}
			
			// set initial disabled state
			setDisabled();
			
			// when new search terms are set while locked, enable/disable link
			document.addEventListener('updatesearchterms', (e) => {
				setDisabled();
			});
			
			addTileEventHandlers(tile, (e) => {

				if (tile.dataset.disabled === "true") return;

				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: "openAsLink",
						selectionText: getSearchBar().value,
						openMethod: getOpenMethod(e),
						openUrl: true
					}
				});
			});
			
			return tile;
		}
	},
	{
		name: 'disable', 
		icon: "icons/power.svg", 
		title: browser.i18n.getMessage('tools_Disable'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			addTileEventHandlers(tile, (e) => {
				
				userOptions.quickMenu = false;
				quickMenuObject.disabled = true;
				
				if (document.title === "QuickMenu") {
					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					});
				}
				
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});
			});
			
			return tile;
		}
	},
	{
		name: 'lock', 
		icon: "icons/lock.png", 
		title: browser.i18n.getMessage('tools_Lock'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			tile.keepOpen = true; // prevent close on click
			
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			let on = ( tool.persist && tool.on ) ? true : false;

			tile.dataset.locked = quickMenuObject.locked = on;
			
			if ( on ) browser.runtime.sendMessage({action: "lockQuickMenu"});

			addTileEventHandlers(tile, (e) => {

				if ( tile.dataset.locked === "true" ) {
					tile.dataset.locked = quickMenuObject.locked = false;
					browser.runtime.sendMessage({action: "unlockQuickMenu"});
				} else {
					tile.dataset.locked = quickMenuObject.locked = true;
					browser.runtime.sendMessage({action: "lockQuickMenu"});
				}

				tool.on = quickMenuObject.locked;

				if ( tool.persist )
					browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
			});
			
			return tile;
		}
	},
	{
		name: 'lastused', 
		icon: "icons/search.svg", 
		title: browser.i18n.getMessage('tools_lastused'),
		init: function() {

			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			function updateIcon() {

				let _id = userOptions.lastUsedId;

				if ( _id ) {
					
					tile.dataset.disabled = false;
			
					let node = findNodes(userOptions.nodeTree, _node => _node.id === _id)[0];
						
					let icon = function() {
						switch (node.type) {
							case "searchEngine":
								let se = userOptions.searchEngines.find(_se => _se.id === node.id);
								return se.icon_base64String;
							case "oneClickSearchEngine":
								return node.icon;
						}
					}() || browser.runtime.getURL('icons/search.svg');
					
					tile.style.backgroundImage = `url(${icon})`;
					tile.title = node.title;
				} else
					tile.dataset.disabled = true;
			}
			
			updateIcon();

			document.addEventListener('updatesearchterms', updateIcon); // fires when a search executes, piggybacking for icon update

			addTileEventHandlers(tile, (e) => {

				if ( !userOptions.lastUsedId ) return;

				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: userOptions.lastUsedId,
						selectionText: getSearchBar().value,
						openMethod: getOpenMethod(e)
					}
				});
			});
			
			return tile;
		}
	},
	{
		name: 'repeatsearch', 
		icon: "icons/repeatsearch.svg", 
		title: browser.i18n.getMessage('tools_repeatsearch'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			tile.keepOpen = true; // prevent close on click
			
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.dataset.disabled = !tool.on;
			
			document.addEventListener('quickMenuComplete', () => {

				// bypass displaying the menu and execute a search immedately if using repeatsearch
				if ( tool.on ) {
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId:userOptions.lastUsedId || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null,
							selectionText: quickMenuObject.searchTerms,
							openMethod: userOptions.quickMenuLeftClick
						}
					});
				}
				
			});

			addTileEventHandlers(tile, (e) => {

				tool.on = !tool.on;
				
				tile.dataset.disabled = !tool.on;

				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
				
			});
			
			return tile;
		}
	}
];