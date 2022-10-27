var selectedRows = [];
var rootElement;

isMenuOpen = () => $('.contextMenu') ? true : false;
isModalOpen = () => $('.overDiv') ? true : false; 

function buildSearchEngineContainer() {
	
	let table = document.createElement('div');
	table.style.textAlign = 'left';
	table.style.width = '100%';
	table.style.height = 'inherit';
	table.style.display = 'inline-block';
	table.style.verticalAlign = 'top';
	table.style.overflowY = 'scroll';

	// checkboxes
	(() => {
		['mouseup', 'dragstart'].forEach( eventType => {
			document.addEventListener(eventType, e => clearTimeout(window.mouseDownTimer), {capture: true});
		});

		document.addEventListener('keydown', e => {
			if ( e.key !== "Escape") return;

			if ( isMenuOpen() || isModalOpen() ) return;

			let cbs = document.querySelectorAll('.selectCheckbox:checked');

			if ( cbs.length ) cbs.forEach( _cb => _cb.checked = false);
			else $('managerContainer').classList.remove('showCheckboxes');	
		})
	})();

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
		li.addEventListener('dragenter',dragenter_handler);
		li.addEventListener('dragleave',dragleave_handler);
		
		let header = document.createElement('div');
		header.className = "header";
		header.title = node.description || node.title;
		
		li.appendChild(header);

		// checkboxes
		(() => {
			let cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.className = 'selectCheckbox';

			cb.addEventListener('change', e => e.stopPropagation())

			header.appendChild(cb);

			header.addEventListener('mousedown', e => {
				window.mouseDownTimer = setTimeout(() => {
					// class bound to container to affect all boxes
					$('managerContainer').classList.add('showCheckboxes');
				}, 1000);
			});

			header.addEventListener('click', e => {

				// check box if displayed
				if ( $('managerContainer').classList.contains('showCheckboxes'))
					cb.checked = !cb.checked;
			})

		})();

		if (node.type === 'searchEngine' || node.type === 'siteSearchFolder' ) {
			
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			
			if (se === undefined) {
				console.log('engine not found for ' + node.title + '(' + (node.id) + ')');
				li.parentNode.removeChild(li);
				return;
			}

			// se stores descriptions vs node ( sometimes / needs work )
			header.title = node.description || se.description || node.title;

			// force typecast as search engine
			se.type = 'searchEngine';

			let icon = document.createElement('img');
			icon.src = getIconFromNode(node);
			header.appendChild(icon);
			
			let text = document.createElement('span');
			text.className = "label";
			text.innerText = se.title;
			header.appendChild(text);

			// check for multisearch
			try {
				let arr = JSON.parse(se.template);

				if ( Array.isArray(arr) ) {

					let nodes = arr.map( id => findNode(userOptions.nodeTree, n => n.id === id));

					nodes.forEach( n => {
						let _icon = document.createElement('img');
						_icon.src = getIconFromNode(n);
						_icon.title = n.title;
						header.appendChild(_icon);
					})
				}
			} catch (error) {}

			node.contexts = node.contexts || se.contexts;

			li.addEventListener('dblclick', e => {

				let edit_form = $('editSearchEngineForm').cloneNode(true);

				edit_form.node = node;

				e.stopPropagation();

				addFormListeners(edit_form);
				
				let se = userOptions.searchEngines.find( se => se.id === node.id );
			
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
				
				function templateStringToURLArray(url) {
					let newString = url.replace(/[;|,|\s]\s*http/g, "____REPLACE____http");
					let urls = newString.split("____REPLACE____");
					
					let URLs = [];
					urls.forEach( _url => {
						try {
							URLS.push( new URL(_url) );
						} catch ( error ) {}
					});
					
					return URLs;	
				}
				
				// Check bad form values
				function checkFormValues() {
	
					// correct for case
					[edit_form.template, edit_form.post_params].forEach( el => {
						el.value = el.value.replace(/{searchterms}/i, "{searchTerms}");
					});
					
					return new Promise( (resolve, reject) => {
					
						if ( !edit_form.shortName.value.trim() ) {
							showError(edit_form.shortName,i18n('NameInvalid'));
							resolve(false);
						}
						if (edit_form.shortName.value != li.node.title) {
							
							if (userOptions.searchEngines.find( _se => _se.title == edit_form.shortName.value) ) {
								showError(edit_form.shortName,i18n('NameExists'));
								resolve(false);
							}
						}
						
						// multi-URL to single URL
						// if ( /[;|,|\s]\s*http/.test(edit_form.template.value) ) {
							// edit_form.template.value = edit_form.template.value.replace(/[;|,|\s]\s*http/g, "+http");
							
							// if ( !/^CS:\/\//.test(edit_form.template.value) )
								// edit_form.template.value = edit_form.template.value.replace(/^/, "CS://");
						// }
						// if (edit_form.template.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'GET' && edit_form.searchCode.value.trim() === "") {
							// showError(edit_form.template,i18n("TemplateIncludeError"));
						// }
						try {
							let _url = new URL(edit_form.template.value);
						} catch (error) {
							try {
								JSON.parse(edit_form.template.value);
							} catch (error2) {
								showError(edit_form.template,i18n("TemplateURLError"));
							}
						}
						try {
							let _url = new URL(edit_form.searchform.value);
						} catch (error) {
							try {
								let _url = new URL(edit_form.template.value);
								edit_form.searchform.value = _url.origin;
							} catch (_error) {}
						}
							// showError(edit_form.template,i18n("TemplateURLError"));
						//	return;

						// if (edit_form.post_params.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'POST' ) {
							// showError(edit_form.post_params, i18n("POSTIncludeError"));
						// }

						
						[edit_form.searchRegex, edit_form.matchRegex].forEach( el => {

							if ( !validateRegex(el.value) )
								showError(el, i18n("InvalidRegex") || "Invalid Regex");

						});
						
						if ( edit_form.iconURL.value.startsWith("resource:") ) {
							resolve(true);
						}

						resolve(true);

					});

				}
				
				// clear error formatting
				for (let label of edit_form.getElementsByTagName('label')) {
					if (label.dataset.i18n) label.innerText = i18n(label.dataset.i18n);
					label.style.color = null;
					clearError(label.nextSibling)
				}

				edit_form.shortName.value = se.title;
				edit_form.description.value = se.description || "";
				edit_form.template.value = se.template;
				edit_form.iconURL.value = se.icon_url || se.icon_base64String;
				edit_form._method.value = se.method || "GET";
				edit_form.post_params.value = (se.method === 'GET') ? "" : nameValueArrayToParamString(se.params);
				edit_form._encoding.value = se.queryCharset || "UTF-8";
				edit_form.searchform.value = se.searchForm || function() {
					try {
						return new URL(se.template).origin;
					} catch (err) {
						return "";
					}
				}();
				edit_form.searchRegex.value = se.searchRegex || "";
				edit_form.matchRegex.value = se.matchRegex || "";
				edit_form.searchCode.value = se.searchCode || "";

				setContexts(edit_form, node.contexts);
								
				edit_form.close.onclick = edit_form.closeForm;

				edit_form.test.onclick = function() {
					let searchTerms = window.prompt(i18n("EnterSearchTerms"),"ContextSearch web-ext");
	
					let tempSearchEngine = {
						"searchForm": edit_form.searchform.value,
						"method": edit_form._method.value, 
						"params": paramStringToNameValueArray(edit_form.post_params.value), 
						"template": edit_form.template.value, 
						"queryCharset": edit_form._encoding.value,
						"searchRegex": edit_form.searchRegex.value,
						"matchRegex": edit_form.matchRegex.value,
						"searchCode": edit_form.searchCode.value
					};

					browser.runtime.sendMessage({action: "testSearchEngine", "tempSearchEngine": tempSearchEngine, "searchTerms": searchTerms});
				}
				
				edit_form.copy.onclick = function() {
					let newNode = addNewEngine(node, true);
					addNode(newNode, li);
					updateNodeList(true);

					newLi.dispatchEvent(new MouseEvent('dblclick'));
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
						if (label.dataset.i18n) label.innerText = i18n(label.dataset.i18n);
						label.style.color = null;
						clearError(label.nextSibling)
					}

					async function saveForm() {

						// loading icon is last step. Set values after everything else
							
						// alert problems with changing name
						if (se.title !== edit_form.shortName.value) {
							
							// if firefox, check for ocses and confirm if name exists
							if ( browser.search && browser.search.get ) {
								let ocses = await browser.search.get();
							
								let ocse = ocses.find( _ocse => _ocse.name == edit_form.shortName.value );
								
								if ( ocse && !confirm(i18n('NameChangeWarning')))
									return;
							}

							se.title = li.node.title = node.title = edit_form.shortName.value;
							
							// change name on all labels
							table.querySelectorAll('li').forEach(_li => {
								if ( _li.node && _li.node.id === node.id )
									_li.querySelector('.label').innerText = _li.node.title = se.title;

							});

							updateNodeList();
						}

						let iconBase64 = await new Promise( resolve => {
							let img = new Image();
							img.onload = () => resolve(imageToBase64(img, userOptions.cacheIconsMaxSize));
							img.onerror = () => resolve("");

							setTimeout(() => resolve(""), 2500);

							let src = getIconSourceFromURL(edit_form.iconURL.value);

							if ( src.startsWith('data:')) {
								resolve(src);
								return;
							}

							img.src = src;
						});

						icon.src = iconBase64 || "icons/search.svg";

						se.icon_base64String = iconBase64;  //icon.src;
						se.description = edit_form.description.value;
						se.template = edit_form.template.value;
						se.searchForm = edit_form.searchform.value;
						se.icon_url = edit_form.iconURL.value;
						se.method = edit_form._method.value;
						se.queryCharset = edit_form._encoding.value;
						se.params = paramStringToNameValueArray(edit_form.post_params.value);
						se.id = se.id || gen();
						se.searchRegex = edit_form.searchRegex.value;
						se.matchRegex = edit_form.matchRegex.value;
						se.searchCode = edit_form.searchCode.value;

						se.contexts = getContexts(edit_form);
						node.contexts = se.contexts;
						setRowContexts(li);
						
						// force a save even if the nodeTree is unchanged
						updateNodeList(true);
						
						if ( edit_form.querySelector('.error') )
							showSaveMessage('saved with errors', 'red', edit_form.querySelector('.saveMessage'));
						else
							showSaveMessage('saved', null, edit_form.querySelector('.saveMessage'));
					}
					
					checkFormValues().then( result => {
						if ( result ) saveForm();
						else showSaveMessage("cannot save", "red", edit_form.querySelector('.saveMessage'));
					});
				}

				edit_form.saveclose.onclick = function() {
					edit_form.save.onclick();
					setTimeout(() => edit_form.close.onclick(), 500);
				}
				
				// clear error formatting on focus
				for (let element of edit_form.getElementsByTagName('input')) {
					element.addEventListener('focus', () => {
						clearError( element );
					});
				}

				createFormContainer(edit_form);
				addIconPickerListener(edit_form.iconPicker, li);
				addFavIconFinderListener(edit_form.faviconFinder);
				edit_form.addFaviconBox(getIconFromNode(node));
				checkFormValues();
			});

		}
		
		if (node.type === 'bookmarklet' || node.type === "bookmark") {
			
			let img = document.createElement('img');
			img.src = getIconFromNode(node);
			header.appendChild(img);
			
			li.addEventListener('dblclick', _edit);
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			function _edit() {
			
				let _form = $('editSearchEngineForm').cloneNode(true);
				_form.id = null;

				["template", "searchform", "post_params", "searchRegex", "matchRegex", "_method", "_encoding", "copy", "addOpenSearchEngine", "test"].forEach(name => {
					if ( _form[name].previousSibling && _form[name].previousSibling.nodeName === "LABEL" ) _form[name].parentNode.removeChild(_form[name].previousSibling);
					_form[name].parentNode.removeChild(_form[name]);
				})
				addFormListeners(_form);
				
				_form.node = node;
								
				_form.iconURL.value = node.icon || "";
				_form.shortName.value = node.title;
				_form.searchCode.value = node.searchCode || "";
				_form.description.value = node.description || "";

				_form.querySelector('label[data-i18n="SearchCode"]').innerText = i18n("Script");

				_form.searchCode.style.height = '12em';

				let s_bookmarklets = document.createElement('select');
				s_bookmarklets.style.width = 'auto';
				// b_bookmarklets.innerText = "Find Bookmarlets";
				let default_o = document.createElement('option');
				default_o.innerText = i18n("SearchBookmarklets");
				default_o.value = "";

				s_bookmarklets.appendChild(default_o);

				s_bookmarklets.onclick = async function() {

					if ( s_bookmarklets.value ) return;

					if ( s_bookmarklets.clicked ) return;

					CSBookmarks.getAllBookmarklets().then( results => {

						if (results.length === 0) return;
							
						for (let bm of results) {
							let o = document.createElement('option');
							o.innerText = bm.title;
							o.value = bm.id;
														
							s_bookmarklets.appendChild(o);
						}
					});

					s_bookmarklets.addEventListener('change', async e => {
						e.preventDefault();
						e.stopPropagation();

						browser.bookmarks.get(s_bookmarklets.value).then( bm => {
							bm = bm.shift();
							_form.shortName.value = bm.title;
							_form.searchCode.value = bm.url;
						});
					})

					s_bookmarklets.clicked = true;
				}

				// _form.appendChild(b_bookmarklets);
				_form.appendChild(s_bookmarklets);

				setContexts(_form, node.contexts);
				
				_form.close.onclick = _form.closeForm;

				// _form.test.onclick = function() {
				// 	let searchTerms = window.prompt(i18n("EnterURL"),"ContextSearch web-ext");
				// 	browser.runtime.sendMessage({action: "testSearchEngine", "tempSearchEngine": tempSearchEngine, "searchTerms": searchTerms});
				// }
				
				_form.save.onclick = async function() {

					node.icon = await getFormIcon(_form);
					_form.querySelector('[name="faviconBox"] img').src = getIconFromNode(node);
					img.src = getIconFromNode(node);

					node.title = _form.shortName.value.trim();
					node.contexts = getContexts(_form);
					node.searchCode = _form.searchCode.value;
					node.description = _form.description.value.trim();
					setRowContexts(li);

					text.innerText = node.title;

					showSaveMessage("saved", null, _form.querySelector(".saveMessage"));
					updateNodeList();
				}

				_form.saveclose.onclick = function() {
					_form.save.onclick();
					setTimeout(() => _form.close.onclick(), 500);
				}
				
				createFormContainer(_form);
				addIconPickerListener(_form.iconPicker, li);
				addFavIconFinderListener(_form.faviconFinder);
				_form.addFaviconBox(getIconFromNode(node));
				
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

		if (node.type === 'tool') {

			let img = document.createElement('img');
			img.src = getIconFromNode(node);
			header.appendChild(img);

			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
		}

		if (node.type === 'externalProgram') {

			let img = document.createElement('img');
			img.src = getIconFromNode(node);
			header.appendChild(img);

			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);

			li.addEventListener('dblclick', _edit);

			function _edit() {

				browser.permissions.request({permissions: ['nativeMessaging']});
			
				let _form = $('editSearchEngineForm').cloneNode(true);
				_form.id = null;

				[ "post_params", "matchRegex", "_method", "_encoding", "copy", "addOpenSearchEngine"].forEach(name => {
					if ( _form[name].previousSibling && _form[name].previousSibling.nodeName === "LABEL" ) _form[name].parentNode.removeChild(_form[name].previousSibling);
					_form[name].parentNode.removeChild(_form[name]);
				});

				addFormListeners(_form);
				
				_form.node = node;
								
				_form.iconURL.value = node.icon || "";
				_form.shortName.value = node.title;
				_form.template.value = node.path;
				_form.searchRegex.value = node.searchRegex;
				_form.description.value = node.description || "";
				_form.searchform.value = node.cwd || "";
				_form.searchCode.value = node.postScript || "";

				let cmd = _form.querySelector('label[data-i18n="Template"]');
				cmd.innerText = i18n("Command");

				let cwd = _form.querySelector('label[data-i18n="FormPath"]');
				cwd.innerText = i18n("WorkingDirectory");

				let pas = _form.querySelector('label[data-i18n="SearchCode"]');
				pas.innerText = i18n("PostAppScript");
				pas.title = i18n("PostAppScriptTooltip");

				_form.insertBefore(cwd, _form.template.nextSibling);
				_form.insertBefore(_form.searchform, cwd.nextSibling);

				(() => {
					let div = document.createElement('div');
					_form.appendChild(div);

					let img = createMaskIcon("/icons/settings.svg");
					img.style.height = '24px';
					img.style.verticalAlign = 'middle';
					img.style.marginRight = '10px';
					img.style.cursor = 'pointer';
					img.title = `${i18n('NativeApp')} ( ${i18n('CheckForUpdates')} )`;

					img.onclick = function() { checkAndUpdateNativeApp() }

					div.appendChild(img);
					let span = document.createElement('span');
					div.appendChild(span);

					checkStatus = async() => {

						let version = false;

						try {
							version = await browser.runtime.sendNativeMessage("contextsearch_webext", {version: true}).then( r => r, r => false);
						} catch (error) {}

						if ( version ) {
							span.innerText = 'v' + version;
						} else {
							let a = document.createElement("a");
							a.target = "_blank";
							a.title = i18n("MessengerOfflineTooltip");
							a.style = "color:unset";
							a.href = "https://github.com/ssborbis/ContextSearch-Native-App";
							a.innerText = i18n('NativeAppMissing');
							span.appendChild(a);
						}
					}

					let checkStatusInterval = setInterval(() => {
						if ( !_form.isConnected ) 
							clearInterval(checkStatusInterval);
						else 
							checkStatus();
					}, 2500);
					
				})();

				setContexts(_form, node.contexts);
				
				_form.close.onclick = _form.closeForm;
				
				_form.save.onclick = async function() {

					node.icon = await getFormIcon(_form);
					_form.querySelector('[name="faviconBox"] img').src = getIconFromNode(node);
					img.src = getIconFromNode(node);

					node.title = _form.shortName.value.trim();
					node.path = _form.template.value.trim();
					node.searchRegex = _form.searchRegex.value.trim();
					node.description = _form.description.value.trim();
					node.cwd = _form.searchform.value.trim();
					node.postScript = _form.searchCode.value;
					node.contexts = getContexts(_form);
					setRowContexts(li);

					text.innerText = node.title;

					showSaveMessage("saved", null, _form.querySelector(".saveMessage"));
					updateNodeList();
				}

				_form.saveclose.onclick = function() {
					_form.save.onclick();
					setTimeout(() => _form.close.onclick(), 500);
				}

				_form.test.onclick = async function() {

					try {
						await browser.permissions.request({permissions: ['nativeMessaging']});
  						await browser.runtime.sendNativeMessage("contextsearch_webext", {verify: true});
  					} catch (error) {
 						return alert(i18n('NativeAppMissing'));
 					}

					let searchTerms = window.prompt(i18n("EnterSearchTerms"),"ContextSearch web-ext");
					
					let tempNode = Object.assign({}, JSON.parse(JSON.stringify(node)));
					tempNode.path = _form.template.value.trim();
					tempNode.cwd = _form.searchform.value.trim();
					tempNode.postScript = _form.searchCode.value.trim();
					
					browser.runtime.sendMessage({
						action:"search",
						info: {
							node: tempNode,
							openMethod: "openNewTab",
							selectionText: searchTerms
						}
					})
				}
				
				createFormContainer(_form);
				addIconPickerListener(_form.iconPicker, li);
				addFavIconFinderListener(_form.faviconFinder);
				_form.addFaviconBox(getIconFromNode(node));

			}
		}
		
		if (node.type === 'oneClickSearchEngine') {

			let img = document.createElement('img');
			img.src = getIconFromNode(node);
			header.appendChild(img);

			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			// indicate as a firefox one-click
			let ff = document.createElement('firefox-icon');
			ff.title = 'Firefox One-Click Search Engine';

			header.appendChild(ff);
			
			li.addEventListener('dblclick', _edit);

			function _edit() {
			
				let _form = $('editSearchEngineForm').cloneNode(true);
				_form.id = null;

				["shortName","description", "template", "searchform", "post_params", "searchRegex", "searchCode", "matchRegex", "_method", "_encoding", "copy", "addOpenSearchEngine", "test"].forEach(name => {
					if ( _form[name].previousSibling && _form[name].previousSibling.nodeName === "LABEL" ) _form[name].parentNode.removeChild(_form[name].previousSibling);
					_form[name].parentNode.removeChild(_form[name]);
				})
				addFormListeners(_form);
				
				_form.node = node;
								
				_form.iconURL.value = node.icon || "";
			//	_form.shortName.value = node.title;
				setContexts(_form, node.contexts);
				
				_form.close.onclick = _form.closeForm;
				
				_form.save.onclick = async function() {

					node.icon = await getFormIcon(_form);
					_form.querySelector('[name="faviconBox"] img').src = getIconFromNode(node);
					img.src = getIconFromNode(node);

				//	node.title = _form.shortName.value.trim();
					node.contexts = getContexts(_form);
					setRowContexts(li);

					text.innerText = node.title;

					showSaveMessage("saved", null, _form.querySelector(".saveMessage"));
					updateNodeList();
				}
				
				createFormContainer(_form);
				addIconPickerListener(_form.iconPicker, li);
				addFavIconFinderListener(_form.faviconFinder);
				_form.addFaviconBox(getIconFromNode(node));

			}
		}
		
		if (node.type === 'folder') {
			
			let img = document.createElement('img');
			img.src = getIconFromNode(node);
			header.appendChild(img);
			
			let text = document.createElement('span');
			text.innerText = node.title;
			text.className = "label";
			header.appendChild(text);
			
			let ec = document.createElement('span');
			ec.innerText = "-";
			ec.className = "collapse";

			header.insertBefore(ec, header.firstChild);

			let ul = document.createElement('ul');
			li.appendChild(ul);

			ec.expand = () => {
				ul.style.display = null;
				ec.innerText = "-";
			}

			ec.collapse = () => {
				ul.style.display = 'none';
				ec.innerText = "+";
			}
			
			ec.onclick = function() {
				if ( ul.style.display ) ec.expand();
				else ec.collapse();
			}
			
			node.children.forEach( _node => traverse(_node, ul) );
			
			li.addEventListener('dblclick', e => {
				
				if ( e.target !== li && e.target !== img && e.target !== header ) return;
				
				e.stopPropagation();
				
				let _form = $('editSearchEngineForm').cloneNode(true);
				_form.id = null;

				["description", "template", "searchform", "post_params", "searchRegex", "searchCode", "matchRegex", "_method", "_encoding", "copy", "addOpenSearchEngine", "test"].forEach(name => {
					if ( _form[name].previousSibling && _form[name].previousSibling.nodeName === "LABEL" ) _form[name].parentNode.removeChild(_form[name].previousSibling);
					_form[name].parentNode.removeChild(_form[name]);
				});


				_form.insertBefore($('folderFormTable').cloneNode(true), _form['save'].parentNode);

				let c = _form.querySelector('.contexts');
				c.parentNode.removeChild(c);

				addFormListeners(_form);

				_form.node = node;

				_form.closeForm = _form.closeForm;
				
				_form.close.onclick = _form.closeForm;
				
				_form.save.onclick = function() {
					showSaveMessage("saved", null, _form.querySelector(".saveMessage"));

					node.title = _form.shortName.value.trim();
					node.groupColor = _form.groupColor.value;
					node.groupColorText = _form.groupColorText.value;
					node.groupFolder = _form.groupFolder.value || false;
					node.groupLimit = parseInt(_form.groupLimit.value);
					node.displayType = _form.displayType.value;
					node.groupHideMoreTile = _form.groupHideMoreTile.checked;
					node.icon = _form.iconURL.value;
					updateNodeList();

					text.innerText = node.title;
				}

				_form.saveclose.onclick = function() {
					_form.save.onclick();
					setTimeout(() => _form.close.onclick(), 500);
				}

				_form.iconURL.addEventListener('change', () => {
					let img = li.querySelector('.header IMG');
					img.src = _form.iconURL.value || browser.runtime.getURL('icons/folder-icon.svg');
				});
								
				_form.shortName.value = node.title;
				_form.groupColor.value = node.groupColor || userOptions.defaultGroupColor;
				_form.groupColorText.value = node.groupColorText || userOptions.defaultGroupColorText;
				_form.groupFolder.value = node.groupFolder || "";
				_form.groupLimit.value = node.groupLimit || 0;
				_form.displayType.value = node.displayType || "";
				_form.groupHideMoreTile.checked = node.groupHideMoreTile || false;
				_form.iconURL.value = node.icon || "";
				
				createFormContainer(_form);
				addIconPickerListener(_form.iconPicker, li);
				addFavIconFinderListener(_form.faviconFinder);
				_form.addFaviconBox(getIconFromNode(node));

				_form.c_groupColor.value = _form.groupColor.value;
				_form.c_groupColor.onchange = (e) => {
					_form.groupColor.value = e.target.value;
				}
				_form.groupColor.onchange = (e) => {
					_form.c_groupColor.value = e.target.value;
				}

				_form.c_groupColorText.value = _form.groupColorText.value;
				_form.c_groupColorText.onchange = (e) => {
					_form.groupColorText.value = e.target.value;
				}
				_form.groupColorText.onchange = (e) => {
					_form.c_groupColorText.value = e.target.value;
				}

				function showHideGroupSettings() {
		
					if ( !_form.groupFolder.value) {
						['groupColor', 'groupLimit', 'groupHideMoreTile'].forEach( name => {
							_form[name].closest('TR').style.display = 'none';
						})
					} else {
						['groupColor', 'groupLimit', 'groupHideMoreTile'].forEach( name => {
							_form[name].closest('TR').style.display = null;
						})
					}
				}

				_form.groupFolder.addEventListener('change', showHideGroupSettings);
				showHideGroupSettings();
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
		if ( ['searchEngine', 'oneClickSearchEngine', 'bookmarklet', 'folder', 'externalProgram'].includes(node.type) ) {
			
			let hotkey = document.createElement('span');
			hotkey.title = i18n('Hotkey');
			hotkey.className = 'hotkey';
			hotkey.style.right = "4px";

			header.appendChild(hotkey);
			hotkey.innerText = keyTable[node.hotkey] || "";
			
			hotkey.onclick = function(e) {
				e.stopPropagation();			
				e.target.innerText = null;

				let img = document.createElement('img');
				img.src = 'icons/spinner.svg';

				e.target.appendChild(img);

				window.listeningForHotkey = true;

				window.addEventListener('keydown', function keyPressListener(evv) {
					evv.preventDefault();
					
					if ( /* invalid keys */ [9,37,38,39,40].includes(evv.which) ) return;

					if (evv.key === "Escape") {
						node.hotkey = null;
						
						// set hotkey for all copies
						for (let _hk of rootElement.querySelectorAll('li')) {
							if (_hk.node && _hk.node.id === node.id)
								_hk.querySelector('.hotkey').innerText = "";
						}
	
						window.removeEventListener('keydown', keyPressListener);
						window.listeningForHotkey = false;
						updateNodeList();
						return;
					}
					
					node.hotkey = evv.which;

					if ( findNode(rootElement.node, _node => _node.hotkey === evv.which && _node.id !== node.id) ) {						
						hotkey.style.backgroundColor = 'pink';
						setTimeout(() => hotkey.style.backgroundColor = null, 250);
						return;
					}

					// set hotkey for all copies
					for (let _hk of rootElement.querySelectorAll('li')) {
						if (_hk.node && _hk.node.id === node.id)
							_hk.querySelector('.hotkey').innerText = keyTable[evv.which];
					}
					
					findNodes(rootElement.node, _node => {
						if ( _node.type === node.type && _node.id === node.id )
							_node.hotkey = node.hotkey;
					});

					window.removeEventListener('keydown', keyPressListener);
					window.listeningForHotkey = false;
					updateNodeList();
				}); 
			}

			let keyword = document.createElement('input');
			keyword.title = i18n('Keyword');
			keyword.className = "inputNice hotkey keyword";


			header.appendChild(keyword);
			keyword.value = node.keyword || "";

			keyword.onclick = e => e.stopPropagation();
			keyword.ondblclick = e => e.stopPropagation();
			keyword.addEventListener('dragstart', (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
			});
			keyword.addEventListener('mousedown', () => li.setAttribute("draggable", false));
			keyword.addEventListener('mouseup', () => li.setAttribute("draggable", true));
			keyword.setAttribute('draggable', false);

			keyword.addEventListener('keydown', e => {
				if ( e.key === "Enter") {
					keyword.dispatchEvent(new Event('change'));
					keyword.blur();
				}
			});

			keyword.addEventListener('keydown', e => {
				if ( e.key === "Escape") {
					keyword.value = "";
					keyword.dispatchEvent(new Event('change'));
					keyword.blur();
				}
			});

			keyword.addEventListener('change', e => {
				keyword.value = keyword.value.trim();

				// check for duplicates
				if ( keyword.value && findNode(rootElement.node, _node => _node.keyword === keyword.value && _node.id !== node.id) ) {

					keyword.style.backgroundColor = 'pink';
					return;
				}

				node.keyword = keyword.value;

				// set keyword for all copies
				for (let _li of rootElement.querySelectorAll('li')) {
					if (_li.node.id === node.id) {
						_li.querySelector('.keyword').value = _li.node.keyword = node.keyword;
						_li.querySelector('.keyword').style.backgroundColor = null;
					}
				}
				
				updateNodeList();
			});

			// let edit = new Image();
			// edit.className = "editIcon";
			// edit.src = 'icons/settings.svg';
			// header.appendChild(edit);

		}

		// add match icons for some node types
		// if ( ['searchEngine'].includes(node.type) ) {

		// 	let se = userOptions.searchEngines.find( _se => _se.id === node.id );

		// 	if ( se && se.matchRegex ) {
		// 		let tool = document.createElement('div');
		// 		tool.title = i18n('matchsearchtermsregex');
		// 		tool.className = 'tool contextIcon';
		// 		tool.style.setProperty('--mask-image', `url(${browser.runtime.getURL('icons/regex.svg')})`);
		// 		header.appendChild(tool);
		// 		tool.style.right = "104px";
		// 		tool.style.position = 'absolute';
		// 	}
		// }
		
		let div = document.createElement('div');
		div.className = 'contextIcons';
		header.appendChild(div);

		setRowContexts(li);

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
			
			if (selectedRows.length && !e.shiftKey && !e.ctrlKey) {
				clearSelectedRows();

				li.querySelector('.header').classList.add('selected');
				selectedRows.push(li);
				return;
			}
			
			if (selectedRows.length && e.shiftKey) {
			//	let startNode = selectedRows[0].node;
				let startRow = selectedRows.slice(-1)[0]
				let startNode = startRow.node
				let endNode = li.node;
				
				if (startNode.parent !== endNode.parent) return;
				
				let startIndex = startNode.parent.children.indexOf(startNode);
				let endIndex = endNode.parent.children.indexOf(endNode);
				
				let slicedNodes = startNode.parent.children.slice(startIndex, endIndex + 1);
				
				let lis = [...table.querySelectorAll('li')];
			//	let start = lis.indexOf(selectedRows[0]);
				let start = lis.indexOf(startRow);
				let end = lis.indexOf(li);
				
				liStartIndex = Math.min(start, end);
				liEndIndex = Math.max(start, end);
				
				for (let i=liStartIndex;i<liEndIndex + 1;i++) {
					lis[i].querySelector('.header').classList.add('selected');
					selectedRows.push(lis[i]);
				}

				selectedRows = [...new Set(selectedRows)];
			} else if ( selectedRows.length && e.ctrlKey ) {	

				if ( li.querySelector('.header').classList.contains('selected') ) {
					let i = selectedRows.indexOf(li);
					selectedRows.splice(i,1);
					console.log('removing selected row', i, selectedRows);
				} else {
					selectedRows.push(li);
					console.log('pushing selected row', selectedRows);
				}
				
				li.querySelector('.header').classList.toggle('selected');
			}
			
		});
		
		return li;
	}

	const buildSpecialFolders = () => {
		if ( !findNode(userOptions.nodeTree, n => n.id === "___tools___")) {

			let tools = {
				type: "folder",
				children: [],
				title: i18n('Tools'),
				id: "___tools___"
			};
			userOptions.quickMenuTools.forEach(t => {
				let tool = QMtools.find(_t => _t.name === t.name);
				if ( tool )
					tools.children.push(
						{
							type: "tool",
							title: tool.title,
							tool:tool.name,
							icon:tool.icon
						}
					)
			});

			root.children.unshift(tools);
		}
	}
		
	// high-scope veriable to access node tree
	rootElement = document.createElement('ul');
	rootElement.style.position = 'relative';

	let root = JSON.parse(JSON.stringify(userOptions.nodeTree));

//	buildSpecialFolders();

	setParents(root);

	// clear any dead nodes
	repairNodeTree(root).then( result => {

		rootElement.node = root;
		
		for (let child of root.children)
			traverse(child, rootElement);
		
		table.appendChild(rootElement);

		updateNodeList();

		let lastLI = document.createElement('LI');
		rootElement.appendChild(lastLI);

		lastLI.style = 'height:16px;';
		lastLI.addEventListener('dragover', e => e.preventDefault());
		lastLI.addEventListener('drop', drop_handler);
		lastLI.id = "lastLI";
		
		document.getElementById('managerContainer').innerHTML = null;
		document.getElementById('managerContainer').appendChild(table);
	});

	function dragover_position(el, ev) {
		let rect = el.getBoundingClientRect();

		let rowHeight = 22;// + (el.position !== 'middle') ? 20 : 0;
		let position = 'bottom';

		if ( ev.offsetY < rowHeight / 2 ) position = 'top';

		if ( el.node.type === 'folder' && ev.offsetY > rowHeight / 3 && ev.offsetY < rowHeight / 3 * 2 )
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

		ev.preventDefault();

		let targetElement = nearestParent('LI', ev.target);

		if ( selectedRows.includes(targetElement) ) {
			targetElement.querySelectorAll('.header').forEach( row => row.classList.add('error') );
			return false;
		}

		for ( let row of selectedRows ) {
			if ( row.contains(targetElement) ) {
				targetElement.querySelectorAll('.header').forEach( row => row.classList.add('error') );
				return false;
			}
		}
		
		let position = dragover_position(targetElement, ev);
		
		if ( targetElement.node.type === 'folder' && targetElement.node.children.length && position === 'bottom' )
			position = 'middle';

		// skip repeat events
		if ( targetElement.position && targetElement.position === position) return;

		targetElement.position = position;
		
		targetElement.style = '';

		if ( position === 'top' ) {
			targetElement.style.borderTop = '1px solid var(--selected)';
		} else if ( position === 'bottom' ) {
			targetElement.style.borderBottom = '1px solid var(--selected)';
		} else {
			targetElement.querySelector('.header').classList.add('selected');
		}	
	}

	function dragenter_handler(ev) {
		// clear positioning
		let targetElement = nearestParent('LI', ev.target);
		targetElement.position = null;
		ev.preventDefault();
	}

	function dragleave_handler(ev) {
		let targetElement = nearestParent('LI', ev.target);

		window.dragRow.style = '';
		targetElement.querySelectorAll('.header').forEach( row => row.classList.remove('error') );
		
		// clear folder styling
		if ( targetElement.node.type === "folder" && !selectedRows.includes(targetElement) ) // only remove if not originally selected
			targetElement.querySelector('.header').classList.remove('selected');

		targetElement.style = '';
	}
	
	function drop_handler(ev) {
		
		ev.preventDefault();

		let dragNode = window.dragRow.node;
		let targetElement = nearestParent('LI', ev.target);
		let targetNode = targetElement.node;

		if ( targetNode === dragNode )
			return false;

		let forceAppend = false;
		if ( targetElement === $('lastLI') ) {
			targetElement = $('lastLI').previousSibling;
			targetNode = targetElement.node;
			forceAppend = true;
		}

		if ( selectedRows.includes(targetElement) )
			return false;

		for ( let row of selectedRows ) {
			if ( row.contains(targetElement) ) return false;
		}

		let position = dragover_position(targetElement, ev);
		
		// clear drag styling
		targetElement.style = '';
		window.dragRow.style = '';

		// sort with hierarchy
		let sortedRows = [ ...$('#managerContainer').querySelectorAll('LI')].filter( row => selectedRows.indexOf(row) !== -1 ).reverse();
	
		// remove children of folders nodes to prevent flattening
		sortedRows = sortedRows.filter( r => !sortedRows.find(_r => _r.node === r.node.parent ));
		
		try {

			for ( let row of sortedRows) {
				
				let _node = row.node;

				// cut the node from the children array
				let slicedNode = nodeCut(_node);

				// if target is bottom of populated folder, proceed as if drop on folder
				if ( targetElement.node.type === 'folder' && targetElement.node.children.length && position === 'bottom' )
					position = 'middle';

				if ( forceAppend ) position = 'bottom';
				
				if ( position === 'top' ) {
					nodeInsertBefore(slicedNode, targetNode);
					targetElement.parentNode.insertBefore(row, targetElement);
					
				} else if ( position === 'bottom' ) {
					nodeInsertAfter(slicedNode, targetNode);
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
			}
		} catch ( error ) {
			console.log(error);
			return false;
		}

		updateNodeList();
	}
	
	function dragend_handler(ev) {

		 let overNode = nearestParent('LI', ev.target);
		 overNode.querySelectorAll('.header').forEach( row => row.classList.remove('error') );
	}
	
	function nearestParent( tagName, target ) {
		while ( target && target.nodeName.toUpperCase() !== tagName.toUpperCase() ) {
			target = target.parentNode;
		}
		
		return target;
	}
	
	function contextMenuHandler(e) {

		// if (document.getElementById('editSearchEngineForm').contains(e.target) ) return false;
		e.preventDefault();
		
		let li = nearestParent('LI', e.target);

		// flag if opened from button vs context menu
		let buttonAdd = e.target === document.querySelector('#b_addSearchEngine') ? true : false;
		if ( buttonAdd && !li ) {
			// second-to-last row. Last row is blank
			li = document.querySelector('#managerContainer ul').lastChild.previousSibling;
		}
		
		closeContextMenus();

		let menu = document.createElement('div');
		// menu.id = "contextMenu";
		menu.className = "contextMenu";
		
		function createMenuItem(name, icon) {
			let menuItem = document.createElement('div');

			let img = createMaskIcon(icon);
			img.classList.add('menuIcon')
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

		let _delete = createMenuItem(i18n('Delete'), browser.runtime.getURL('icons/crossmark.svg'));
		
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
				
			let msgDiv = document.createElement('div');
			let msgDivHead = document.createElement('div');
			msgDivHead.innerText = i18n('confirm');
			msgDiv.appendChild(msgDivHead);

			let msgDivRow = document.createElement('div');
			msgDiv.appendChild(msgDivRow);
			
			let nodeIcons = {
				searchEngine: "settings.svg",
				oneClickSearchEngine: "new.svg",
				bookmarklet: "code.svg",
				folder: "folder.svg",
				separator: "separator.svg",
				tool: "add.svg",
				siteSearchFolder: "search.svg",
				externalProgram: "terminal.svg"
			}
			
			// build delete message from objectsToDelete
			for ( let key in objectsToDelete) {
				if ( objectsToDelete.hasOwnProperty(key) ) {
					let d = document.createElement('div');
					let img = createMaskIcon('icons/' + nodeIcons[key]);
					img.classList.add('menuIcon');
					
					msgDivRow.appendChild(d);
					d.innerText = objectsToDelete[key];
					d.insertBefore(img, d.firstChild);
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
		}
			
		let edit = createMenuItem(i18n('Edit'), browser.runtime.getURL('icons/edit.svg'));
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
		
		let hide = createMenuItem( li.node.hidden ? i18n('Show') : i18n('Hide'), browser.runtime.getURL('icons/hide.svg'));
		hide.addEventListener('click', () => {
			if ( !selectedRows.length ) selectedRows.push(li);
			
			let hidden = !li.node.hidden;

			selectedRows.forEach( row => {
				row.node.hidden = hidden;
				row.classList.toggle('hidden', hidden);
			});
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newFolder = createMenuItem(i18n('NewFolder'), browser.runtime.getURL('icons/folder.svg'));		
		newFolder.addEventListener('click', () => {
			let newFolder = {
				type: "folder",
				parent: li.node.parent,
				children: [],
				title: i18n('NewFolder'),
				id: gen(),
				toJSON: li.node.toJSON
			}
			
			nodeInsertAfter(newFolder, li.node);
			
			let newLi = traverse(newFolder, li.parentNode);
			li.parentNode.insertBefore(newLi, li.nextSibling);
			
			// required delay to work
			setTimeout(() => {
				newLi.querySelector('.header .label').dispatchEvent(new MouseEvent('dblclick'));
				newLi.scrollIntoView({block: "start", behavior:"smooth"});
			}, 100);

			updateNodeList();
			closeContextMenus();
		});
		
		// let newBookmarklet = createMenuItem(i18n('AddBookmarklet'), browser.runtime.getURL('icons/code.svg'));		
		// newBookmarklet.addEventListener('click', e => {
		// 	closeSubMenus();
		// 	e.stopImmediatePropagation();
		// 	e.preventDefault();

		// 	if (!browser.bookmarks) {
		// 		CSBookmarks.requestPermissions();
		// 		return;
		// 	}
			
		// 	let bmContainer = document.createElement('div');

		// 	bmContainer.className = 'contextMenu subMenu';
			
		// 	let rect = newBookmarklet.getBoundingClientRect();

		// 	bmContainer.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
		// 	bmContainer.style.top = rect.y + window.scrollY + "px";
			
		// 	let item1 = document.createElement('div');
		// 	item1.className = 'menuItem';
			
		// 	let _img = new Image(20);
		// 	_img.src = browser.runtime.getURL('icons/spinner.svg');
		// 	item1.appendChild(_img);
		// 	bmContainer.appendChild(item1);
			
		// 	document.body.appendChild(bmContainer);
		// 	openMenu(bmContainer);

		// 	CSBookmarks.getAllBookmarklets().then( results => {

		// 		if (results.length === 0) {
		// 			item1.innerHTML = "<i>none found</i>";
		// 			item1.addEventListener('click', () => {
		// 				closeContextMenus();
		// 			});
		// 			return;
		// 		}
				
		// 		bmContainer.removeChild(item1);
				
		// 		for (let bm of results) {
		// 			let bmDiv = document.createElement('div');
		// 			bmDiv.className = 'menuItem';
		// 			bmDiv.innerText = bm.title;
					
		// 			bmDiv.addEventListener('click', e => {
						
		// 				let newBm = {
		// 					type: "bookmarklet",
		// 					id: bm.id,
		// 					title: bm.title,
		// 					parent: li.node.parent,
		// 					toJSON: li.node.toJSON
		// 				}
						
		// 				nodeInsertAfter(newBm, li.node);

		// 				let newLi = traverse(newBm, li.parentNode);
		// 				li.parentNode.insertBefore(newLi, li.nextSibling);
		// 				newLi.scrollIntoView({block: "start", behavior:"smooth"});
		// 				newLi.dispatchEvent(new MouseEvent('dblclick'));
				
		// 				updateNodeList();
						
		// 				closeContextMenus();


		// 			});
					
		// 			bmContainer.appendChild(bmDiv);

		// 		}
				
		// 		bmContainer.style.maxWidth = '200px';
		// 		bmContainer.style.maxHeight = '400px';
		// 		bmContainer.style.overflowY = 'auto';

		// 	});

		// });

		let newScript = createMenuItem(i18n('NewScript'), browser.runtime.getURL('icons/code.svg'));		
		newScript.addEventListener('click', e => {
			closeSubMenus();
			e.stopImmediatePropagation();
			e.preventDefault();

			let newBm = {
				type: "bookmarklet",
				id: gen(),
				title: "new script",
				parent: li.node.parent,
				contexts:[32],
				toJSON: li.node.toJSON
			}
				
			nodeInsertAfter(newBm, li.node);

			let newLi = traverse(newBm, li.parentNode);
			li.parentNode.insertBefore(newLi, li.nextSibling);
			newLi.scrollIntoView({block: "start", behavior:"smooth"});
			newLi.dispatchEvent(new MouseEvent('dblclick'));
	
			updateNodeList();
			
			closeContextMenus();
		});
		
		let copy = createMenuItem(i18n('Copy'), browser.runtime.getURL('icons/copy.svg'));	
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
				item1.innerText = i18n('AsShortcut');
				
				item1.addEventListener('click', _e => {
					let _newNode = Object.assign({}, li.node);
					nodeInsertBefore(_newNode, li.node);
			
					let newLi = traverse(_newNode, li.parentNode);
					li.parentNode.insertBefore(newLi, li);
					
					updateNodeList(true);
					closeContextMenus();
				});
				
				let item2 = document.createElement('div');
				item2.className = 'menuItem';
				item2.innerText = i18n('AsNewEngine');
				
				item2.addEventListener('click', _e => {
					let _newNode = addNewEngine(li.node, true);
					addNode(_newNode, li);
					
					updateNodeList(true);
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
				newNode.id = gen();
			}
			
			if (!newNode) return;
			
			nodeInsertAfter(newNode, li.node);
			
			let newLi = traverse(newNode, li.parentNode);
			li.parentNode.insertBefore(newLi, li.nextSibling);
			
			updateNodeList();
			closeContextMenus();
		});
		
		let newEngine = createMenuItem(i18n('NewEngine'), browser.runtime.getURL('icons/new.svg'));	
		newEngine.addEventListener('click', () => {
			
			let newNode = addNewEngine(li.node, false);		
			let newLi = addNode(newNode, li);
			updateNodeList(true);
				
			newLi.scrollIntoView({block: "start", behavior:"smooth"});
			newLi.dispatchEvent(new MouseEvent('dblclick'));
			
			closeContextMenus();
		});
		
		let newSeparator = createMenuItem(i18n('NewSeparator'), browser.runtime.getURL('icons/separator.svg'));	
		newSeparator.addEventListener('click', () => {
			let newNode = {
				type: "separator",
				parent: li.node.parent,
				toJSON: li.node.toJSON
			}
			
			nodeInsertAfter(newNode, li.node);
			
			let newLi = traverse(newNode, li.parentNode);
			li.parentNode.insertBefore(newLi, li.nextSibling);
			newLi.scrollIntoView({block: "start", behavior:"smooth"});
			
			updateNodeList();
		});

		let newExternalProgram = createMenuItem(i18n('NewExternalProgram'), browser.runtime.getURL('icons/terminal.svg'));	
		newExternalProgram.addEventListener('click', () => {
			let newNode = {
				type: "externalProgram",
				title:i18n("NewExternalProgram"),
				id: gen(),
				path:"/path/to/your/app \"{searchTerms}\"",
				searchRegex:"",
				contexts:[32],
				parent: li.node.parent,
				toJSON: li.node.toJSON
			}
			
			nodeInsertAfter(newNode, li.node);
			
			let newLi = traverse(newNode, li.parentNode);
			li.parentNode.insertBefore(newLi, li.nextSibling);
			newLi.scrollIntoView({block: "start", behavior:"smooth"});
			newLi.dispatchEvent(new MouseEvent('dblclick'));
			
			updateNodeList();
		});

		let newTool = createMenuItem(i18n('NewTool'), browser.runtime.getURL('icons/add.svg'));	
		newTool.onclick = function(e) {

			closeSubMenus();
			e.stopImmediatePropagation();
			e.preventDefault();
			
			let _menu = document.createElement('div');
			_menu.className = 'contextMenu subMenu';
			
			// position to the right of opening div
			let rect = newTool.getBoundingClientRect();
			_menu.style.left = rect.x + window.scrollX + rect.width - 20 + "px";
			_menu.style.top = rect.y + window.scrollY + "px";

			QMtools.sort( (a,b) => a.title > b.title ).forEach( t => {
				let m = createMenuItem(t.title, t.icon);
				m.className = 'menuItem';

				m.addEventListener('click', e => {
					let newNode = {
						type: "tool",
						title: t.title,
						tool:t.name,
						icon:t.icon,
						parent: li.node.parent,
						toJSON: li.node.toJSON
					}
					
					nodeInsertAfter(newNode, li.node);
					
					let newLi = traverse(newNode, li.parentNode);
					li.parentNode.insertBefore(newLi, li.nextSibling);
					newLi.scrollIntoView({block: "start", behavior:"smooth"});
					
					updateNodeList();
				//	closeContextMenus();
				})

				_menu.appendChild(m);
			});

			// _menu.appendChild(document.createElement('br'));

			// let m = createMenuItem("Regex", "icons/regex.svg");
			// m.addEventListener('click', e => {
			// 	let newNode = {
			// 		type: "folder",
			// 		title: "match regex",
			// 		icon: "icons/regex.svg",
			// 		id: "___matching___",
			// 		children:[],
			// 		parent: li.node.parent,
			// 		toJSON: li.node.toJSON
			// 	}
				
			// 	nodeInsertAfter(newNode, li.node);
				
			// 	let newLi = traverse(newNode, li.parentNode);
			// 	li.parentNode.insertBefore(newLi, li.nextSibling);
			// 	newLi.scrollIntoView({block: "start", behavior:"smooth"});
				
			// 	updateNodeList();
			// //	closeContextMenus();
			// });

			// m.className = 'menuItem';
			// _menu.appendChild(m);

			// let m2 = createMenuItem("Recent", "icons/history.svg");
			// m2.addEventListener('click', e => {
			// 	let newNode = {
			// 		type: "folder",
			// 		title: "recent",
			// 		icon: "icons/history.svg",
			// 		id: "___recent___",
			// 		children:[],
			// 		parent: li.node.parent,
			// 		toJSON: li.node.toJSON
			// 	}
				
			// 	nodeInsertAfter(newNode, li.node);
				
			// 	let newLi = traverse(newNode, li.parentNode);
			// 	li.parentNode.insertBefore(newLi, li.nextSibling);
			// 	newLi.scrollIntoView({block: "start", behavior:"smooth"});
				
			// 	updateNodeList();
			// //	closeContextMenus();
			// });

			// m2.className = 'menuItem';
			// _menu.appendChild(m2);

			document.body.appendChild(_menu);
			openMenu(_menu);
		};

		let newMultisearch = createMenuItem(i18n('newMultiSearch'), browser.runtime.getURL('icons/repeatsearch.svg'));	
		newMultisearch.addEventListener('click', e => {

			e.stopImmediatePropagation();

			//console.log(selectedRows.map(r => r.node.title));

			let templates = selectedRows.filter(r => !['siteSearchFolder', 'separator'].includes(r.node.type)).map( r => r.node.id);
			let names = selectedRows.map( r => r.node.title);

			let newNode = addNewEngine(li.node, false);

			if ( newNode ) {
				let newLi = addNode(newNode, li);

				let se = userOptions.searchEngines.find(se => se.id === newNode.id);

				se.template = JSON.stringify(templates);
				se.description = JSON.stringify(names);
				updateNodeList(true);
					
				newLi.scrollIntoView({block: "start", behavior:"smooth"});
				newLi.dispatchEvent(new MouseEvent('dblclick'));
			}

			closeContextMenus();
			
		});

		let exportNodes = createMenuItem(i18n('export'), browser.runtime.getURL('icons/download.svg'));	
		exportNodes.addEventListener('click', e => {

			e.stopImmediatePropagation();

			// filter child rows if parent is selected
			selectedRows = selectedRows.filter( r => !selectedRows.find(_r => _r !== r && _r.contains(r)));

			let nodes = selectedRows.map( r => JSON.parse(JSON.stringify(r.node)));

			nodes.forEach( node => {
				findNodes(node, n => {
					if ( n.type === 'searchEngine' ) {
						n.searchEngine = userOptions.searchEngines.find(se => se.id === n.id);
					}
				})
			});

			let json = JSON.stringify({exportedNodes: nodes});
			var blob = new Blob([json], {type: "application/json"});
			var url  = URL.createObjectURL(blob);

			let filename = prompt("Choose a filename");

			if ( !/.json$/i.filename )
				filename += ".json";

			var a = document.createElement('a');
			a.href        = url;
			a.download    = filename;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		 	closeContextMenus();
			
		});

		let cbs = document.querySelectorAll('.selectCheckbox:checked');

		if ( cbs.length ) selectedRows = [...cbs].map( cb => cb.closest("LI"));

		// attach options to menu
		[edit, hide, newFolder, newEngine, newMultisearch, newTool, newExternalProgram, newSeparator, newScript, copy, _delete, exportNodes].forEach( el => {
			el.className = 'menuItem';
			menu.appendChild(el);
			el.addEventListener('click', closeContextMenus);
		});
		
		// disable some menu items when multiple rows are selected
		if ( selectedRows.length > 1 ) {
			[edit, newFolder, newEngine, newSeparator, newScript, copy, newExternalProgram, newTool].forEach( el => {
				el.disabled = true;
				el.style.opacity = .5;
			});
		}

		if ( selectedRows.length < 2 ) {
			[newMultisearch].forEach( el => el.style.display = 'none')
		}

		// remove some options when using button
		if ( buttonAdd ) [edit, hide, copy, _delete].forEach( el => el.parentNode.removeChild(el));

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
		
	function clearSelectedRows() {
		table.querySelectorAll('.selected').forEach( row => row.classList.remove('selected') );
		selectedRows = [];
	}

	function addNode(node, li) {
		if ( !node || !li ) {
			console.log("node or parent does not exist");
			return false;
		}

		nodeInsertAfter(node, li.node);

		let newLi = traverse(node, li.parentNode);
		li.parentNode.insertBefore(newLi, li.nextSibling);

		return newLi;
	}
	
	function addNewEngine(node, copy) {
		
		copy = copy || false;
		
		// if node is defined, make copy
		let se = (copy) ? Object.assign({},userOptions.searchEngines.find( _se => _se.id === node.id )) : false;
		let default_value = (copy) ? se.title + " copy" : "";
		
		let msg = i18n("EnterUniqueName");
		let shortName = "";

		while(true) {
			if (! (shortName = window.prompt(msg, default_value)) || !shortName.trim() ) return;

			let found = false;
			
			for (let engine of userOptions.searchEngines) {
				if (engine.title == shortName) {
					console.log(engine.title + "\t" + shortName);
					msg = i18n("EngineExists").replace("%1",engine.title) + " " + i18n("EnterUniqueName");
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
			contexts:[32],
			toJSON: node.toJSON
		}
	}
	
	document.getElementById('b_addSearchEngine').addEventListener('click', e => {
		e.stopPropagation();
		contextMenuHandler(e);
	});
	
	document.getElementById('b_resetAllSearchEngines').addEventListener('click', async() => {
		
		if ( !confirm(i18n("ConfirmResetAllSearchEngines")) ) return;
		
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
		location.reload();
	});

	function addIconPickerListener(el, li) {
		imageUploadHandler(el, img => {
			let form = el.closest('form');;
			form.iconURL.value = imageToBase64(img, userOptions.cacheIconsMaxSize);
		//	li.querySelector("img").src = form.iconURL.value;

			form.querySelector('[name="faviconBox"] img').src = form.iconURL.value;
		//	form.save.click();
		})
	}

	let main_ec = $('#collapseAll');
	main_ec.onclick = function() {
		if ( main_ec.expand ) {
			table.querySelectorAll('UL .collapse').forEach(c => c.expand());
			main_ec.expand = false;
		} else {
			table.querySelectorAll('UL .collapse').forEach(c => c.collapse());
			main_ec.expand = true;
		}
	}
}

async function removeNodesAndRows() {

	// let edit_form = document.getElementById('editSearchEngineForm');
	// selectedRows.forEach( row => {
	// 	if ( row.contains(edit_form)) {
	// 		edit_form.style.maxHeight = null;
	// 		document.body.appendChild(edit_form);
	// 	}
	// })

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

function updateNodeList(forceSave) {
	
	forceSave = forceSave || false;
	
	let currentNodeTree = JSON.parse(JSON.stringify(rootElement.node));
	
//	if ( JSON.stringify(currentNodeTree) != JSON.stringify(userOptions.nodeTree) || forceSave) {
		// console.log('nodeTrees unequal. Saving');
		userOptions.nodeTree = currentNodeTree
		saveOptions();
//	} else {
		// console.log('node trees are the same - skipping save');
	//}
}

function addFormListeners(form) {

	form.addEventListener('input', e => {
		form.save.classList.add('changed');
		form.saveclose.classList.add('changed');
	});

	form.closeForm = () => {
		
		let formContainer = $('#floatingEditFormContainer');

		if ( !formContainer ) return;
		
		formContainer.parentNode.style.opacity = 0;
		$('#main').classList.remove('blur');
		runAtTransitionEnd(formContainer, "opacity", () => {
		//	form.style.display = null;
		//	document.body.appendChild(form);
			document.body.removeChild(formContainer.parentNode);
		});
	}

	form.addFaviconBox = (url) => {
		let box = form.querySelector('[name="faviconBox"]');
		box.innerHTML = null;
		let img = new Image();
		img.src = url;
		box.appendChild(img);
		box.classList.add('inputNice');
		box.classList.add('upload');

		form.iconPicker.id = form.id + 'IconPicker';

		let forlabel = document.createElement('label');
		forlabel.setAttribute('for', form.iconPicker.id);
		forlabel.title = i18n('uploadfromlocal');
		box.insertBefore(forlabel, box.firstChild);

		img.onload = () => {
			let label = document.createElement('div');
			label.innerText = img.naturalHeight + " x " + img.naturalWidth;
			box.appendChild(label);
		}
	}

	// update the favicon when the user changes the url
	form.iconURL.addEventListener('change', e => {

		let defaultIcon = getIconFromNode({type:form.node.type});

		let img = form.querySelector('[name="faviconBox"] img');
		img.src = form.iconURL.value || defaultIcon;
	})

	form.save.addEventListener('click', e => {
		form.save.classList.remove('changed');
		form.saveclose.classList.remove('changed');
	});
}

function setContexts(f, c) {
	let contexts = f.querySelectorAll('.contexts INPUT');
	contexts.forEach( cb => cb.checked = ((c & parseInt(cb.value)) == cb.value) );			
}

function getContexts(f) {
	let contexts = f.querySelectorAll('.contexts INPUT:checked');

	if ( !contexts || !contexts.length ) return [];
	return [...contexts].map(c => parseInt(c.value)).reduce( (a,b) => a + b);
}

async function setRowContexts(row) {
	try {
		let node = row.node;

		if ( !("contexts" in node ) ) return;

		let cc = row.querySelector('.contextIcons');
		cc.innerHTML = null;

		let show = ( ( userOptions.quickMenuUseContextualLayout || userOptions.contextMenuUseContextualLayout ) && userOptions.searchEnginesManagerShowContexts );

		cc.style.display = show ? null : 'none';

		contexts.forEach( async c => {

			let tool = createMaskIcon("icons/" + c + ".svg");
			tool.classList.add('contextIcon');
			tool.title = i18n(c);

			if ( !hasContext(c, node.contexts))
				tool.classList.add('disabled');

			tool.onclick = function(e) {

				e.stopPropagation();

				let code = getContextCode(c);
				let status = hasContext(c, node.contexts);

				tool.classList.toggle('disabled', status);

				if ( status ) node.contexts -= code;
				else node.contexts += code;

				updateNodeList(true);
			}

			cc.appendChild(tool);
		});
	} catch ( error ) {
		console.log(error);
	}
}

function createFormContainer(form) {

	let overdiv = document.createElement('div');
	overdiv.className = 'overDiv';
	overdiv.style.opacity = 0;
	document.body.appendChild(overdiv);

	// chrome fix for menu closing on text select events
	overdiv.onmousedown = e => {
		if ( overdiv !== e.target) return;
		overdiv.mousedown = true;
	}

	overdiv.onclick = e => {
		if ( !overdiv.mousedown ) return;
		if ( overdiv !== e.target) return;

		if ( form.save.classList.contains('changed')) {
			return;
		}
		form.close.click();
	}

	let formContainer = document.createElement('div');
	formContainer.id = "floatingEditFormContainer";

	overdiv.appendChild(formContainer);
	formContainer.appendChild(form);

	form.style.display = "block";

	$('#main').classList.add('blur');

	overdiv.getBoundingClientRect();
	overdiv.style.opacity = null;

	form.save.classList.remove('changed');
	form.saveclose.classList.remove('changed');
}

function getFormIcon(form) {

	return new Promise(resolve => {

		let newIcon = new Image();

		newIcon.onload = function() {
			resolve(imageToBase64(this, userOptions.cacheIconsMaxSize));
		}
		newIcon.onerror = function() {	
			resolve(form.iconURL.value);
		}
		setTimeout(() => resolve(form.iconURL.value), 5000);

		newIcon.src = getIconSourceFromURL(form.iconURL.value);
	});
}

function getIconSourceFromURL(_url) {
	if ( /^generate:/.test(_url) ) {
		try {
			let url = new URL(_url.replace(/#/g, "%23"));

			// https://stackoverflow.com/a/8649003
			let obj = JSON.parse('{"' + url.searchParams.toString().replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) });

			return createCustomIcon(obj);
		} catch (err) {
			return _url;
		}
	} else {
		return _url;
	}
}

document.addEventListener('keydown', e => {
	if ( e.key === 'f' && e.ctrlKey ) {
		e.preventDefault();
		$('#searchEnginesManagerSearch').focus();
		$('#searchEnginesManagerSearch').scrollIntoView();
	}
});

document.addEventListener('keydown', e => {

	if ( document.activeElement && document.activeElement.nodeName === 'INPUT' ) return;
	if ( window.listeningForHotkey ) return;

	if ( e.key === 'Delete' && selectedRows.length ) {
		e.preventDefault();

		let nodesToDelete = [];	
		selectedRows.forEach( row => {
			nodesToDelete = nodesToDelete.concat(findNodes(row.node, n => true));
		});

		if ( confirm(i18n("deleteNodesMessage", nodesToDelete.length)) ) {
			removeNodesAndRows();
		}
	}
});

$('#searchEnginesManagerSearch').addEventListener('keyup', e => {

	debounce(() => {

		let labels = document.querySelectorAll('.label');

		if ( e.key === "Escape" ) {
			labels.forEach( label => {
				let li = label.closest('li');
				li.style.display = null;
				label.parentNode.style.display = null;
			});

			e.target.value = null;

			return;
		}

		for ( let label of labels ) {
			let li = label.closest('li');
			li.style.display = null;
			label.parentNode.style.display = null;
			if ( !e.target.value ) continue;
			if ( !label.innerText.toLowerCase().includes(e.target.value.toLowerCase())) {
				if ( li.node.type === "folder" ) label.parentNode.style.display = 'none';
				else li.style.display = 'none';
			} else {
				// show folder hierarchy
				li.closest("UL").parentNode.querySelector('.header').style.display = null;
			}
		}
	}, 500, "searchEnginesManagerSearchTimer");
});

$('#searchEnginesManagerSearchClearButton').addEventListener('click', e => {
	$('#searchEnginesManagerSearch').value = "";
	$('#searchEnginesManagerSearch').dispatchEvent(new KeyboardEvent('keyup'))
})
