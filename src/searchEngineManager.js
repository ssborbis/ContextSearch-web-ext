function buildSearchEngineContainer() {
	
	let table = document.createElement('div');
	table.style.textAlign = 'left';
	table.style.width = '100%';
	table.style.height = 'inherit';
	table.style.display = 'inline-block';
	table.style.verticalAlign = 'top';
	table.style.overflowY = 'scroll';
	
	let selectedRows = [];

	function traverse(node, parent) {	
	
		if ( !node ) {
			console.log('null node found');
			return;
		}
		
		let li = document.createElement('li');
		parent.appendChild(li);
		li.node = node;
		li.dataset.nodeid = node.id;
		
		li.className = 'treeNode';
		
		if (node.hidden) li.classList.add('hidden');

		li.addEventListener('contextmenu', contextMenuHandler);

		li.setAttribute('draggable', true);
		li.addEventListener('dragstart',dragstart_handler);
		li.addEventListener('dragend',dragend_handler);
		li.addEventListener('drop',drop_handler);
		li.addEventListener('dragover',dragover_handler);
		li.addEventListener('dragleave',dragleave_handler);

		if (node.type === 'searchEngine') {
			
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			
			if (se === undefined) {
				console.log('engine not found for ' + node.title + '(' + (node.id) + ')');
				li.parentNode.removeChild(li);
				return;
			}

			let icon = document.createElement('img');
			icon.src = se.icon_base64String || se.icon_url || browser.runtime.getURL('icons/search.svg');
			li.appendChild(icon);
			
			let text = document.createElement('span');
			text.className = "label";
			text.innerText = se.title;
			li.appendChild(text);

			let edit_form = document.getElementById('editSearchEngineContainer');
			edit_form.style.maxHeight = null;
			document.body.appendChild(edit_form);
			
			// prevent click events from closing the form
			edit_form.onclick = function(e) {
				e.stopPropagation();
			}
			
			li.addEventListener('dblclick', (e) => {

				e.stopPropagation();
				
				if (document.getElementById('editSearchEngineContainer').contains(e.target) ) return false;

				let se = userOptions.searchEngines.find( se => se.id === node.id );
				
				// close if open on same TR
				if (edit_form.parentNode === li && edit_form.style.maxHeight) {
					edit_form.style.maxHeight = null;
					return;
				}
				
				function clearError( element ) {
					if ( 
						element 
						&& element.classList 
						&& element.classList.contains('error') 
					)
						element.classList.remove('error');
				}
				
				// clear error formatting
				for (let label of edit_form.getElementsByTagName('label')) {
					if (label.dataset.i18n) label.innerText = browser.i18n.getMessage(label.dataset.i18n);
					label.style.color = null;
					clearError(label.nextSibling)
				}

				edit_form.shortName.value = se.title;
				edit_form.description.value = se.description || "";
				edit_form.template.value = se.query_string;
				edit_form.iconURL.value = se.icon_url || se.icon_base64String;
				edit_form._method.value = se.method || "GET";
				edit_form.post_params.value = (se.method === 'GET') ? "" : nameValueArrayToParamString(se.params);
				edit_form._encoding.value = se.queryCharset || "UTF-8";
				edit_form.searchform.value = se.searchForm || function() {
					try {
						return new URL(se.query_string).origin;
					} catch (err) {
						return "";
					}
				}();
				edit_form.searchRegex.value = se.searchRegex || "";
				
				edit_form.addEventListener('mouseover', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', false);
				});
				
				edit_form.addEventListener('mouseout', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', true);
				});
				
				edit_form.cancel.onclick = function() {
					edit_form.style.maxHeight = null;
				}
				
				edit_form.copy.onclick = function() {
					addNewEngine(node, true);
				}
				
				edit_form.addOpenSearchEngine.onclick = function() {

					let url = "https://opensearch-api.appspot.com" 
						+ "?SHORTNAME=" + encodeURIComponent(edit_form.shortName.value)
						+ "&DESCRIPTION=" + encodeURIComponent(edit_form.description.value) 
						+ "&TEMPLATE=" + encodeURIComponent(encodeURI(edit_form.template.value))
						+ "&POST_PARAMS=" + encodeURIComponent(edit_form.post_params.value) 
						+ "&METHOD=" + encodeURIComponent(edit_form._method.value)
						+ "&ENCODING=" + encodeURIComponent(edit_form._encoding.value)
						+ "&ICON=" + encodeURIComponent(encodeURI(edit_form.iconURL.value))
						+ "&ICON_WIDTH=" + ( icon.naturalWidth || 16 )
						+ "&ICON_HEIGHT=" + ( icon.naturalHeight || 16 )
						+ "&SEARCHFORM=" + encodeURIComponent(encodeURI(edit_form.searchform.value))
						+ "&VERSION=" + encodeURIComponent(browser.runtime.getManifest().version);
					
					browser.runtime.sendMessage({action: "addSearchEngine", url:url});
				}
				
				edit_form.save.onclick = function() {

					function showError(el, msg) {
						el.previousSibling.innerText = msg;
						el.previousSibling.style.color = "red";
						el.classList.add("error");
					}
					
					function saveForm(closeForm) {
						
						closeForm = ( closeForm === undefined ) ? true : false;
						// loading icon is last step. Set values after everything else
							
						// alert of problems with changing name
						if (se.title !== edit_form.shortName.value) {

							if ( !browser.runtime.getBrowserInfo || confirm(browser.i18n.getMessage('NameChangeWarning')) ) {

								se.title = li.node.title = node.title = edit_form.shortName.value;
								
								// change name on all labels
								[].forEach.call( table.getElementsByTagName('li'), _li => {
									if ( _li.node.id === node.id )
										_li.querySelector('.label').innerText = _li.node.title = se.title;

								});

								updateNodeList();
							}
						}

						se.icon_base64String = icon.src;
						se.description = edit_form.description.value;
						se.query_string = se.template = edit_form.template.value;
						se.searchForm = edit_form.searchform.value;
						se.icon_url = edit_form.iconURL.value;
						se.method = edit_form._method.value;
						se.queryCharset = edit_form._encoding.value;
						se.params = paramStringToNameValueArray(edit_form.post_params.value);
						se.id = se.id || gen();
						se.searchRegex = edit_form.searchRegex.value;
						
						updateNodeList();
						
						if (closeForm)
							edit_form.style.maxHeight = null;
					}

					// Check bad form values
					if ( !edit_form.shortName.value.trim() ) {
						showError(edit_form.shortName,browser.i18n.getMessage('NameInvalid'));
						return;
					}
					if (edit_form.shortName.value != li.node.title) {
						
						if (userOptions.searchEngines.find( _se => _se.title == edit_form.shortName.value) ) {
							showError(edit_form.shortName,browser.i18n.getMessage('NameExists'));
							return;
						}
					}
					if (edit_form.template.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'GET' ) {
						showError(edit_form.template,browser.i18n.getMessage("TemplateIncludeError"));
						return;
					}
					if (edit_form.template.value.match(/^http/i) === null) {
						showError(edit_form.template,browser.i18n.getMessage("TemplateURLError"));
						return;
					}
					if (edit_form.searchform.value.match(/^http/i) === null) {
						let url = new URL(edit_form.template.value);
						edit_form.searchform.value = url.origin;
						//showError(edit_form.searchform,browser.i18n.getMessage("FormPathURLError"));
					//	return;
					}
					if (edit_form.post_params.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'POST' ) {
						showError(edit_form.post_params, browser.i18n.getMessage("POSTIncludeError"));
						return;
					}
					if (edit_form.searchRegex.value) {
						try {
							let parts = JSON.parse('[' + edit_form.searchRegex.value + ']');
							let rgx = new RegExp(parts[0], 'g');
						} catch (error) {
							showError(edit_form.searchRegex, browser.i18n.getMessage("InvalidRegex") || "Invalid Regex");
							return;
						}
					}
					if ( !edit_form.iconURL.value.startsWith("resource:") ) {
						
						if ( !edit_form.iconURL.value ) {
							let url = new URL(edit_form.template.value);
							edit_form.iconURL.value = url.origin + "/favicon.ico";
						}
						
						icon.src = browser.runtime.getURL("/icons/spinner.svg");
						let newIcon = new Image();
						newIcon.onload = function() {
							icon.src = imageToBase64(this, 32) || tempImgToBase64(se.title.charAt(0).toUpperCase());
							saveForm();
						}
						newIcon.onerror = function() {	
							showError(edit_form.iconURL,browser.i18n.getMessage("IconLoadError"));
							icon.src = se.icon_base64String || tempImgToBase64(se.title.charAt(0).toUpperCase());
							saveForm(false);
						}
						
						newIcon.src = edit_form.iconURL.value;
						
						setTimeout(() => {
							if (!newIcon.complete)
								newIcon.onerror();
						}, 5000);
					} else {
						saveForm();
					}
				}
				
				// clear error formatting on focus
				for (let element of edit_form.getElementsByTagName('input')) {
					element.addEventListener('focus', () => {
						clearError( element );
					});
				}

				// attach form to title cell
				li.appendChild(edit_form);
				
				// reflow trick
				edit_form.getBoundingClientRect();
				edit_form.style.maxHeight = '400px';
			});

		}
		
		if (node.type === 'bookmarklet') {
			
			let img = document.createElement('img');
			img.src = browser.runtime.getURL('icons/code.svg');
			li.appendChild(img);
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			li.appendChild(text);
		}
		
		if (node.type === 'separator') {

			let text = document.createElement('span');
			let div = document.createElement('div');
			div.style = 'display:inline-block;width:200px;height:4px;background-color:#aaa';
			text.appendChild(div);
			text.className = "label";
			li.appendChild(text);
		}
		
		if (node.type === 'oneClickSearchEngine') {

			let img = document.createElement('img');
			img.src = node.icon;
			li.appendChild(img);

			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			li.appendChild(text);
			
			// indicate as a firefox one-click
			let ff = document.createElement('span');
			ff.innerText = "FF";
			ff.style = 'background-color:rgb(234, 172, 92);color:white;border-radius:4px;font-size:7pt;font-weight:bold;margin-left:5px;padding:1px 5px;vertical-align:middle';
			ff.title = 'Firefox One-Click Search Engine';

			li.appendChild(ff);
		}
		
		if (node.type === 'folder') {
			
			let img = document.createElement('img');
			img.src = browser.runtime.getURL('/icons/folder-icon.png');
			li.appendChild(img);
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			li.appendChild(text);

			let ul = document.createElement('ul');
			li.appendChild(ul);
			
			for (let _node of node.children)
				traverse(_node, ul);
			
			li.addEventListener('dblclick', (e) => {
				
				e.stopPropagation();

				// the label
				let input = document.createElement('input');
				input.value = node.title;
				input.setAttribute('draggable', false);
				
				// prevent dragging
				input.addEventListener('mousedown', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', false);
				});
				
				input.addEventListener('mouseup', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', true);
				});
				
				input.addEventListener('keypress', (ev) => {
					if (ev.keyCode === 13)
						saveTitleChange(ev);
				});
				
				input.addEventListener('keydown', (e) => {
					if (e.keyCode === 27) {
						text.removeChild(input);
						text.innerText = node.title;
					}
				});
				
				document.addEventListener('click', saveTitleChange, false);

				text.innerHTML = null;
				text.appendChild(input);
				input.select();
				
				function saveTitleChange(e) {

					if ( text.contains(e.target) && e.type !== 'keypress') return false;

					let newTitle = input.value;
					text.removeChild(input);
					text.innerText = newTitle;
					
					node.title = newTitle;
					
					updateNodeList();
					document.removeEventListener('click', saveTitleChange);
				}

			});
		}
		
		// add hotkeys for some node types
		if ( ['searchEngine', 'oneClickSearchEngine', 'bookmarklet'].includes(node.type) ) {
			
			let hotkey = document.createElement('span');
			hotkey.title = browser.i18n.getMessage('Hotkey');
			hotkey.className = 'hotkey';
			hotkey.style.right = "0px";

			li.appendChild(hotkey);
			hotkey.innerText = keyTable[node.hotkey] || "";
			
			hotkey.onclick = function(e) {
				e.stopPropagation();			
				e.target.innerText = '';
				let img = document.createElement('img');
				img.src = 'icons/spinner.svg';
				img.style.height = '1em';
				img.style.verticalAlign = 'middle';
				e.target.appendChild(img);
				window.addEventListener('keydown', function keyPressListener(evv) {
					evv.preventDefault();
					
					if ( /* invalid keys */ [9,37,38,39,40].includes(evv.which) ) return;

					if (evv.which === 27) {
						node.hotkey = null;
						
						// set hotkey for all copies
						for (let _hk of rootElement.querySelectorAll('li')) {
							if (_hk.node.id === node.id)
								_hk.querySelector('.hotkey').innerText = "";
						}
	
						window.removeEventListener('keydown', keyPressListener);
						updateNodeList();
						return;
					}
					
					node.hotkey = evv.which;

					if ( findNodes(rootElement.node, _node => _node.hotkey === evv.which && _node.id !== node.id).length ) {						
						hotkey.style.backgroundColor = 'pink';
						setTimeout( () => {
							hotkey.style.backgroundColor = null;
						},250);
						return;
					}

					// set hotkey for all copies
					for (let _hk of rootElement.querySelectorAll('li')) {
						if (_hk.node.id === node.id)
							_hk.querySelector('.hotkey').innerText = keyTable[evv.which];
					}
					
					findNodes(rootElement.node, _node => {
						if ( _node.type === node.type && _node.id === node.id )
							_node.hotkey = node.hotkey;
					});

					window.removeEventListener('keydown', keyPressListener);
					updateNodeList();
				}); 
				
			}
		}
		
		document.addEventListener('click', (e) => {
			if ( e.target.classList.contains('label') ) return;
			
			table.querySelectorAll('.selected').forEach( _span => {
				_span.classList.remove('selected');
			});
			selectedRows = [];
		});
		
		li.querySelector('.label').addEventListener('click', (e) => {
			console.log(node);
			closeContextMenus();
			e.stopPropagation();

			if (!selectedRows.length) {
				li.querySelector('SPAN:first-of-type').classList.add('selected');
				selectedRows.push(li);
				return;
			}
			
			if (selectedRows.length && !e.shiftKey) {
				table.querySelectorAll('.selected').forEach( _span => {
					_span.classList.remove('selected');
				});
				selectedRows = [];
				
				li.querySelector('SPAN:first-of-type').classList.add('selected');
				selectedRows.push(li);
				return;
			}
			
			if (selectedRows.length && e.shiftKey) {
				let startNode = selectedRows[0].node;
				let endNode = li.node;
				
				if (startNode.parent !== endNode.parent) return;
				
				let startIndex = startNode.parent.children.indexOf(startNode);
				let endIndex = endNode.parent.children.indexOf(endNode);
				
				let slicedNodes = startNode.parent.children.slice(startIndex, endIndex + 1);
				
				let lis = [...table.querySelectorAll('li')];
				let start = lis.indexOf(selectedRows[0]);
				let end = lis.indexOf(li);
				
				liStartIndex = Math.min(start, end);
				liEndIndex = Math.max(start, end);
				
				for (let i=liStartIndex;i<liEndIndex + 1;i++) {
					lis[i].querySelector('SPAN:first-of-type').classList.add('selected');
					selectedRows.push(lis[i]);
				}

				console.log(liStartIndex + ' - ' + liEndIndex);
				
				console.log(slicedNodes);
			}
			
		});
		
		return li;
	}
		
	// high-scope veriable to access node tree
	let rootElement = document.createElement('ul');
	rootElement.style.position = 'relative';

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

	setParents(root);

	// clear any dead nodes
	repairNodeTree(root).then(() => {

		rootElement.node = root;
		
		for (let child of root.children)
			traverse(child, rootElement);
		
		table.appendChild(rootElement);
		
		console.log(root);
		updateNodeList();
		
		document.getElementById('managerContainer').innerHTML = null;
		document.getElementById('managerContainer').appendChild(table);
	});

	function dragover_position(el, ev) {
		let rect = el.getBoundingClientRect();

		let rowHeight = 19;
		let position = 'bottom';

		if ( ev.pageY - rect.y < rowHeight / 2 ) position = 'top';

		if ( el.node.type === 'folder' && ( ev.pageY - rect.y > rowHeight / 3 ) && ( ev.pageY - rect.y < rowHeight / ( 3 / 2 ) ) )
			position = 'middle';
		
		return position;
	}
	
	function dragstart_handler(ev) {
		ev.dataTransfer.setData("text", "");
		window.dragRow = nearestParent('LI', ev.target);
		ev.effectAllowed = "copyMove";		
	}
	
	function dragover_handler(ev) {
		let overNode = nearestParent('LI', ev.target);
		
		if (window.dragRow.contains(overNode) ) {
			window.dragRow.style.backgroundColor = "pink";
			window.dragRow.style.opacity = .5;
			return;
		}
		
		let position = dragover_position(overNode, ev);
		
		if ( overNode.node.type === 'folder' && overNode.node.children.length && position === 'bottom' )
			position = 'middle';
		
		overNode.style = null;
		overNode.querySelector('.label').style = null;

		if ( position === 'top' ) {
			overNode.style.borderTop = '2px solid #008afc';
		} else if ( position === 'bottom' ) {
			overNode.style.borderBottom = '2px solid #008afc';
		} else {
			overNode.querySelector('img').style.filter = 'hue-rotate(180deg)';
		}

		ev.preventDefault();
	}
	function dragleave_handler(ev) {
		window.dragRow.style = null;
		let overNode = nearestParent('LI', ev.target);
		overNode.style=null;
		
		// clear folder styling
		try {
		//	overNode.querySelector("ul").firstChild.style = null;
			overNode.querySelector('img').style.filter = null;
		} catch (error) {}
	}
	function drop_handler(ev) {
		
		ev.preventDefault();

		let dragNode = window.dragRow.node;
		let targetElement = nearestParent('LI', ev.target);
		let targetNode = targetElement.node;
		
		// clear drag styling
		targetElement.style = null;
		window.dragRow.style = null;
		window.dragRow.querySelector('.label').style = null;
		
		// clear folder styling
		try {
		//	targetElement.querySelector("ul").firstChild.style = null;
			targetElement.querySelector('img').style.filter = null;
		} catch (error) {}
		
//		console.log(dragNode.parent.children.indexOf(dragNode));

		// cut the node from the children array
		let slicedNode = dragNode.parent.children.splice(dragNode.parent.children.indexOf(dragNode), 1).shift();

		let position = dragover_position(targetElement, ev);
		
		// if target is bottom of populated folder, proceed as if drop on folder
		if ( targetElement.node.type === 'folder' && targetElement.node.children.length && position === 'bottom' )
			position = 'middle';

		if ( position === 'top' ) {
			
			// set new parent
			slicedNode.parent = targetNode.parent;

			// add to children above target
			targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode),0,slicedNode);

			// insert into DOM
			targetElement.parentNode.insertBefore(window.dragRow, targetElement);
			
		} else if ( position === 'bottom' ) {

			// set new parent
			slicedNode.parent = targetNode.parent;

			// add to children above target
			targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode) + 1, 0, slicedNode);

			// insert into DOM
			targetElement.parentNode.insertBefore(window.dragRow, targetElement.nextSibling);
				
		} else if ( position === 'middle' ) { // drop into folder
				
			// set new parent
			slicedNode.parent = targetNode;

			// add to children above target
			targetNode.children.unshift(slicedNode);

			// append element to children (ul)
			let ul = targetElement.querySelector('ul');			
			ul.insertBefore(window.dragRow, ul.firstChild);
		}
	}
	
	function dragend_handler(ev) {
		updateNodeList();
	}
	
	function nearestParent( tagName, target ) {
		while ( target && target.nodeName.toUpperCase() !== tagName.toUpperCase() ) {
			target = target.parentNode;
		}
		
		return target;
	}
	
	function updateNodeList() {
		userOptions.nodeTree = JSON.parse(JSON.stringify(rootElement.node));
		saveOptions();
	}
	
	function contextMenuHandler(e) {
		
		if (document.getElementById('editSearchEngineContainer').contains(e.target) ) return false;
		e.preventDefault();
		
		let li = nearestParent('LI', e.target);
		
		closeContextMenus();

		let menu = document.createElement('div');
		menu.id = "contextMenu";
		menu.className = "contextMenu";
		
		function createMenuItem(name, icon) {
			let menuItem = document.createElement('div');

			let img = document.createElement('img');
			img.src = icon;
			
			menuItem.appendChild(img);
			
			let span = document.createElement('span');
			span.innerText = name;
			
			menuItem.appendChild(span);
			
			return menuItem;
		}

		let _delete = createMenuItem(browser.i18n.getMessage('Delete'), browser.runtime.getURL('icons/crossmark.svg'));

		_delete.onclick = function(e) {
			closeSubMenus();
			e.stopImmediatePropagation();
			e.preventDefault();
			

			// move the edit form if open on node
			let editForm = document.getElementById('editSearchEngineContainer');
			if ( li.contains(editForm) ) {
				editForm.style.maxHeight = '0px';
				document.body.appendChild(editForm);	
			}

			let engines = findNodes(li.node, node => node.type === "searchEngine");
			let engineCount = engines.length;
			
			if ( li.node.type === 'folder' && engineCount ) {
				let _menu = document.createElement('div');

				_menu.className = 'contextMenu subMenu';
				
				// position to the right of opening div
				let rect = _delete.getBoundingClientRect();
				_menu.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
				_menu.style.top = rect.y + window.scrollY + "px";

				// add menu items
				let item1 = document.createElement('div');
				item1.className = 'menuItem';
				item1.innerText = browser.i18n.getMessage('RemoveNode');
				
				item1.addEventListener('click', (_e) => {
					
					// append orphaned search engines
					engines.forEach( engine => {
						if ( findNodes( root, _node => _node.id === engine.id ).length === 1 ) {
							let orphanedNode = Object.assign({}, engine);
							orphanedNode.hidden = true;
							orphanedNode.parent = root;
							root.children.push(orphanedNode);
							traverse(orphanedNode, rootElement);
						}
					});

					removeNode(li.node, li.node.parent);

					li.parentNode.removeChild(li);
					
					updateNodeList();
					closeContextMenus();
				});
				
				let item2 = document.createElement('div');
				item2.className = 'menuItem';
				item2.innerText = browser.i18n.getMessage('DeleteEngines', engineCount);//"Delete " + engineCount + " engines";
				
				item2.addEventListener('click', (_e) => {
					removeNode(li.node, li.node.parent);
					li.parentNode.removeChild(li);
					
					engines.forEach( engine => {
						// remove search engines
						let index = userOptions.searchEngines.findIndex( se => se.id === engine.id);					
						if (index !== -1) userOptions.searchEngines.splice(index, 1);
						
						// remove other nodes using engine
						removeNodesById(rootElement.node, engine.id);
						for (let _li of rootElement.querySelectorAll('li[data-nodeid="' + engine.id + '"]'))
							_li.parentNode.removeChild(_li);
					
					});
					
					updateNodeList();
					closeContextMenus();
				});
				
				[item1, item2].forEach( el => { _menu.appendChild(el) });
	
				document.body.appendChild(_menu);
				openMenu(_menu);
				

			} else if ( li.node.type === 'searchEngine' ) {
				
				let duplicateNodes = findNodes( root, _node => _node.id === li.node.id );
				
				// only one engine, delete
				if ( duplicateNodes.length === 1 ) {
					
					let _menu = document.createElement('div');

					_menu.className = 'contextMenu subMenu';
					
					// position to the right of opening div
					let rect = _delete.getBoundingClientRect();
					_menu.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
					_menu.style.top = rect.y + window.scrollY + "px";

					// add menu items
					let item1 = document.createElement('div');
					item1.className = 'menuItem';
					item1.innerText = browser.i18n.getMessage('Confirm');
					
					item1.addEventListener('click', (_e) => {
						
						let index = userOptions.searchEngines.findIndex( se => se.id === li.node.id);					
						if (index !== -1) userOptions.searchEngines.splice(index, 1);
						
						removeNode(li.node, li.node.parent);
						li.parentNode.removeChild(li);

						updateNodeList();
						closeContextMenus();
					});
					
					[item1].forEach( el => { _menu.appendChild(el) });
	
					document.body.appendChild(_menu);
					openMenu(_menu);
					
				} else {
				
					removeNode(li.node, li.node.parent);
					li.parentNode.removeChild(li);
					
					updateNodeList();
					closeContextMenus();
				}


			} else {
				removeNode(li.node, li.node.parent);
				li.parentNode.removeChild(li);
				
				updateNodeList();
				closeContextMenus();
			}

		}
		
		if ( li.node.type === 'oneClickSearchEngine') {
			let copies = findNodes(rootElement.node, node => node.type === 'oneClickSearchEngine' && node.id === li.node.id && node !== li.node );

			if ( copies.length === 0 ) {
				_delete.style.display = 'none';
			}
		}

		let edit = createMenuItem(browser.i18n.getMessage('Edit'), browser.runtime.getURL('icons/edit.png'));
		edit.addEventListener('click', (e) => {
			e.stopPropagation();

			if ( li.node.type === 'searchEngine')
				li.dispatchEvent(new MouseEvent('dblclick'));
			if (li.node.type === 'folder')
				li.dispatchEvent(new MouseEvent('dblclick'));
			if (li.node.type === 'oneClickSearchEngine') {
				// closeContextMenus();
				
				// e.preventDefault();
				// e.stopImmediatePropagation();
				
				// let menu = document.createElement('div');
				// menu.className = "contextMenu";
				// menu.style.left = e.pageX + "px";
				// menu.style.top = e.pageY + "px";	
				// menu.style.padding = '10px';
				// menu.innerText = browser.i18n.getMessage('CannotEditOneClickEngines') || "Firefox One-Click engines must be imported before making changes";
				// document.body.appendChild(menu);

				// openMenu(menu);
				
				// return false;
			}
			
			closeContextMenus();
		});
		
		let hide = createMenuItem(li.node.hidden ? browser.i18n.getMessage('Show') : browser.i18n.getMessage('Hide'), browser.runtime.getURL('icons/hide.png'));
		hide.addEventListener('click', () => {
			li.node.hidden = !li.node.hidden;
			
			if (li.node.hidden) li.classList.add('hidden');
			else li.classList.remove('hidden');
		//	li.style.opacity = li.node.hidden ? .5 : 1;
			updateNodeList();
			closeContextMenus();
		});
		
		let newFolder = createMenuItem(browser.i18n.getMessage('NewFolder'), browser.runtime.getURL('icons/folder4.png'));		
		newFolder.addEventListener('click', () => {
			let newFolder = {
				type: "folder",
				parent: li.node.parent,
				children: [],
				title: browser.i18n.getMessage('NewFolder'),
				toJSON: li.node.toJSON
			}
			
			li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newFolder);
			
			let newLi = traverse(newFolder, li.parentNode);
			li.parentNode.insertBefore(newLi, li);
			
			// required delay to work
			setTimeout(() => {
				newLi.dispatchEvent(new MouseEvent('dblclick'));
			}, 100);
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newBookmarklet = createMenuItem(browser.i18n.getMessage('AddBookmarklet'), browser.runtime.getURL('icons/code.svg'));		
		newBookmarklet.addEventListener('click', (e) => {
			closeSubMenus();
			e.stopImmediatePropagation();
			e.preventDefault();

			if (!browser.bookmarks) {
				CSBookmarks.requestPermissions();
				return;
			}
			
			let bmContainer = document.createElement('div');

			bmContainer.className = 'contextMenu subMenu';
			
			let rect = newBookmarklet.getBoundingClientRect();

			bmContainer.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
			bmContainer.style.top = rect.y + window.scrollY + "px";
			
			let item1 = document.createElement('div');
			item1.className = 'menuItem';
			
			let _img = new Image(20);
			_img.src = browser.runtime.getURL('icons/spinner.svg');
			item1.appendChild(_img);
			bmContainer.appendChild(item1);
			
			document.body.appendChild(bmContainer);
			openMenu(bmContainer);

			CSBookmarks.getAllBookmarklets().then((results) => {

				if (results.length === 0) {
					item1.innerHTML = "<i>none found</i>";
					item1.addEventListener('click', () => {
						closeContextMenus();
					});
					return;
				}
				
				bmContainer.removeChild(item1);
				
				for (let bm of results) {
					let bmDiv = document.createElement('div');
					bmDiv.className = 'menuItem';
					bmDiv.innerText = bm.title;
					
					bmDiv.addEventListener('click', (e) => {
						
						let newBm = {
							type: "bookmarklet",
							id: bm.id,
							title: bm.title,
							parent: li.node.parent,
							toJSON: li.node.toJSON
						}
						
						li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newBm);
				
						let newLi = traverse(newBm, li.parentNode);
						li.parentNode.insertBefore(newLi, li);
				
						updateNodeList();
						
						closeContextMenus();

					});
					
					bmContainer.appendChild(bmDiv);

				}
				
				bmContainer.style.maxWidth = '200px';
				bmContainer.style.maxHeight = '400px';
				bmContainer.style.overflowY = 'auto';

			});

		});
		
		let copy = createMenuItem(browser.i18n.getMessage('Copy'), browser.runtime.getURL('icons/clipboard.png'));	
		copy.addEventListener('click', (e) => {
			
			let newNode;
			if (li.node.type === 'searchEngine') {

				closeSubMenus();
				e.stopImmediatePropagation();
				e.preventDefault();
				
				let _menu = document.createElement('div');
				_menu.className = 'contextMenu subMenu';
		
				let rect = copy.getBoundingClientRect();
				
				_menu.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
				_menu.style.top = rect.y + window.scrollY + "px";
				
				// add menu items
				let item1 = document.createElement('div');
				item1.className = 'menuItem';
				item1.innerText = browser.i18n.getMessage('AsShortcut');
				
				item1.addEventListener('click', (_e) => {
					let _newNode = Object.assign({}, li.node);
					li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, _newNode);
			
					let newLi = traverse(_newNode, li.parentNode);
					li.parentNode.insertBefore(newLi, li);
					
					closeContextMenus();
				});
				
				let item2 = document.createElement('div');
				item2.className = 'menuItem';
				item2.innerText = browser.i18n.getMessage('AsNewEngine');
				
				item2.addEventListener('click', (_e) => {
					let _newNode = addNewEngine(li.node, true);
					
					if ( _newNode ) {
						li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, _newNode);
				
						let newLi = traverse(_newNode, li.parentNode);
						li.parentNode.insertBefore(newLi, li);
					}
					
					closeContextMenus();
				});
				
				[item1, item2].forEach( item => {
					_menu.appendChild(item);
				});
				
				document.body.appendChild(_menu);
				openMenu(_menu);
				return;

			} else {
				newNode = Object.assign({}, li.node);
			}
			
			if (!newNode) return;
			
			li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newNode);
			
			let newLi = traverse(newNode, li.parentNode);
			li.parentNode.insertBefore(newLi, li);
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newEngine = createMenuItem(browser.i18n.getMessage('NewEngine'), browser.runtime.getURL('icons/new.png'));	
		newEngine.addEventListener('click', () => {
			
			let newNode = addNewEngine(li.node, false);
			
			if (newNode) {
			
				li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newNode);
				
				let newLi = traverse(newNode, li.parentNode);

				li.parentNode.insertBefore(newLi, li);
				
				updateNodeList();
				
				newLi.dispatchEvent(new MouseEvent('dblclick'));
			}
			
			closeContextMenus();
		});
		
		let newSeparator = createMenuItem(browser.i18n.getMessage('NewSeparator'), browser.runtime.getURL('icons/separator.png'));	
		newSeparator.addEventListener('click', () => {
			let newNode = {
				type: "separator",
				parent: li.node.parent,
				toJSON: li.node.toJSON
			}
			
			li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newNode);
			
			let newLi = traverse(newNode, li.parentNode);
			li.parentNode.insertBefore(newLi, li);
			
			updateNodeList();
		});

		[edit, hide, newFolder, newEngine, newSeparator, newBookmarklet, copy, _delete].forEach((el) => {
			el.className = 'menuItem';
			menu.appendChild(el);
			el.addEventListener('click', () => {
				closeContextMenus();
			});
		});

		menu.style.left = e.pageX + "px";
		menu.style.top = e.pageY + "px";

		document.body.appendChild(menu);
		
		openMenu(menu);

		function openMenu(el) {
			let rect = el.getBoundingClientRect();

			el.style.maxHeight = el.style.maxWidth = '0';
			el.style.transition = 'all .15s ease-in-out';
		
			el.getBoundingClientRect();
		
			el.style.opacity = 1;
			el.style.maxWidth = rect.width + "px";
			el.style.maxHeight = rect.height + "px";
		}

		// menu close listener
		document.addEventListener('click', function contextMenuClose(e) {
			
			let menus = document.querySelectorAll('.contextMenu');

			for (let m of menus) {
				if (!m || !m.parentNode || m.contains(e.target)) continue;	
				m.parentNode.removeChild(m);
			}
			document.removeEventListener('click', contextMenuClose);
		});
	}
	
	function closeContextMenus() {
		for (let m of document.querySelectorAll('.contextMenu')) {
			if (m && m.parentNode) m.parentNode.removeChild(m);
		}
		
		closeSubMenus();
	}
	
	function closeSubMenus() {
		for (let m of document.querySelectorAll('.subMenu')) {
			if (m && m.parentNode) m.parentNode.removeChild(m);
		}
	}
	
	function addNewEngine(node, copy) {
		
		copy = copy || false;
		
		// if node is defined, make copy
		let se = (copy) ? Object.assign({},userOptions.searchEngines.find( _se => _se.id === node.id )) : false;
		let default_value = (copy) ? se.title + " copy" : "";
		
		let msg = browser.i18n.getMessage("EnterUniqueName");
		let shortName = "";

		while(true) {
			if (! (shortName = window.prompt(msg, default_value)) || !shortName.trim() ) return;

			let found = false;
			
			for (let engine of userOptions.searchEngines) {
				if (engine.title == shortName) {
					console.log(engine.title + "\t" + shortName);
					msg = browser.i18n.getMessage("EngineExists").replace("%1",engine.title) + " " + browser.i18n.getMessage("EnterUniqueName");
					found = true;
					break;
				}
			}
			
			if ( !found ) break;
		}
		
		if (se) {
			se.title = shortName;
			se.id = gen();
			userOptions.searchEngines.push(se);
		} else {
			se = {
				"searchForm": "", 
				"query_string":"",
				"icon_url":"",
				"title":shortName,
				"order":userOptions.searchEngines.length, 
				"icon_base64String": "", 
				"method": "GET", 
				"params": "", 
				"template": "", 
				"queryCharset": "UTF-8", 
				"hidden": false,
				"id": gen()
			}
			
			userOptions.searchEngines.push(se);
		}
		
		return {
			title: se.title,
			type: "searchEngine",
			parent: node.parent,
			hidden: false,
			id: se.id,
			toJSON: node.toJSON
		}
	}
	
	document.getElementById('b_addSearchEngine').addEventListener('click', (e) => {
		let newNode = addNewEngine(rootElement.node.children.slice(-1)[0]);
		if (newNode) {
			
			rootElement.node.children.push(newNode);
			
			let newLi = traverse(newNode, rootElement);

			updateNodeList();
			
			newLi.scrollIntoView();
			newLi.dispatchEvent(new MouseEvent('dblclick'));
		}
	});
	
	document.getElementById('b_resetAllSearchEngines').addEventListener('click', (e) => {
		
		if ( !confirm(browser.i18n.getMessage("ConfirmResetAllSearchEngines")) ) return;
		
		browser.runtime.getBackgroundPage().then( w => {
			userOptions.nodeTree.children = [];	
			
			// reset searchEngines to defaults
			userOptions.searchEngines = w.defaultEngines;
			
			// build nodes with default engines
			repairNodeTree(userOptions.nodeTree);
			
			// unhide all default engines
			findNodes( userOptions.nodeTree, node => node.hidden = false );

			// updated the background page UO
			w.userOptions = userOptions;
			
			// add OCSE to the nodeTree
			w.checkForOneClickEngines().then( () => {
				
				// updated the local UO
				userOptions = w.userOptions;
				saveOptions().then( () => {
					location.href = "options.html?tab=enginesTab";
				});
			});
		});
		
		
		
	});
}
