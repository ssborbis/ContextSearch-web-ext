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
					
			tile.dataset.locked = false;
			addTileEventHandlers(tile, (e) => {

				if ( tile.dataset.locked === "true" )
					tile.dataset.locked = quickMenuObject.locked = false;
				else
					tile.dataset.locked = quickMenuObject.locked = true;

				// lock styles methods moved to onMessage listener
				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject,
					toggleLock: true
				});
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

				browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then( result => {
					
					let _id = result.shift().lastUsed;

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
				});
			}
			
			updateIcon();

			document.addEventListener('updatesearchterms', updateIcon); // fires when a search executes, piggybacking for icon update

			addTileEventHandlers(tile, (e) => {
			
				let lastUsedId = quickMenuObject.lastUsed || null;// || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;
				
				if ( !lastUsedId) return;

				quickMenuObject.lastUsed = lastUsedId;
				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: lastUsedId,
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

			browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then( result => {
				tile.dataset.disabled = !result.shift().repeatsearch;
			});

			addTileEventHandlers(tile, (e) => {

				let lastUsedId = quickMenuObject.lastUsed || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;
				
				quickMenuObject.lastUsed = lastUsedId;
				
				quickMenuObject.repeatsearch = (tile.dataset.disabled == "true") ? true : false;
				
				tile.dataset.disabled = !quickMenuObject.repeatsearch;

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
			});
			
			return tile;
		}
	}
];