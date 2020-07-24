var QMtools = [
	{
		name: 'close', 
		icon: "icons/close.svg",
		context: ["quickmenu"],
		title: browser.i18n.getMessage('tools_Close'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			addTileEventHandlers(tile, e => {
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
			});
			
			return tile;
		}
	},
	{
		name: 'copy', 
		icon: "icons/copy.svg", 
		title: browser.i18n.getMessage('tools_Copy'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			addTileEventHandlers(tile, async (e) => {

				let input = document.createElement('input');
				input.style.visibility = 'none';
				document.body.appendChild(input);
				input.value = sb.value;
				input.select();
				document.execCommand('copy');
				input.parentNode.removeChild(input);

				let backgroundImage = tile.style.backgroundImage;
				tile.style.backgroundImage = `url(${browser.runtime.getURL('icons/checkmark.svg')})`;
				
				setTimeout(() => tile.style.backgroundImage = backgroundImage, 500);
			});
			
			return tile;
		}
	},
	{
		name: 'link', 
		icon: "icons/link.svg", 
		title: browser.i18n.getMessage('tools_OpenAsLink'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			// enable/disable link button on very basic 'is it a link' rules
			function setDisabled() {
				if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
					tile.disabled = true;
					tile.dataset.disabled = true;
				} else {
					delete tile.disabled;
					tile.dataset.disabled = false;
				}
			}
			
			// set initial disabled state
			setDisabled();
			
			// when new search terms are set while locked, enable/disable link
			document.addEventListener('updatesearchterms', e => {
				setDisabled();
			});
			
			addTileEventHandlers(tile, e => {

				if (tile.dataset.disabled === "true") return;

				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: "openAsLink",
						selectionText: sb.value,
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
		context: ["quickmenu"],
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			addTileEventHandlers(tile, e => {
				
				userOptions.quickMenu = false;
				quickMenuObject.disabled = true;

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
				
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});
			});
			
			return tile;
		}
	},
	{
		name: 'lock', 
		icon: "icons/lock.png", 
		title: browser.i18n.getMessage('tools_Lock'),
		context: ["quickmenu"],
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			tile.keepOpen = true; // prevent close on click
			
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			let on = ( tool.persist && tool.on ) ? true : false;

			tile.dataset.locked = quickMenuObject.locked = on;
			
			if ( on ) {
				// wait for first resize event to lock menu
				document.addEventListener('resizeDone', () => {
					tile.dataset.locked = quickMenuObject.locked = true;
					browser.runtime.sendMessage({action: "lockQuickMenu"});
				}, {once: true});
			}

			addTileEventHandlers(tile, e => {

				if ( tile.dataset.locked === "true" ) {
					tile.dataset.locked = quickMenuObject.locked = false;
					browser.runtime.sendMessage({action: "unlockQuickMenu"});
				} else {
					tile.dataset.locked = quickMenuObject.locked = true;
					browser.runtime.sendMessage({action: "lockQuickMenu"});
				}

				tool.on = quickMenuObject.locked;

				if ( tool.persist )
					saveUserOptions();
			});
			
			return tile;
		}
	},
	{
		name: 'lastused', 
		icon: "icons/history.png", 
		title: browser.i18n.getMessage('tools_lastused'),		
		init: function() {

			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			tile.dataset.nocolorinvert = true;
			
			function updateIcon() {

				let _id = userOptions.lastUsedId;

				if ( _id ) {
					
					tile.dataset.disabled = false;

					let node = findNode(userOptions.nodeTree, _node => _node.id === _id);
					
					if ( !node ) return;
					
					if ( node.type === "searchEngine" ) {
						let se = userOptions.searchEngines.find( se => se.id === node.id );
						tile.style.backgroundImage = `url('${se.img_base64String || se.icon_url})`;
					} else {
						tile.style.backgroundImage = `url('${node.icon})`;
					}

					tile.title = tile.dataset.title = "«" + node.title + "»";
					
				} else
					tile.dataset.disabled = true;
			}
			
			updateIcon();

			document.addEventListener('updatesearchterms', updateIcon); // fires when a search executes, piggybacking for icon update

			addTileEventHandlers(tile, e => {

				if ( !userOptions.lastUsedId ) return;

				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: userOptions.lastUsedId,
						selectionText: sb.value,
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
		context: ["quickmenu"],
		init: function() {

			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			
			tile.keepOpen = true; // prevent close on click
			
			let tool = userOptions.quickMenuTools.find( _tool => _tool.name === this.name );

			tile.dataset.disabled = !tool.on;

			document.addEventListener('quickMenuComplete', () => {
				
				if ( !this.context.includes(type) ) return;

				// bypass displaying the menu and execute a search immedately if using repeatsearch
				if ( tool.on ) {
					
					let _id = userOptions.lastUsedId || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;
					browser.runtime.sendMessage({
						action: "quickMenuSearch", 
						info: {
							menuItemId:_id,
							selectionText: quickMenuObject.searchTerms,
							openMethod: userOptions.quickMenuLeftClick
						}
					});
					
					addToHistory(quickMenuObject.searchTerms, _id);
				}
				
			});

			addTileEventHandlers(tile, e => {
				
				tool = userOptions.quickMenuTools.find( _tool => _tool.name === this.name );

				tool.on = !tool.on;
				
				tile.dataset.disabled = !tool.on;

				saveUserOptions();

				browser.runtime.sendMessage({
					action: "updateQuickMenuObject", 
					quickMenuObject: quickMenuObject
				});
				
			});
			
			return tile;
		}
	},
	{
		name: 'toggleview', 
		icon: "icons/quick_menu.svg", 
		title: browser.i18n.getMessage('grid') + " / " + browser.i18n.getMessage('text'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			tile.keepOpen = true; // prevent close on click

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			let timer;
			tile.addEventListener('dragenter', e => {
				
				if ( e.dataTransfer.getData("text") === "tool" ) return;

				timer = setTimeout(qm.toggleDisplayMode, 1000);
				tile.addEventListener('dragleave', e => clearTimeout(timer), {once: true});
			});
				
			addTileEventHandlers(tile, e => qm.toggleDisplayMode());
			
			return tile;
		}
	},
	{
		name: 'findinpage', 
		icon: "icons/highlight.svg", 
		title: browser.i18n.getMessage('findinpage'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			addTileEventHandlers(tile, () => {
				browser.runtime.sendMessage(Object.assign({action:"mark", searchTerms: sb.value, findBarSearch:true}, userOptions.highLight.findBar.markOptions));
			});
			
			return tile;
		}
	},
	{
		name: 'openoptions', 
		icon: "icons/settings.svg", 
		title: browser.i18n.getMessage('settings'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			addTileEventHandlers(tile, () => {
				browser.runtime.sendMessage({action: "openOptions", hashurl: "?tab=quickMenuTab"});
			});
			
			return tile;
		}
	},
	{
		name: 'toggle_theme', 
		icon: "icons/theme.svg", 
		title: browser.i18n.getMessage('ToggleTheme'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			tile.keepOpen = true;

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			addTileEventHandlers(tile, () => {
				let d = document.querySelector('#dark');
	
				if ( !d ) return;
				
				d.rel = ( userOptions.quickMenuTheme === 'dark' ) ? "stylesheet alternate" : "stylesheet";
				userOptions.quickMenuTheme = ( userOptions.quickMenuTheme === 'dark' ) ? "lite" : "dark";
				
				let tools = document.querySelectorAll('.tile[data-type="tool"]:not([data-nocolorinvert]), .tile[data-type="more"], .tile[data-type="less"]');
				tools.forEach( tool => setToolIconColor(tool));

				saveUserOptions();
			});
			
			return tile;
		}
	},
	{
		name: 'toggle_hotkeys', 
		icon: "icons/keyboard.svg", 
		title: browser.i18n.getMessage('toggleHotkeys'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			tile.keepOpen = true;

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			tile.dataset.disabled = userOptions.allowHotkeysWithoutMenu ? "false" : "true";
			
			addTileEventHandlers(tile, () => {
				userOptions.allowHotkeysWithoutMenu = !userOptions.allowHotkeysWithoutMenu;

				tile.dataset.disabled = userOptions.allowHotkeysWithoutMenu ? "false" : "true";
				saveUserOptions();

			});
			
			return tile;
		}
	}
];