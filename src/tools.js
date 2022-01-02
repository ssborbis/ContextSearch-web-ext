const QMtools = [
	{
		name: 'close', 
		icon: "icons/crossmark.svg",
		context: ["quickmenu"],
		title: browser.i18n.getMessage('tools_Close'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));
			
			tile.action = this.action;
			return tile;
		},
		action: function(e) {
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_close_icon"});
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
			
			tile.action = this.action;
			return tile;
		}, 
		action: async function(e) {

				let hasPermission = await browser.runtime.sendMessage({action: "hasPermission", permission: "clipboardWrite"});

				if ( !hasPermission ) {
					try {
						await browser.permissions.request({permissions: ['clipboardWrite']});
					} catch (err) {
						browser.runtime.sendMessage({action: "openOptions", hashurl:"#requestPermissions"});
						return;
					}
				}
				let copy = await browser.runtime.sendMessage({action: "copyRaw"});

				this.dataset.locked = true;

				this.style.backgroundImage = 'url(icons/checkmark.svg)';
				this.querySelector('.tool').style.opacity = 0;
				setTimeout(() => {
					this.dataset.locked = false;
					this.style.backgroundImage = null;
					this.querySelector('.tool').style.opacity = null;
				}, 500);
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

			tile.action = this.action;
						
			return tile;
		},
		action: function(e) {

			if (this.dataset.disabled === "true") return;

			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: "openAsLink",
					selectionText: sb.value,
					openMethod: getOpenMethod(e),
					openUrl: true
				}
			});
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
			
			tile.action = this.action;
			return tile;
		},
		action: function(e) {
			userOptions.quickMenu = false;
			quickMenuObject.disabled = true;

			browser.runtime.sendMessage({
				action: "updateQuickMenuObject", 
				quickMenuObject: quickMenuObject
			});
			
			browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});

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

			tile.action = this.action;
			tile.tool = this;
			
			return tile;
		},
		action: function(e) {
			let tool = userOptions.quickMenuTools.find( tool => tool.name === "lock" );

			quickMenuObject.locked = !quickMenuObject.locked;

			if ( quickMenuObject.locked )
				browser.runtime.sendMessage({action: "lockQuickMenu"});
			else
				browser.runtime.sendMessage({action: "unlockQuickMenu"});

			tool.on = quickMenuObject.locked;

			if ( tool.persist )	saveUserOptions();

			setToolLockedState(this.tool || this, tool.on);
		}
	},
	{
		name: 'lastused', 
		icon: "icons/history_one.svg", 
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

			tile.action = this.action;
			return tile;
		},
		action: function(e) {
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
			
			tile.action = this.action;
			tile.tool = this;
			return tile;
		},
		action: function(e) {
			tool = userOptions.quickMenuTools.find( _tool => _tool.name === "repeatsearch" );

			tool.on = !tool.on;

			setToolLockedState(this.tool || this, tool.on);
			
			saveUserOptions();

			browser.runtime.sendMessage({
				action: "updateQuickMenuObject", 
				quickMenuObject: quickMenuObject
			});
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
				
			tile.action = this.action;
			return tile;
		},
		action: function(e) {
			qm.toggleDisplayMode()
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
						
			tile.action = this.action;
			return tile;
		},
		action: function(e) {
			browser.runtime.sendMessage(Object.assign({action:"mark", searchTerms: sb.value, findBarSearch:true}, userOptions.highLight.findBar.markOptions));
		}
	},
	{
		name: 'openoptions', 
		icon: "icons/settings.svg", 
		title: browser.i18n.getMessage('settings'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.action = this.action;
			return tile;
		},
		action: function(e) {
			browser.runtime.sendMessage({action: "openOptions", hashurl: "#quickMenu"});
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
			
			tile.action = this.action;
			return tile;
		},
		action: function() {
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
			
			tile.action = this.action;
			tile.tool = this;
			return tile;
		},
		action: function() {
			userOptions.allowHotkeysWithoutMenu = !userOptions.allowHotkeysWithoutMenu;
			saveUserOptions();

			setToolLockedState(this.tool || this, userOptions.allowHotkeysWithoutMenu);

			
		}
	},
	{
		name: 'edit', 
		icon: "icons/edit.svg", 
		title: browser.i18n.getMessage('edit'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			tile.tool = this;
			return tile;
		}, 
		action: function() {

			browser.runtime.sendMessage({action: "editQuickMenu"});
			
			if ( !userOptions.alwaysAllowTileRearranging ) {
				window.tilesDraggable = !window.tilesDraggable;
				setDraggable();

				setToolLockedState(this.tool || this, window.tilesDraggable);
				resizeMenu();
			}

			// special handler for when mouseup is disabled in addTileEventHandlers
			// if ( window.tilesDraggable && this ) 
			// 	this.addEventListener('mouseup', e => this.action(), {once: true});
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

			tile.action = this.action;			
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
	},
	{
		name: 'recentlyused', 
		icon: "icons/history.svg",
		title: browser.i18n.getMessage('recentlyused'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			return tile;
		}, 
		action: async function() {

			if (qm.rootNode.id === '___recent___') return;
			
			qm = await quickMenuElementFromNodeTree(recentlyUsedListToFolder());
			
			resizeMenu({openFolder: true});	
		}
	},
	{
		name: 'showhide', 
		icon: "icons/hide.svg",
		title: browser.i18n.getMessage('showhide'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			tile.dataset.locked = false;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			tile.tool = this;
			return tile;
		}, 
		action: async function() {

			let on = this.dataset.locked = this.dataset.locked == 'true' ? false : true;

			setToolLockedState(this.tool || this, on);

			qm.querySelectorAll('.tile').forEach( t => {
				if ( !t.node ) return;

				if ( t.node.hidden )
					t.style.display = on ? null : 'none';
			});
			
			resizeMenu({more: true});	
		}
	}
];

function getToolTile(name) {
	return document.querySelector(`[data-type="tool"][data-name="${name}"]`);
}

function setToolLockedState(tool, status) {
	document.querySelectorAll(`[data-type="tool"]`).forEach( t => {
		if ( t.tool && t.tool.name === tool.name ) {
			t.dataset.locked = status;
		}
	});
}

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

function copyToClip(str) {
  function listener(e) {
    e.clipboardData.setData("text/html", str);
    e.clipboardData.setData("text/plain", str);
    e.preventDefault();
  }
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
}

function getBrightness(el) {

	let rgbCSS = window.getComputedStyle(el, null).getPropertyValue('background-color');

	let sep = rgbCSS.indexOf(",") > -1 ? "," : " ";
  rgb = rgbCSS.substr(4).split(")")[0].split(sep);

 	return Math.round(((parseInt(rgb[0]) * 299) +
                      (parseInt(rgb[1]) * 587) +
                      (parseInt(rgb[2]) * 114)) / 1000);
}

