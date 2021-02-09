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
		icon: "icons/lock.svg", 
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
		icon: "icons/history.svg", 
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
						tile.style.backgroundImage = `url('${se.icon_base64String || se.icon_url}')`;
					} else if ( node.type === "folder" ) {
						tile.style.backgroundImage = `url(${node.icon || browser.runtime.getURL("/icons/folder-icon.svg")})`;
					} else {
						tile.style.backgroundImage = `url('${node.icon}')`;
					}

					tile.title = tile.dataset.title = "«" + node.title + "»";
					
				} else
					tile.dataset.disabled = true;
			}
			
			updateIcon();

			document.addEventListener('updatesearchterms', updateIcon); // fires when a search executes, piggybacking for icon update
			
			document.addEventListener('updateLastUsed', updateIcon);

			addTileEventHandlers(tile, e => {

				if ( !userOptions.lastUsedId ) return;
				
				let node = findNode(userOptions.nodeTree, _node => _node.id === userOptions.lastUsedId);

				browser.runtime.sendMessage({
					action: "quickMenuSearch", 
					info: {
						menuItemId: node.id,
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

			tile.dataset.locked = tool.on;

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
				}
				
			});

			addTileEventHandlers(tile, e => {
				
				tool = userOptions.quickMenuTools.find( _tool => _tool.name === this.name );

				tool.on = !tool.on;
				
				tile.dataset.locked = tool.on;

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
				browser.runtime.sendMessage({action: "openOptions", hashurl: "#quickMenu"});
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
			
			addTileEventHandlers(tile, async () => {

				let currentLink = document.querySelector('link[rel="stylesheet"].theme');

				let currentThemeIndex = themes.findIndex(t => currentLink.href.endsWith(t.path));

				let theme = themes[(1 + currentThemeIndex) % themes.length];
				currentLink.parentNode.removeChild(currentLink);

				await setTheme(theme);

				setAllToolIconColors();

				qm.setMinWidth();
				resizeMenu({widgetResize: true});

				userOptions.quickMenuTheme = theme.name;
			
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
			
			tile.dataset.locked = userOptions.allowHotkeysWithoutMenu ? "true" : "false";
			
			addTileEventHandlers(tile, () => {
				userOptions.allowHotkeysWithoutMenu = !userOptions.allowHotkeysWithoutMenu;

				tile.dataset.locked = userOptions.allowHotkeysWithoutMenu ? "true" : "false";
				saveUserOptions();

			});
			
			return tile;
		}
	},
	{
		name: 'edit', 
		icon: "icons/edit.png", 
		title: browser.i18n.getMessage('edit'),
		init: function() {
			let tile = buildSearchIcon(browser.runtime.getURL(this.icon), this.title);
			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			addTileEventHandlers(tile, () => {
				browser.runtime.sendMessage({action: "editQuickMenu"});
				window.tilesDraggable = !window.tilesDraggable;
				tile.dataset.locked = window.tilesDraggable;
			});
			
			return tile;
		}
	}
];

function setAllToolIconColors() {
	let tools = document.querySelectorAll(toolSelector);
	
	tools.forEach( tool => setToolIconColor(tool));

	buildCommonIcons();
}

function setIconColor(url, color) {

	return new Promise( (resolve, reject) => {

		let img = new Image();

		img.onload = () => {

			var canvas=document.createElement("canvas");
			var ctx=canvas.getContext("2d");
			ctx.canvas.width = img.width;
			ctx.canvas.height = img.height;
			ctx.save();
			
			// draw the shape we want to use for clipping
			ctx.drawImage(img, 0, 0);

			// change composite mode to use that shape
			ctx.globalCompositeOperation = 'source-in';

			// draw the image to be clipped
			// ctx.drawImage(img, 0, 0);

			ctx.beginPath();
			ctx.rect(0, 0, img.width, img.height);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.restore();
			
			let data = canvas.toDataURL("image/png");

			if (data.length < 10) reject("BadDataURL");
			else resolve(data);
		}

		img.onerror = function(err) { reject(err) }
		
		img.src = url;

	});
}

async function setToolIconColor(el, color) {

	color = color || window.getComputedStyle(el).getPropertyValue('--tools-color') || window.getComputedStyle(document.documentElement).getPropertyValue('--tools-color');

	if ( !color ) return;

	if ( el.nodeName === "IMG") {

		let newIcon = await setIconColor(el.src, color);
		el.src = newIcon;

	} else {

		let bg = el.style.getPropertyValue("background-image") || window.getComputedStyle(el).getPropertyValue("background-image");
		let fixedbg = bg.replace(/^url\("(.*)"\)/, '$1');
		let newIcon = await setIconColor(fixedbg, color);
		el.style.backgroundImage = `url(${newIcon})`;
	}
}

const toolSelector = '[data-type="tool"]:not([data-nocolorinvert]), .tile[data-type="more"], .tile[data-type="less"]';
