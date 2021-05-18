var QMtools = [
	{
		name: 'close', 
		icon: "icons/crossmark.svg",
		context: ["quickmenu"],
		title: browser.i18n.getMessage('tools_Close'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			addTileEventHandlers(tile, async (e) => {

				let input = document.createElement('input');
				input.style.visibility = 'none';
				document.body.appendChild(input);
				input.value = sb.value;
				input.select();
				document.execCommand('copy');
				input.parentNode.removeChild(input);

				tile.dataset.locked = true;
				
				setTimeout(() => {
					tile.dataset.locked = false;
				}, 150);
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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			
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

			addTileEventHandlers(tile, () => this.action());
			
			return tile;
		},
		action: function() {
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			quickMenuObject.locked = !quickMenuObject.locked;

			if ( quickMenuObject.locked )
				browser.runtime.sendMessage({action: "lockQuickMenu"});
			else
				browser.runtime.sendMessage({action: "unlockQuickMenu"});

			tool.on = quickMenuObject.locked;

			if ( tool.persist )	saveUserOptions();

			let tile = document.querySelector(`[data-type="tool"][data-name="${this.name}"]`);
			if ( tile ) tile.dataset.locked = quickMenuObject.locked;
		}
	},
	{
		name: 'lastused', 
		icon: "icons/history.svg", 
		title: browser.i18n.getMessage('tools_lastused'),		
		init: function() {

			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			tile.dataset.nocolorinvert = true;
			
			function updateIcon() {

				let _id = userOptions.lastUsedId;

				if ( _id ) {
					
					tile.dataset.disabled = false;

					let tool_icon = tile.querySelector('.tool');

					if ( tool_icon ) tool_icon.parentNode.removeChild(tool_icon);

					let node = findNode(userOptions.nodeTree, _node => _node.id === _id);
					
					if ( !node ) return;

					let icon = getIconFromNode(node);
					tile.style.backgroundImage = `url('${icon}')`;
					
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

			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			
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
		icon: "icons/list.svg", 
		title: browser.i18n.getMessage('grid') + " / " + browser.i18n.getMessage('text'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true; // prevent close on click

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			let timer;
			tile.addEventListener('dragenter', e => {
				
				if ( e.dataTransfer.getData("text") === "tool" ) return;

				if ( window.tilesDraggable ) return false;

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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

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
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			tile.keepOpen = true;

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			addTileEventHandlers(tile, () => this.action());
			
			return tile;
		},
		action: async function() {
			nextTheme();
		}
	},
	{
		name: 'toggle_hotkeys', 
		icon: "icons/keyboard.svg", 
		title: browser.i18n.getMessage('toggleHotkeys'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			tile.keepOpen = true;

			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );
			
			tile.dataset.locked = userOptions.allowHotkeysWithoutMenu ? "true" : "false";
			
			addTileEventHandlers(tile, () => this.action());
			
			return tile;
		},
		action: function() {
			userOptions.allowHotkeysWithoutMenu = !userOptions.allowHotkeysWithoutMenu;
			saveUserOptions();

			let tile = document.querySelector(`[data-type="tool"][data-name="${this.name}"]`);
			if ( tile ) tile.dataset.locked = userOptions.allowHotkeysWithoutMenu ? "true" : "false";
		}
	},
	{
		name: 'edit', 
		icon: "icons/edit.png", 
		title: browser.i18n.getMessage('edit'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			addTileEventHandlers(tile, () => this.action());
			
			return tile;
		}, 
		action: function() {
			browser.runtime.sendMessage({action: "editQuickMenu"});
			window.tilesDraggable = !window.tilesDraggable;

			document.querySelectorAll('.tile').forEach( el => el.setAttribute('draggable', window.tilesDraggable));
			
			let tile = document.querySelector(`[data-type="tool"][data-name="${this.name}"]`);
			if ( tile ) tile.dataset.locked = window.tilesDraggable;

			// special handler for when mouseup is disabled in addTileEventHandlers
			if ( window.tilesDraggable && tile ) 
				tile.addEventListener('mouseup', e => this.action(), {once: true});
		}
	},
	{
		name: 'block', 
		icon: "icons/block.svg",
		title: browser.i18n.getMessage('addtoblocklist'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			addTileEventHandlers(tile, () => this.action());
			
			return tile;
		}, 
		action: async function() {
			let tabInfo = await browser.runtime.sendMessage({action:"getCurrentTabInfo"});
			let url = new URL(tabInfo.url);

			if ( !userOptions.blockList.includes(url.hostname) && confirm(browser.i18n.getMessage('addtoblocklistconfirm', url.hostname))) {
				console.log('adding to blocklist', url.hostname);
				userOptions.blockList.push(url.hostname);
				saveUserOptions();
			}
		}
	}
];

function makeMaskCanvas(url, color) {

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

function makeToolMask(tool) {
	let icon = document.createElement('div');
	icon.className = "tool";
	icon.style.setProperty('--mask-image', `url(${tool.icon})`);
	return icon;
}

const toolSelector = '[data-type="tool"]:not([data-nocolorinvert]), .tile[data-type="more"], .tile[data-type="less"]';
