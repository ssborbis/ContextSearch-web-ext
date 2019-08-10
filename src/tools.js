var QMtools = [
	{
		name: 'close', 
		icon: "icons/close.png", 
		title: browser.i18n.getMessage('tools_Close'),
		init: function() {
			let tile_close = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			tile_close.onclick = function(e) {
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
			}
			
			return tile_close;
		}
	},
	{
		name: 'copy', 
		icon: "icons/clipboard.png", 
		title: browser.i18n.getMessage('tools_Copy'),
		init: function() {
			let tile_copy = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
					
			tile_copy.onclick = function() {

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
			}
			
			return tile_copy;
		}
	},
	{
		name: 'link', 
		icon: "icons/link.svg", 
		title: browser.i18n.getMessage('tools_OpenAsLink'),
		init: function() {
			let tile_link = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			// enable/disable link button on very basic 'is it a link' rules
			function setDisabled() {
				if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
					tile_link.dataset.disabled = true;
				} else {
					tile_link.dataset.disabled = false;
				}
			}
			
			// set initial disabled state
			setDisabled();
			
			// when new search terms are set while locked, enable/disable link
			document.addEventListener('updatesearchterms', (e) => {
				setDisabled();
			});
			
			addTileEventHandlers(tile_link, (e) => {

				if (tile_link.dataset.disabled === "true") return;

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
			
			return tile_link;
		}
	},
	{
		name: 'disable', 
		icon: "icons/power.svg", 
		title: browser.i18n.getMessage('tools_Disable'),
		init: function() {
			let tile_disable = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			tile_disable.onclick = function(e) {
				
				userOptions.quickMenu = false;
				quickMenuObject.disabled = true;
				
				if (document.title === "QuickMenu") {
					browser.runtime.sendMessage({
						action: "updateQuickMenuObject", 
						quickMenuObject: quickMenuObject
					});
				}
				
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});
			}
			
			return tile_disable;
		}
	},
	{
		name: 'lock', 
		icon: "icons/lock.png", 
		title: browser.i18n.getMessage('tools_Lock'),
		init: function() {
			let tile_lock = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
					
			tile_lock.dataset.locked = false;
			tile_lock.onclick = function(e) {

				if ( this.dataset.locked === "true" )
					this.dataset.locked = quickMenuObject.locked = false;
				else
					this.dataset.locked = quickMenuObject.locked = true;

				// lock styles methods moved to onMessage listener
				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject,
					toggleLock: true
				});
			}
			
			return tile_lock;
		}
	},
	{
		name: 'lastused', 
		icon: "icons/search.svg", 
		title: browser.i18n.getMessage('tools_lastused'),
		init: function() {

			let tile_lastused = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			function updateIcon() {

				browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then( result => {
					
					let _id = result.shift().lastUsed;

					if ( _id ) {
				
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
						
						tile_lastused.style.backgroundImage = 'url(' + icon + ')';
						tile_lastused.title = node.title;
					}
				});
			}
			
			updateIcon();

			document.addEventListener('updatesearchterms', updateIcon); // fires when a search executes, piggybacking for icon update

			addTileEventHandlers(tile_lastused, (e) => {
			
				let lastUsedId = quickMenuObject.lastUsed || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;

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
			
			return tile_lastused;
		}
	},
	{
		name: 'repeatsearch', 
		icon: "icons/repeatsearch.svg", 
		title: browser.i18n.getMessage('tools_repeatsearch'),
		init: function() {
			let tile_qs = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			browser.runtime.sendMessage({action: "getTabQuickMenuObject"}).then( result => {
				tile_qs.dataset.disabled = tile_qs.disabled = !result.shift().repeatsearch;
			});

			tile_qs.onclick = function(e) {

				let lastUsedId = quickMenuObject.lastUsed || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;
				
				quickMenuObject.lastUsed = lastUsedId;
				
				tile_qs.disabled = tile_qs.dataset.disabled = !tile_qs.disabled;
				
				quickMenuObject.repeatsearch = !tile_qs.disabled;

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
			}
			
			return tile_qs;
		}
	}
];