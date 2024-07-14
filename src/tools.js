const QMtools = [
	{
		name: 'close', 
		icon: "icons/crossmark.svg",
		context: ["quickmenu"],
		title: i18n('tools_Close'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
			
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
		title: i18n('tools_Copy'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('tools_OpenAsLink'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
				action: "search", 
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
		icon: "icons/qm.svg", 
		title: i18n('quickmenu'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));			
			tile.dataset.locked = quickMenuObject.disabled ? "false" : "true";
			tile.keepOpen = true; // prevent close on click
			tile.action = this.action;
			tile.tool = this;

			return tile;
		},
		action: function(e) {
			quickMenuObject.disabled = !quickMenuObject.disabled;

			tool = userOptions.quickMenuTools.find( _tool => _tool.name === "disable" );

			tool.on = !quickMenuObject.disabled;

			setToolLockedState(this.tool || this, tool.on);

			browser.runtime.sendMessage({
				action: "updateQuickMenuObject", 
				quickMenuObject: quickMenuObject
			});
			
			if ( quickMenuObject.disabled )
				browser.runtime.sendMessage({action: "closeQuickMenuRequest", eventType: "click_disable_icon"});

		}
	},
	{
		name: 'lock', 
		icon: "icons/lock.svg", 
		title: i18n('tools_Lock'),
		context: ["quickmenu"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
			
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
		title: i18n('tools_lastused'),		
		init: function() {

			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
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

			let searchTerms = ( typeof sb === 'undefined') ? quickMenuObject.searchTerms : sb.value;

			if ( !userOptions.lastUsedId ) return;
				
			let node = findNode(userOptions.nodeTree, _node => _node.id === userOptions.lastUsedId);

			browser.runtime.sendMessage({
				action: "search", 
				info: {
					menuItemId: node.id,
					selectionText: searchTerms,
					openMethod: (typeof getOpenMethod === 'undefined' ) ? userOptions.quickMenuLeftClick : getOpenMethod(e)
				}
			});
		}
	},
	{
		name: 'repeatsearch',
		icon: "icons/repeatsearch.svg",
		title: i18n('tools_repeatsearch'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {

			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
			
			tile.keepOpen = true; // prevent close on click
			
			let tool = userOptions.quickMenuTools.find( _tool => _tool.name === this.name );

			tile.dataset.locked = tool.on;

			document.addEventListener('quickMenuComplete', () => {
				
				if ( !this.context.includes(type) ) return;

				// bypass displaying the menu and execute a search immedately if using repeatsearch
				if ( tool.on ) {
					
					let _id = userOptions.lastUsedId || quickMenuElement.querySelector('[data-type="searchEngine"]').node.id || null;
					browser.runtime.sendMessage({
						action: "search", 
						info: {
							menuItemId:_id,
							selectionText: quickMenuObject.searchTerms,
							openMethod: userOptions.lastOpeningMethod || userOptions.quickMenuLeftClick
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
		title: i18n('grid') + " / " + i18n('list'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('findinpage'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('settings'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('ToggleTheme'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
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
		title: i18n('toggleHotkeys'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));
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
		title: i18n('editmenu'),
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			tile.tool = this;
			return tile;
		}, 
		action: async function(o) {

			o = o || {};
			
			// enable edit mode
			async function on() {

				console.log("edit layout on");

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
				window.tilesDraggable = true;

				// show all engines for editing
				if ( qm.contexts.length ) {

					let sh = QMtools.find(t => t.name === 'showhide');
					let sh_tile = sh.init();
					await sh_tile.action();

				//	window.showHideTile = sh_tile;
				}
				
				[qm,tb,mb,toolBar,sbc,ctb].forEach( (el, index) => {

					let div = document.createElement('div');
					div.classList.add('edit_handle');
					div.draggable = true;
					div.innerText = i18n(i18n_layout_titles[el.id] || "");
					div.dataset.parentId = el.id;

					let cb = document.createElement('input');
					cb.type = 'checkbox';
					cb.checked = ( window.getComputedStyle(el).display !== 'none' );
					cb.title = i18n('showhide')
					
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

				});

				// delete icon
				if ( userOptions.allowDeleteEnginesFromTileMenu ) {

					let dDiv = document.createElement('div');
					dDiv.id = 'deleteEngineDiv';

					let img = createMaskIcon("icons/delete.svg");
					dDiv.appendChild(img);
					document.body.appendChild(dDiv);

					dDiv.addEventListener('dragstart', e => {});

					dDiv.addEventListener('dragenter', e => img.classList.add("hover"));
					dDiv.addEventListener('dragleave', e => img.classList.remove("hover"));
					dDiv.addEventListener('dragend', e => img.classList.remove("hover"));
					dDiv.addEventListener('drop', e => img.classList.remove("hover"));
					dDiv.addEventListener('dragover', e => {
						e.preventDefault();
					    e.stopPropagation();
					});

					dDiv.addEventListener('drop', async e => {
					//	e.preventDefault();
					//	e.stopImmediatePropagation();

						// window.dragNode is deleted on drop events in tilemenu.js
						let deleteNode = window.dragNode;

						if ( confirm("Premanently delete?\n" + window.dragNode.title)) {
							console.log('deleting node', deleteNode);

							nodeCut(deleteNode, deleteNode.parent);
							await saveUserOptions();

							qm = await quickMenuElementFromNodeTree(qm.rootNode);
							setDraggable();

							// show all regardless of context or hidden
							let sh = QMtools.find(t => t.name === 'showhide');
							let sh_tile = sh.init();
							await sh_tile.action();

						}
					});
				}

			} 

			async function off() {

				console.log("edit layout off");

				// disable edit mode

				let dDiv = document.getElementById('deleteEngineDiv');
				if ( dDiv ) dDiv.parentNode.removeChild(dDiv);

				document.querySelectorAll('.edit_handle').forEach( el => el.parentNode.removeChild(el));
				window.editMode = false;
				window.tilesDraggable = false;
			}

			let _on = ( o.forceOn || ( !window.editMode && !o.forceOff ));

			if ( _on && !window.editMode ) 
				await on();
			else if ( window.editMode ) {
				await off();
			//	if ( window.showHideStatus )
			} else {
				return;
			}

			browser.runtime.sendMessage({action: "editQuickMenu", on: _on });

			setDraggable();

			setToolLockedState(this.tool || this, _on);
			resizeMenu({openFolder: true});

			// if ( userOptions.alwaysAllowTileRearranging ) {
			// 	window.tilesDraggable = true;
			// 	setDraggable();
			// }
		}
	},
	{
		name: 'block', 
		icon: "icons/block.svg",
		title: i18n('addtoblocklist'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;			
			return tile;
		}, 
		action: async function() {
			let tabInfo = await browser.runtime.sendMessage({action:"getCurrentTabInfo"});
			let url = new URL(tabInfo.url);

			if ( !userOptions.blockList.includes(url.hostname) && confirm(i18n('addtoblocklistconfirm', url.hostname))) {
				console.log('adding to blocklist', url.hostname);
				userOptions.blockList.push(url.hostname);
				saveUserOptions();
			}
		}
	},
	{
		name: 'recentlyused', 
		icon: "icons/history.svg",
		title: i18n('recentlyused'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('showhide'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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

				if ( t.node.hidden ) {
					t.style.display = on ? null : 'none';
					// t.classList.toggle("hidden", on);
				}
			});
			
			resizeMenu({openFolder: true});
			qm.expandMoreTiles();
		}
	},
	{
		name: 'context', 
		icon: "icons/selection.svg",
		title: i18n('context'),
		context: ["quickmenu", "sidebar", "searchbar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

			tile.keepOpen = true;
			let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

			tile.action = this.action;
			tile.tool = this;

			// let s = document.createElement('select');

			// contexts.forEach( c => {
			// 	let o = document.createElement('option');
			// 	o.value = c;
			// 	o.innerText = c;

			// 	s.appendChild(o);
			// });

			// s.id = 'contexts_select';
			// s.style.position = 'absolute';
			// s.style.top = 0;
			// s.style.left = 0;
			// s.style.visibility = 'hidden';
			// s.style.width = '100%';
			// s.style.height = '100%';
			// s.style.backgroundColor = 'transparent';
			// s.style.border = 'none';
			// s.style.color = 'var(--color)';
			// s.onfocus = function() {
			// 	s.style.backgroundColor = 'var(--bg-color)';
			// }

			// tile.appendChild(s);

			// tile.addEventListener('mouseover', e => {
			// 	s.style.visibility = null;
			// });

			// s.addEventListener('change', e => {
			// 	s.style.visibility = 'hidden';
				
			// 	quickMenuObject.contexts = [s.value];
			// 	quickMenuElementFromNodeTree( window.root ).then( _qm => {
			// 		qm = _qm;
			// 		resizeMenu({openFolder:true});
			// 	});
				
			// });

			return tile;
		}, 
		action: async function() {
			contextsBar.classList.toggle("hide");
			resizeMenu({openFolder:true});
		}
	},
	// {
	// 	name: 'toggle_searchterms', 
	// 	icon: "icons/selection.svg",
	// 	title: i18n('toggleSearchTerms'),
	// 	context: ["quickmenu"],
	// 	init: function() {
	// 		let tile = buildSearchIcon(null, this.title);
	// 		tile.appendChild(createMaskIcon(this.icon));

	// 		tile.keepOpen = true;
	// 		tile.dataset.locked = false;
	// 		let tool = userOptions.quickMenuTools.find( tool => tool.name === this.name );

	// 		tile.action = this.action;
	// 		tile.tool = this;

	// 		return tile;
	// 	}, 
	// 	action: async function() {

	// 		showContext = c => this.querySelector('.tool').style.setProperty("--mask-image",`url(icons/${c}.svg)`);

	// 		let sto = quickMenuObject.searchTermsObject;
	// 		let keys = ["selection", "link", "image", "page"].filter( key => sto[key]);

	// 		if ( !this.tool.searchTermsContext ) {
	// 			for ( key in sto ) {
	// 				if ( sto[key] == quickMenuObject.searchTerms ) {
	// 					this.tool.searchTermsContext = key;
	// 					break;
	// 				}
	// 			}
	// 		}

	// 		let newKey = keys[( keys.indexOf(this.tool.searchTermsContext) + 1 ) % keys.length];

	// 		this.tool.searchTermsContext = newKey;

	// 		sb.set(sto[newKey]);

	// 	// //	showContext(newKey);
	// 	// 	setTimeout(() => {
	// 	// 		showContext("selection");
	// 	// 	}, 1000);
	// 	}
	// },
	{
		name: 'open_image', 
		icon: "icons/image_open.svg", 
		title: i18n('tools_OpenImage'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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
		title: i18n('tools_Download'),
		context: ["quickmenu", "sidebar"],
		init: function() {
			let tile = buildSearchIcon(null, this.title);
			tile.appendChild(createMaskIcon(this.icon));

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

async function newMenuFromBookmarks() {
	let nodes = await browser.runtime.sendMessage({action: "getBookmarksAsNodeTree"});
	console.log(nodes);
	qm = await quickMenuElementFromNodeTree(nodes);
}

function getToolTile(name) {
	return document.querySelector(`[data-type="tool"][data-name="${name}"]`);
}

function setToolLockedState(tool, status) {

	toolStatuses[tool.name] = status;
	document.querySelectorAll(`[data-type="tool"]`).forEach( t => {
		if ( t.tool && t.tool.name === tool.name ) {
			t.dataset.locked = status;
		}
	});
}

var toolStatuses = {};

function makeMaskCanvas(url, color) { // depreciated

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

const toolSelector = '[data-type="tool"]:not([data-nocolorinvert]), .tile[data-type="more"], .tile[data-type="less"]';

function getBrightness(el) {

	let rgbCSS = window.getComputedStyle(el, null).getPropertyValue('background-color');

	let sep = rgbCSS.indexOf(",") > -1 ? "," : " ";
  rgb = rgbCSS.substr(4).split(")")[0].split(sep);

 	return Math.round(((parseInt(rgb[0]) * 299) +
                      (parseInt(rgb[1]) * 587) +
                      (parseInt(rgb[2]) * 114)) / 1000);
}
