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

		//	tile.keepOpen = true; // prevent close on click
			
			tile.action = this.action;
			return tile;
		}, 
		action: async function(e) {

			let hasPermission = await browser.runtime.sendMessage({action: "hasPermission", permission: "clipboardWrite"});

			if ( !hasPermission ) {
				try {
					await browser.permissions.request({permissions: ['clipboardWrite']});
				} catch (err) {
					browser.runtime.sendMessage({action: "openOptions", hashurl:"?permission=clipboardWrite#requestPermissions"});
					return;
				}
			}

			this.dataset.locked = true;
			this.querySelector('.tool').style.opacity = 0;
			this.style.backgroundImage = 'url(icons/spinner.svg)';

			let copy = await browser.runtime.sendMessage({action: "copyRaw"});

		//	this.style.backgroundImage = 'url(icons/checkmark.svg)';
			
			this.dataset.locked = false;
			this.style.backgroundImage = null;
			this.querySelector('.tool').style.opacity = null;

		}
	},
	{
		name: 'link', 
		icon: "icons/external_link.svg", 
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
		title: browser.i18n.getMessage('grid') + " / " + browser.i18n.getMessage('list'),
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
		title: browser.i18n.getMessage('editmenu'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			tile.tool = this;
			return tile;
		}, 
		action: function(o) {

			o = o || {};

			(() => { // rearrange menu parts

				if ( !window.editMode && !o.forceOff) {

					function saveDomLayout() {

						let order = [...document.querySelectorAll('.edit_handle')].map( el => {
							return ((el.querySelector('input').checked) ? "" : "!" ) + el.dataset.parentId;
						});

						if ( qm.dataset.menu === "quickmenu" )
							userOptions.quickMenuDomLayout = order.join(",");
						else if ( qm.dataset.menu === "sidebar" )
							userOptions.sideBar.domLayout = order.join(",");
						else if ( qm.dataset.menu === "searchbar" )
							userOptions.searchBarDomLayout = order.join(",");

						saveUserOptions();
					}

					window.editMode = true;

					let i18n_titles = {
						"quickMenuElement": 	'quickmenu',
						"toolBar": 				'tools',
						"menuBar": 				'menubar',
						"titleBar": 			'name',
						"searchBarContainer": 	'search'
					};
					
					[qm,tb,mb,toolBar,sbc].forEach( (el, index) => {

						let div = document.createElement('div');
						div.classList.add('edit_handle');
						div.draggable = true;
						div.innerText = browser.i18n.getMessage(i18n_titles[el.id]);
						div.dataset.parentId = el.id;

						let cb = document.createElement('input');
						cb.type = 'checkbox';
						cb.checked = ( window.getComputedStyle(el).display !== 'none' );
						cb.title = browser.i18n.getMessage('showhide')
						
						if ( el == qm ) cb.classList.add('hide');

						div.appendChild(cb);

						cb.addEventListener('change', e => {
							el.classList.toggle('hide', !cb.checked);
							resizeMenu({more: true});
							saveDomLayout();
						})

						div.addEventListener('dragstart', function(e) {
							e.dataTransfer.setData("text/plain", "");
							window.dragDiv = div;
						});

						div.addEventListener('dragover', e =>	e.preventDefault());
						div.addEventListener('dragenter', e => {
							if ( window.dragDiv && window.dragDiv.classList.contains('edit_handle'))
								div.classList.add('hover');
						});
						div.addEventListener('dragleave', e => {
							if ( window.dragDiv && window.dragDiv.classList.contains('edit_handle'))
								div.classList.remove('hover');
						});

						div.addEventListener('drop', function(e) {
							e.preventDefault();

							if ( window.dragDiv === div ) return false;

							let el = window.dragDiv.nextSibling;

							document.body.insertBefore(window.dragDiv, div);
							document.body.insertBefore(el, div);

							saveDomLayout();

						});

						div.addEventListener('dragend', e => {
							document.querySelectorAll('.edit_handle.hover').forEach( el => el.classList.remove('hover'));
						})

						el.parentNode.insertBefore(div, el);

					})
				} else {
					document.querySelectorAll('.edit_handle').forEach( el => el.parentNode.removeChild(el));
					window.editMode = false;
				}

				setTimeout(() => resizeMenu({more: true}), 250);
			})();

			if ( !o.forceOff )
				browser.runtime.sendMessage({action: "editQuickMenu"});
			
			if ( !userOptions.alwaysAllowTileRearranging ) {
				window.tilesDraggable = !window.tilesDraggable;
				setDraggable();

				setToolLockedState(this.tool || this, window.editMode);
				resizeMenu();
			}
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

			// show / hide based on context
			if ( on && qm.contexts.length ) {
				this.tool.contexts = qm.contexts;
				quickMenuObject.contexts = [];
				let node = findNode(window.root, n => n.id === qm.rootNode.id);
				qm = await quickMenuElementFromNodeTree(node);
			} else if ( !on && this.tool.contexts.length ) {
				quickMenuObject.contexts = this.tool.contexts;
				let node = findNode(window.root, n => n.id === qm.rootNode.id);
				qm = await quickMenuElementFromNodeTree(node);
			}

			qm.querySelectorAll('.tile').forEach( t => {
				if ( !t.node ) return;

				if ( t.node.hidden )
					t.style.display = on ? null : 'none';
			});
			
			resizeMenu({openFolder: true});
			qm.expandMoreTiles();
		}
	},
	{
		name: 'toggle_searchterms', 
		icon: "icons/selection.svg",
		title: browser.i18n.getMessage('toggleSearchTerms'),
		context: ["quickmenu"],
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

			showContext = c => this.querySelector('.tool').style.setProperty("--mask-image",`url(icons/${c}.svg)`);

			let sto = quickMenuObject.searchTermsObject;
			let keys = ["selection", "link", "image", "page"].filter( key => sto[key]);

			if ( !this.tool.searchTermsContext ) {
				for ( key in sto ) {
					if ( sto[key] == quickMenuObject.searchTerms ) {
						this.tool.searchTermsContext = key;
						break;
					}
				}
			}

			let newKey = keys[( keys.indexOf(this.tool.searchTermsContext) + 1 ) % keys.length];

			this.tool.searchTermsContext = newKey;

			sb.set(sto[newKey]);

		// //	showContext(newKey);
		// 	setTimeout(() => {
		// 		showContext("selection");
		// 	}, 1000);
		}
	},
	{
		name: 'open_image', 
		icon: "icons/image_open.svg", 
		title: browser.i18n.getMessage('tools_OpenImage'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			// enable/disable link button on very basic 'is it a link' rules
			// function setDisabled() {
			// 	if (quickMenuObject.searchTerms.trim().indexOf(" ") !== -1 || quickMenuObject.searchTerms.indexOf(".") === -1) {
			// 		tile.disabled = true;
			// 		tile.dataset.disabled = true;
			// 	} else {
			// 		delete tile.disabled;
			// 		tile.dataset.disabled = false;
			// 	}
			// }
			
			// set initial disabled state
			// setDisabled();
			
			// when new search terms are set while locked, enable/disable link
			// document.addEventListener('updatesearchterms', e => {
			// 	setDisabled();
			// });

			tile.action = this.action;
						
			return tile;
		},
		action: function(e) {

		//	if (this.dataset.disabled === "true") return;

			browser.runtime.sendMessage({
				action: "openTab", 
				openMethod: getOpenMethod(e),
				url:sb.value
			});
		}
	},
	{
		name: 'download', 
		icon: "icons/download.svg", 
		title: browser.i18n.getMessage('tools_Download'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(makeToolMask(this));

			tile.action = this.action;
						
			return tile;
		},
		action: function(e) {

			browser.runtime.sendMessage({
				action: "download",
				url:sb.value
			});
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

function getBrightness(el) {

	let rgbCSS = window.getComputedStyle(el, null).getPropertyValue('background-color');

	let sep = rgbCSS.indexOf(",") > -1 ? "," : " ";
  rgb = rgbCSS.substr(4).split(")")[0].split(sep);

 	return Math.round(((parseInt(rgb[0]) * 299) +
                      (parseInt(rgb[1]) * 587) +
                      (parseInt(rgb[2]) * 114)) / 1000);
}

