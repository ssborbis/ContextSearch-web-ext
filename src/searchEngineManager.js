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
		
		let header = document.createElement('div');
		header.className = "header";
		
		// show id in the console
		li.addEventListener('click', e => {
			e.stopPropagation();
			console.log(node.id);
		});
		
		li.appendChild(header);

		if (node.type === 'searchEngine') {
			
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			
			if (se === undefined) {
				console.log('engine not found for ' + node.title + '(' + (node.id) + ')');
				li.parentNode.removeChild(li);
				return;
			}

			let icon = document.createElement('img');
			icon.src = se.icon_base64String || se.icon_url || browser.runtime.getURL('icons/search.svg');
			header.appendChild(icon);
			
			let text = document.createElement('span');
			text.className = "label";
			text.innerText = se.title;
			header.appendChild(text);

			let edit_form = document.getElementById('editSearchEngineContainer');
			edit_form.style.maxHeight = null;
			document.body.appendChild(edit_form);
			
			// prevent click events from closing the form
			edit_form.onclick = function(e) {
				e.stopPropagation();
			}
			
			li.addEventListener('dblclick', e => {

				e.stopPropagation();
				
				if (document.getElementById('editSearchEngineContainer').contains(e.target) ) return false;

				let se = userOptions.searchEngines.find( se => se.id === node.id );

				// close if open on same TR
				if (edit_form.parentNode === li && edit_form.style.maxHeight) {
					
					// resize TEXTAREA fix
					if ( edit_form.style.maxHeight === "none" ) {
						edit_form.style.maxHeight = edit_form.scrollHeight + "px";
						edit_form.getBoundingClientRect();
					}
					
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
				
				function showError(el, msg) {
					
					if ( !el.previousSibling || !el.previousSibling.dataset ) return;
						
					if ( !el.previousSibling.dataset.oldmsg ) {
						el.previousSibling.dataset.oldmsg = el.previousSibling.innerText;
					}
					
					el.previousSibling.innerText = msg;
					el.previousSibling.style.color = "red";
					el.classList.add("error");
				}
				
				// Check bad form values
				function checkFormValues() {
	
					[edit_form.template, edit_form.post_params].forEach( el => {
						el.value = el.value.replace(/{searchterms}/i, "{searchTerms}");
					});
					
					return new Promise( (resolve, reject) => {
					
						if ( !edit_form.shortName.value.trim() ) {
							showError(edit_form.shortName,browser.i18n.getMessage('NameInvalid'));
							resolve(false);
						}
						if (edit_form.shortName.value != li.node.title) {
							
							if (userOptions.searchEngines.find( _se => _se.title == edit_form.shortName.value) ) {
								showError(edit_form.shortName,browser.i18n.getMessage('NameExists'));
								resolve(false);
							}
						}
						// if (edit_form.template.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'GET' && edit_form.searchCode.value.trim() === "") {
							// showError(edit_form.template,browser.i18n.getMessage("TemplateIncludeError"));
						// }
						try {
							let _url = new URL(edit_form.template.value);
						} catch (error) {
							showError(edit_form.template,browser.i18n.getMessage("TemplateURLError"));
						}
						try {
							let _url = new URL(edit_form.searchform.value);
						} catch (error) {
							try {
								let _url = new URL(edit_form.template.value);
								edit_form.searchform.value = _url.origin;
							} catch (_error) {}
						}
						//	showError(edit_form.template,browser.i18n.getMessage("TemplateURLError"));
						//	return;

						// if (edit_form.post_params.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'POST' ) {
							// showError(edit_form.post_params, browser.i18n.getMessage("POSTIncludeError"));
						// }
						if (edit_form.searchRegex.value) {
							try {
								let lines = edit_form.searchRegex.value.split(/\n/);
								lines.forEach( (line, index) => {
							
									let parts = JSON.parse('[' + line.trim() + ']');
									let rgx = new RegExp(parts[0], parts[2] || 'g');
								});
							} catch (error) {
								showError(edit_form.searchRegex, browser.i18n.getMessage("InvalidRegex") || "Invalid Regex");
							}
						}
						
						if ( edit_form.iconURL.value.startsWith("resource:") ) {
							resolve(true);
						}

						icon.src = browser.runtime.getURL("/icons/spinner.svg");
						let newIcon = new Image();
						newIcon.onload = function() {
							icon.src = imageToBase64(this, 32) || createCustomIcon({text: se.title.charAt(0).toUpperCase()});
							resolve(true);
						}
						newIcon.onerror = function() {	
							showError(edit_form.iconURL,browser.i18n.getMessage("IconLoadError"));
							icon.src = se.icon_base64String || createCustomIcon({text: se.title.charAt(0).toUpperCase()});
							resolve(true);
						}
						
						if ( !edit_form.iconURL.value ) {
							try {
								let url = new URL(edit_form.template.value);
								newIcon.src = (!url.origin || url.origin == 'null' ) ? "" : url.origin + "/favicon.ico";
							} catch (error) {
								console.log(error);
							}
						} else if ( /^generate:/.test(edit_form.iconURL.value) ) {

							let url = new URL(edit_form.iconURL.value.replace(/#/g, "%23"));
	
							// https://stackoverflow.com/a/8649003
							let obj = JSON.parse('{"' + url.searchParams.toString().replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) });

							newIcon.src = createCustomIcon(obj);
						
						} else {
							newIcon.src = edit_form.iconURL.value;
						}
						
						// set a timeout for loading the image
						setTimeout(() => { if (!newIcon.complete) newIcon.onerror(); }, 5000);
					});

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
				edit_form.searchCode.value = se.searchCode || "";
				
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
				
				document.getElementById('iconrefresh').onclick = function() {
					icon.src = browser.runtime.getURL('icons/spinner.gif');
					
					if ( edit_form.iconURL.value )
						icon.src = edit_form.iconURL.value;
					else {
						let url = new URL(edit_form.template.value);
						icon.onerror = function() {
							icon.src = createCustomIcon({text: se.title.charAt(0).toUpperCase()});
							edit_form.iconURL.value = icon.src;
						}
						icon.src = (!url.origin || url.origin == 'null' ) ? "" : url.origin + "/favicon.ico";
						edit_form.iconURL.value = icon.src;
					}
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
					
					// clear error formatting
					for (let label of edit_form.getElementsByTagName('label')) {
						if (label.dataset.i18n) label.innerText = browser.i18n.getMessage(label.dataset.i18n);
						label.style.color = null;
						clearError(label.nextSibling)
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
						se.searchCode = edit_form.searchCode.value;
						
						updateNodeList();
						
						showSaveMessage(edit_form.querySelector('.error') ? 'saved with errors' : "saved", null, "yes", $("#editFormSaveMessage"));

						// if (closeForm)
							// edit_form.style.maxHeight = null;
					}
					
					checkFormValues().then( result => {
						if ( result ) saveForm();
						else showSaveMessage("cannot save", "red", "no", $("#editFormSaveMessage"));
					});
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
				// edit_form.style.maxHeight = '500px';
				edit_form.style.maxHeight = edit_form.scrollHeight + "px";
				
				// resize TEXTAREA fix
				// edit_form.querySelectorAll('textarea').forEach( ta => {
					// ta.addEventListener
				setTimeout(() => {
					if ( Math.abs(edit_form.offsetHeight - edit_form.scrollHeight) < 2 ) {
						edit_form.style.maxHeight = "none";
					}
				}, 2000);
				
				li.scrollIntoView({block: "start", behavior:"smooth"});
				
				checkFormValues();
			});

		}
		
		if (node.type === 'bookmarklet' || node.type === "bookmark") {
			
			let img = document.createElement('img');
			img.src = node.icon || browser.runtime.getURL('icons/code.svg');
			header.appendChild(img);
			
			li.addEventListener('dblclick', e => {
				//console.log('dblclick');
				editBm();
			});	
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			function editBm() {

				if ( li.querySelector(".editForm") ) {
					let _form = li.querySelector(".editForm");
					_form.closeForm();
					return;
				}
				
				let _form = document.createElement('form');
				_form.innerHTML = `<label data-i18n="Icon">${browser.i18n.getMessage("icon")}</label><input name="iconURL" type="text" class="inputNice" />
				<button type="button" name="close" class="inputNice _hover" style="float:right;margin:10px 5px" data-i18n="Close">${browser.i18n.getMessage("close")}</button>
				<button type="button" name="save" class="inputNice _hover" style="float:right;margin:10px 5px" data-i18n="Save">${browser.i18n.getMessage("save")}</button>`;
				_form.className = 'editForm';
				_form.action = "";
				
				_form.closeForm = function() {
					_form.style.maxHeight = null;
					setTimeout(() => _form.parentNode.removeChild(_form), 1000);
				}
				
				_form.addEventListener('mouseover', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', false);
				});
				
				_form.addEventListener('mouseout', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', true);
				});
				
				_form.close.onclick = function() {
					_form.closeForm();
				}
				
				_form.save.onclick = function() {
					if ( !_form.iconURL.value ) return;
					img.src = browser.runtime.getURL("/icons/spinner.svg");
					let newIcon = new Image();
					newIcon.onload = function() {
						img.src = imageToBase64(this, 32) || createCustomIcon({text: node.title.charAt(0).toUpperCase()});
					//	saveForm();
						node.icon = img.src;
						updateNodeList();
						li.dispatchEvent(new MouseEvent('dblclick'));
					}
					newIcon.onerror = function() {	
					//	showError(edit_form.iconURL,browser.i18n.getMessage("IconLoadError"));
						img.src = createCustomIcon({text: node.title.charAt(0).toUpperCase()});
						node.icon = img.src;
						updateNodeList();
					//	saveForm(false);
					}
					
					newIcon.src = _form.iconURL.value;
					
					setTimeout(() => {
						if (!newIcon.complete)
							newIcon.onerror();
					}, 5000);
				}
				li.appendChild(_form);
				
				_form.getBoundingClientRect();
				_form.style.maxHeight = '100px';
				
			}
		}
		
		if (node.type === 'separator') {

			let text = document.createElement('span');
			let div = document.createElement('div');
			div.style = 'display:inline-block;width:200px;height:4px;background-color:#aaa';
			text.appendChild(div);
			text.className = "label";
			header.appendChild(text);
		}
		
		if (node.type === 'oneClickSearchEngine') {

			let img = document.createElement('img');
			img.src = node.icon;
			header.appendChild(img);

			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			// indicate as a firefox one-click
			let ff = document.createElement('span');
			ff.innerText = "FF";
			ff.style = 'background-color:rgb(234, 172, 92);color:white;border-radius:4px;font-size:7pt;font-weight:bold;margin-left:5px;padding:1px 5px;vertical-align:middle';
			ff.title = 'Firefox One-Click Search Engine';

			header.appendChild(ff);
			
			li.addEventListener('dblclick', e => {
				alert( browser.i18n.getMessage('CannotEditOneClickEngines'));
			});
		}
		
		if (node.type === 'folder') {
			
			let img = document.createElement('img');
			img.src = browser.runtime.getURL('/icons/folder-icon.svg');
			header.appendChild(img);
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			let expand = document.createElement('span');
			expand.innerText = "-";
			expand.style.marginLeft = "-20px";
			expand.style.padding = "0 6px";
			expand.style.fontFamily = "monospace";
			header.insertBefore(expand, header.firstChild);
			
			

			let ul = document.createElement('ul');
			li.appendChild(ul);
			
			expand.onclick = function() {
				ul.style.display = ul.style.display ? null : "none";
				expand.innerText = ul.style.display ? "+" : "-";
			}
			
			node.children.forEach( _node => traverse(_node, ul) );
			
			li.addEventListener('dblclick', e => {
				
				if ( e.target !== li && e.target !== img && e.target !== header ) return;
				
				e.stopPropagation();
				// get the first form of the LI and check if folder form
				if ( li.querySelector(".editForm") ) {
					let _form = li.querySelector(".editForm");
					if ( _form && _form.closeForm ) {
						_form.closeForm();
						return;
					}
				}
				
				let _form = document.createElement('form');
				_form.innerHTML = `
				<table id="folderFormTable">
					<tr>
						<td>${browser.i18n.getMessage("display")}</td>
						<td>
							<select name="displayType" class="inputNice" style="display:inline-block;font-size:9pt;">
								<option value="">${browser.i18n.getMessage("default")}</option>
								<option value="grid">${browser.i18n.getMessage("grid")}</option>
								<option value="text">${browser.i18n.getMessage("text")}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>${browser.i18n.getMessage("grouplayout")}</td>
						<td><input name="groupFolder" type="checkbox" style="display:inline-block;width:auto"/> ${browser.i18n.getMessage("grouplayoutmessage")}</td>
					</tr>
					<tr>
						<td>${browser.i18n.getMessage("groupcolor")}</td>
						<td><input name="groupColor" type="color" style="width:30px;display:inline-block"/></td>
					</tr>
					<tr>
						<td>${browser.i18n.getMessage("grouplimit")}</td>
						<td><input name="groupLimit" type="number" min="0" max="99" style="width:60px;display:inline-block"/></td>
					</tr>
					<tr>
						<td>${browser.i18n.getMessage("grouphidemoretile")}</td>
						<td><input name="groupHideMoreTile" type="checkbox" style="width:60px;display:inline-block"/></td>
					</tr>			
				</table>
				
				<button type="button" name="close" class="inputNice _hover" style="float:right;margin:10px 5px" data-i18n="Close">${browser.i18n.getMessage("close")}</button>
				<button type="button" name="save" class="inputNice _hover" style="float:right;margin:10px 5px" data-i18n="Save">${browser.i18n.getMessage("save")}</button>
				<span class="saveMessage" style="float:right;margin: 10px 5px"></span>
				`;
				_form.className = 'editForm';
				_form.action = "";
				
				_form.closeForm = function() {
					_form.style.maxHeight = null;
					setTimeout(() => _form.parentNode.removeChild(_form), 1000);
				}
				
				_form.addEventListener('mouseover', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', false);
				});
				
				_form.addEventListener('mouseout', () => {
					for (let _li of rootElement.getElementsByTagName('li'))
						_li.setAttribute('draggable', true);
				});
				
				_form.close.onclick = function() {
					_form.closeForm();
				}
				
				_form.save.onclick = function() {
					showSaveMessage("saved", null, "yes", _form.querySelector(".saveMessage"));
					
					node.groupColor = _form.groupColor.value;
					node.groupFolder = _form.groupFolder.checked;
					node.groupLimit = parseInt(_form.groupLimit.value);
					node.displayType = _form.displayType.value;
					node.groupHideMoreTile = _form.groupHideMoreTile.checked;
					updateNodeList();
				}
				
				li.insertBefore(_form, ul);
				
				_form.groupColor.value = node.groupColor || userOptions.defaultGroupColor;
				_form.groupFolder.checked = node.groupFolder || false;
				_form.groupLimit.value = node.groupLimit || 0;
				_form.displayType.value = node.displayType || "";
				_form.groupHideMoreTile.checked = node.groupHideMoreTile || false;
				
				_form.getBoundingClientRect();
				_form.style.maxHeight = '200px';
			});	
			
			text.addEventListener('dblclick', e => {
				
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
				
				input.addEventListener('keypress', ev => {
					if (ev.key === "Enter")
						saveTitleChange(ev);
				});
				
				input.addEventListener('keydown', e => {
					if (e.key === "Escape") {
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
		if ( ['searchEngine', 'oneClickSearchEngine', 'bookmarklet', 'folder'].includes(node.type) ) {
			
			let hotkey = document.createElement('span');
			hotkey.title = browser.i18n.getMessage('Hotkey');
			hotkey.className = 'hotkey';
			hotkey.style.right = "0px";

			header.appendChild(hotkey);
			hotkey.innerText = keyTable[node.hotkey] || "";
			
			hotkey.onclick = function(e) {
				e.stopPropagation();			
				e.target.innerText = null;
				let img = document.createElement('img');
				img.src = 'icons/spinner.svg';
				img.style.height = '1em';
				img.style.verticalAlign = 'middle';
				img.style.margin = '0';
				e.target.appendChild(img);
				window.addEventListener('keydown', function keyPressListener(evv) {
					evv.preventDefault();
					
					if ( /* invalid keys */ [9,37,38,39,40].includes(evv.which) ) return;

					if (evv.key === "Escape") {
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
						setTimeout(() => hotkey.style.backgroundColor = null, 250);
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

		document.addEventListener('click', e => {			
			if ( document.getElementById('managerContainer').contains(e.target) ) return;			
			clearSelectedRows();
		});

		li.querySelector('.header').addEventListener('click', e => {
			closeContextMenus();
		//	e.stopPropagation();

			if (!selectedRows.length) {
				li.querySelector('.header').classList.add('selected');
				selectedRows.push(li);
				return;
			}
			
			if (selectedRows.length && !e.shiftKey) {
				clearSelectedRows();

				li.querySelector('.header').classList.add('selected');
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
					lis[i].querySelector('.header').classList.add('selected');
					selectedRows.push(lis[i]);
				}

				selectedRows = [...new Set(selectedRows)];
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
	repairNodeTree(root).then( result => {

		rootElement.node = root;
		
		for (let child of root.children)
			traverse(child, rootElement);
		
		table.appendChild(rootElement);

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
		
		// if dragrow is not selected
		if ( !selectedRows.includes(window.dragRow) ) {
			clearSelectedRows();
			window.dragRow.querySelector('.header').classList.add('selected');
			selectedRows.push(window.dragRow);
		}
	}
	
	function dragover_handler(ev) {
		let overNode = nearestParent('LI', ev.target);

		if ( selectedRows.includes(overNode) ) {
			overNode.querySelectorAll('.header').forEach( row => row.classList.add('error') );
			return;
		}
		
		let position = dragover_position(overNode, ev);
		
		if ( overNode.node.type === 'folder' && overNode.node.children.length && position === 'bottom' )
			position = 'middle';
		
		overNode.style = null;

		if ( position === 'top' ) {
			overNode.style.borderTop = '2px solid #008afc';
		} else if ( position === 'bottom' ) {
			overNode.style.borderBottom = '2px solid #008afc';
		} else {
			overNode.querySelector('.header').classList.add('selected');
		}

		ev.preventDefault();
	}
	function dragleave_handler(ev) {
		window.dragRow.style = null;
		let overNode = nearestParent('LI', ev.target);
		overNode.style=null;
		overNode.querySelectorAll('.header').forEach( row => row.classList.remove('error') );
		
		// clear folder styling
		if ( overNode.node.type === "folder" && !selectedRows.includes(overNode) ) // only remove if not originally selected
			overNode.querySelector('.header').classList.remove('selected');
	}
	function drop_handler(ev) {
		
		ev.preventDefault();

		let dragNode = window.dragRow.node;
		let targetElement = nearestParent('LI', ev.target);
		let targetNode = targetElement.node;
		let position = dragover_position(targetElement, ev);
		
		// clear drag styling
		targetElement.style = null;
		window.dragRow.style = null;

		// sort with hierarchy
		let sortedRows = [ ...$('#managerContainer').querySelectorAll('LI')].filter( row => selectedRows.indexOf(row) !== -1 ).reverse();
	
		sortedRows.forEach( row => {
			
			let _node = row.node;

			// cut the node from the children array
			let slicedNode = _node.parent.children.splice(_node.parent.children.indexOf(_node), 1).shift();

			// if target is bottom of populated folder, proceed as if drop on folder
			if ( targetElement.node.type === 'folder' && targetElement.node.children.length && position === 'bottom' )
				position = 'middle';
			
			if ( position === 'top' ) {
				
				// set new parent
				slicedNode.parent = targetNode.parent;

				// add to children above target
				targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode),0,slicedNode);

				// insert into DOM
				targetElement.parentNode.insertBefore(row, targetElement);
				
			} else if ( position === 'bottom' ) {

				// set new parent
				slicedNode.parent = targetNode.parent;

				// add to children above target
				targetNode.parent.children.splice(targetNode.parent.children.indexOf(targetNode) + 1, 0, slicedNode);

				// insert into DOM
				targetElement.parentNode.insertBefore(row, targetElement.nextSibling);
					
			} else if ( position === 'middle' ) { // drop into folder
					
				// set new parent
				slicedNode.parent = targetNode;

				// add to children above target
				targetNode.children.unshift(slicedNode);

				// append element to children (ul)
				let ul = targetElement.querySelector('ul');			
				ul.insertBefore(row, ul.firstChild);
			}
		});
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
		
		let currentNodeTree = JSON.parse(JSON.stringify(rootElement.node));
		
		if ( JSON.stringify(currentNodeTree) != JSON.stringify(userOptions.nodeTree) ) {
			console.log('nodeTrees unequal. Saving');
			userOptions.nodeTree = currentNodeTree
			saveOptions();
		}
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
			
			
			menuItem.addEventListener('click', e => {
				if ( menuItem.disabled ) {
					e.preventDefault();
					e.stopImmediatePropagation();
					return false;
				}
			});
			
			return menuItem;
		}

		let _delete = createMenuItem(browser.i18n.getMessage('Delete'), browser.runtime.getURL('icons/crossmark.svg'));
		
		_delete.onclick = function(e) {
			closeSubMenus();
			e.stopImmediatePropagation();
			e.preventDefault();

			// count the nodes to delete for prompt		
			function incrementKey(obj, key) {
				if ( !obj.hasOwnProperty(key) ) obj[key] = 1;
				else obj[key]++;
			}
			
			let nodesToDelete = [];	
			selectedRows.forEach( row => {
				nodesToDelete = nodesToDelete.concat(findNodes(row.node, n => true));
			});

			let objectsToDelete = {};	
			[...new Set(nodesToDelete)].forEach(n => incrementKey(objectsToDelete, n.type)); 
			
			if ( !selectedRows.length ) selectedRows.push(li);
			
			if ( selectedRows.length > 1 || li.node.children ) {
				
				let msgDiv = document.createElement('div');
				let msgDivHead = document.createElement('div');
				msgDivHead.innerText = browser.i18n.getMessage('confirm');
				msgDiv.appendChild(msgDivHead);
			//	msgDiv.appendChild(document.createElement('hr'));
				let msgDivRow = document.createElement('div');
				msgDiv.appendChild(msgDivRow);
				
				let nodeIcons = {
					searchEngine: "settings.svg",
					oneClickSearchEngine: "new.png",
					bookmarklet: "code.svg",
					folder: "folder.svg",
					separator: "separator.svg"
				}
				
				// build delete message from objectsToDelete
				for ( let key in objectsToDelete) {
					if ( objectsToDelete.hasOwnProperty(key) ) {
						let d = document.createElement('div');
						let img = new Image();
						img.style = "display:inline-block;height:16px;width:16px;vertical-align:middle";
						img.src = browser.runtime.getURL('icons/' + nodeIcons[key]);
						
						msgDivRow.appendChild(d);
						d.innerText = objectsToDelete[key];
						d.insertBefore(img, d.firstChild);
						
						// let x = new Image();
						// x.style = img.style;
						// x.src = browser.runtime.getURL('icons/crossmark.svg');
						// x.style+= "filter: grayscale(100%) brightness(40%) sepia(100%) hue-rotate(-50deg) saturate(600%) contrast(0.8);";
						
						// d.insertBefore(x, d.firstChild);
					}
				}
				
				let _menu = document.createElement('div');
				_menu.className = 'contextMenu subMenu';
				
				// position to the right of opening div
				let rect = _delete.getBoundingClientRect();
				_menu.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
				_menu.style.top = rect.y + window.scrollY + "px";

				// add menu items
				let item1 = document.createElement('div');
				item1.className = 'menuItem';
				item1.appendChild(msgDiv);
				
				item1.addEventListener('click', removeNodesAndRows);
				
				_menu.appendChild(item1);
				document.body.appendChild(_menu);
				openMenu(_menu);
				
			} else {
				removeNodesAndRows();
			}
			
			async function removeNodesAndRows() {

				// remember OCSEs to append hidden
				let ffses = [];
				selectedRows.forEach( row => {					
					ffses = ffses.concat(findNodes( row.node, n => n.type === "oneClickSearchEngine"));
				});

				// remove nodes and rows
				selectedRows.forEach( row => {
					if ( row.node.parent ) removeNode(row.node, row.node.parent);
					if ( row.parentNode ) row.parentNode.removeChild(row);
				});
				
				// remove nodeless searchEngines
				let indexesToRemove = [];
				userOptions.searchEngines.forEach( (se,index) => {
					if ( !findNode(rootElement.node, node => node.id === se.id) ) {
						indexesToRemove.push(index);
					}
				});

				for ( let i=indexesToRemove.length -1; i>-1; i-- ) {
					userOptions.searchEngines.splice(indexesToRemove[i], 1);
				}

				// append hidden OCSEs
				ffses.forEach( n => {
					n.parent = rootElement.node;
					n.hidden = true;
					rootElement.node.children.push(n);
				});

				updateNodeList();
				closeContextMenus();
			}

		}

		let edit = createMenuItem(browser.i18n.getMessage('Edit'), browser.runtime.getURL('icons/edit.png'));
		edit.addEventListener('click', e => {
			e.stopPropagation();

			if ( li.node.type === 'searchEngine')
				li.dispatchEvent(new MouseEvent('dblclick'));
			if (li.node.type === 'folder')
				li.dispatchEvent(new MouseEvent('dblclick'));
			if (li.node.type === 'bookmarklet')
				li.dispatchEvent(new MouseEvent('dblclick'));
			if (li.node.type === 'oneClickSearchEngine')
				li.dispatchEvent(new MouseEvent('dblclick'));
			
			closeContextMenus();
		});
		
		let hide = createMenuItem(li.node.hidden ? browser.i18n.getMessage('Show') : browser.i18n.getMessage('Hide'), browser.runtime.getURL('icons/hide.png'));
		hide.addEventListener('click', () => {
			if ( !selectedRows.length ) selectedRows.push(li);
			
			let hidden = !li.node.hidden;

			selectedRows.forEach( row => {
				row.node.hidden = hidden;
				
				if (hidden) row.classList.add('hidden');
				else row.classList.remove('hidden');
			});
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newFolder = createMenuItem(browser.i18n.getMessage('NewFolder'), browser.runtime.getURL('icons/folder.svg'));		
		newFolder.addEventListener('click', () => {
			let newFolder = {
				type: "folder",
				parent: li.node.parent,
				children: [],
				title: browser.i18n.getMessage('NewFolder'),
				id: gen(),
				toJSON: li.node.toJSON
			}
			
			li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, newFolder);
			
			let newLi = traverse(newFolder, li.parentNode);
			li.parentNode.insertBefore(newLi, li);
			
			// required delay to work
			setTimeout(() => newLi.dispatchEvent(new MouseEvent('dblclick')), 100);
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newBookmarklet = createMenuItem(browser.i18n.getMessage('AddBookmarklet'), browser.runtime.getURL('icons/code.svg'));		
		newBookmarklet.addEventListener('click', e => {
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

			CSBookmarks.getAllBookmarklets().then( results => {

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
					
					bmDiv.addEventListener('click', e => {
						
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
		
		let copy = createMenuItem(browser.i18n.getMessage('Copy'), browser.runtime.getURL('icons/copy.svg'));	
		copy.addEventListener('click', e => {
			
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
				
				item1.addEventListener('click', _e => {
					let _newNode = Object.assign({}, li.node);
					li.node.parent.children.splice(li.node.parent.children.indexOf(li.node), 0, _newNode);
			
					let newLi = traverse(_newNode, li.parentNode);
					li.parentNode.insertBefore(newLi, li);
					
					closeContextMenus();
				});
				
				let item2 = document.createElement('div');
				item2.className = 'menuItem';
				item2.innerText = browser.i18n.getMessage('AsNewEngine');
				
				item2.addEventListener('click', _e => {
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
		
		let newSeparator = createMenuItem(browser.i18n.getMessage('NewSeparator'), browser.runtime.getURL('icons/separator.svg'));	
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

		// attach options to menu
		[edit, hide, newFolder, newEngine, newSeparator, newBookmarklet, copy, _delete].forEach( el => {
			el.className = 'menuItem';
			menu.appendChild(el);
			el.addEventListener('click', closeContextMenus);
		});
		
		// disable some menu items when multiple rows are selected
		if ( selectedRows.length > 1 ) {
			[edit, newFolder, newEngine, newSeparator, newBookmarklet, copy].forEach( el => {
				el.disabled = true;
				el.style.opacity = .5;
			});
		}

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
			
			if ( e.which !== 1 ) return;
			
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
	
	function clearSelectedRows() {
		table.querySelectorAll('.selected').forEach( row => row.classList.remove('selected') );
		selectedRows = [];
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
	
	document.getElementById('b_addSearchEngine').addEventListener('click', e => {
		let newNode = addNewEngine(rootElement.node.children.slice(-1)[0]);
		if (newNode) {
			
			rootElement.node.children.push(newNode);
			
			let newLi = traverse(newNode, rootElement);

			updateNodeList();
			
			newLi.scrollIntoView();
			newLi.dispatchEvent(new MouseEvent('dblclick'));
		}
	});
	
	document.getElementById('b_resetAllSearchEngines').addEventListener('click', async() => {
		
		if ( !confirm(browser.i18n.getMessage("ConfirmResetAllSearchEngines")) ) return;
		
		let w = await browser.runtime.getBackgroundPage();
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
		await w.checkForOneClickEngines();
			
		// updated the local UO
		userOptions = w.userOptions;
		await saveOptions();
		location.href = "options.html#engines";
	});
	
	
	document.getElementById('iconPicker').addEventListener('change', e => {
		let file = e.target.files[0];
		
		var reader  = new FileReader();
		
		reader.addEventListener("load", function () {
			
			let img = new Image();
			
			img.onload = function() {
				let form = document.getElementById("editSearchEngineContainer");
				form.iconURL.value = imageToBase64(img, 32);
			//	document.getElementById('iconPreview').src = form.iconURL.value;
				form.closest("LI").querySelector("img").src = form.iconURL.value;
			}
			img.src = reader.result;
			
		}, false);
		
		reader.readAsDataURL(file);
		
	});	
}
