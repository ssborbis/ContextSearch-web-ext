// array for storage.local
var searchEngines = [];
var userOptions = {};

// Browse button for manual import
document.getElementById("selectMozlz4FileButton").addEventListener('change', (ev) => {
	
	searchEngines = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		searchEngines = searchJsonObjectToArray(engines);

		document.getElementById('status_div').style.display='inline-block';
		statusMessage({
			img: "icons/spinner.svg",
			msg: browser.i18n.getMessage("LoadingRemoteContent")
		});
		
		// start 1.3.2+
		let old_names = [];
		for (let se of userOptions.searchEngines) {
			old_names.push(se.title);
		}
		
		let newEngines = [];
		for (let se of searchEngines) {
			if (!old_names.includes(se.title)) {
				console.log(se.title + " not included in userOptions.searchEngines");
				newEngines.push(se);
			}
		}
		// end 1.3.2+
		
		loadRemoteIcons({
			searchEngines: newEngines, // 1.3.2+
			callback: (details) => {

				searchEngines = userOptions.searchEngines.concat(details.searchEngines);
				saveOptions();
				
				if (details.hasFailedCount) {
					statusMessage({
						img: "icons/alert.png",
						msg: browser.i18n.getMessage("LoadingRemoteContentFail").replace("%1", details.hasFailedCount)
					//	msg: "Failed to load " + details.hasFailedCount + " icon(s). This can occur when Tracking Protection is enabled"
					});
				} else if (details.hasTimedOut) {
					statusMessage({
						img: "icons/alert.png",
						msg: browser.i18n.getMessage("LoadingRemoteContentTimeout")
					});
				} else {
					statusMessage({
						img: "icons/yes.png",
						msg: browser.i18n.getMessage("ImportedEngines").replace("%1", searchEngines.length).replace("%2", details.searchEngines.length)
						//msg: "Imported " + searchEngines.length + " engine(s) (" + details.searchEngines.length + " new)"
					});
				}
					
				if (window.location.hash === '#quickload') {
					browser.runtime.sendMessage({action: "closeWindowRequest"});
				}
				
				buildSearchEngineContainer(searchEngines);
			}
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/no.png",
			msg: "Failed to load search engines :("
		});
	});
	
	function statusMessage(status) {				
		document.getElementById('status_img').src = status.img || "";
		document.getElementById('status').innerText = status.msg || "";
	}
});

function buildSearchEngineContainer(searchEngines) {
	
	// hide and detach the edit_form
	let edit_form = document.getElementById('editSearchEngineContainer');
	edit_form.style.maxHeight = null;
	document.body.appendChild(edit_form);
		
	// clear the table
	let se_container = document.getElementById('searchEnginesContainer');
	se_container.innerHTML = null;
	
	// display Delete All button
	let deleteAllButton = document.getElementById('b_deleteAllSearchEngines');
	if (searchEngines.length > 0) deleteAllButton.style.display = null;
	deleteAllButton.onclick = function() {
		if (confirm(browser.i18n.getMessage("RemoveAllEnginesPrompt"))) {
			
			// necessary to bypass check in saveOptions
			searchEngines = [];
			userOptions.searchEngines = [];
			saveOptions();
			buildSearchEngineContainer([]);
			
			CSBookmarks.removeAll();
		}
	}
	
	function addNewEngine(i) {
		
		let se = (i !== undefined) ? Object.assign({},searchEngines[i]) : false;
		let default_value = (se) ? se.title + " copy" : "";
		
		let msg = browser.i18n.getMessage("EnterUniqueName");
		let shortName = "";

		while(true) {
			if (! (shortName = window.prompt(msg, default_value)) || !shortName.trim() ) return;

			let found = false;
			
			for (let engine of searchEngines) {
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
			searchEngines.splice(i+1,0,se);
			
		} else {

			searchEngines.push({
				"searchForm": "", 
				"query_string":"",
				"icon_url":"",
				"title":shortName,
				"order":searchEngines.length, 
				"icon_base64String": "", 
				"method": "GET", 
				"params": "", 
				"template": "", 
				"queryCharset": "UTF-8", 
				"hidden": false
			});
		}
		
		saveOptions();
		
		function scrollToEnd() {
			se_container.parentNode.scroll({
				top: se_container.parentNode.scrollHeight,
				behavior:'smooth'
			});
		}
		
		buildSearchEngineContainer(searchEngines);
		let titles = document.getElementsByClassName('title');
		let title = (se) ? titles[i+1] : titles[titles.length - 1];

		if (!se) scrollToEnd();

		title.dispatchEvent(new Event('click'));
		
		// wait for animation to end
		setTimeout(() => {
			if (!se) scrollToEnd();
		},500);
	}
	
	let b_addSearchEngine = document.getElementById('b_addSearchEngine');
	b_addSearchEngine.onclick = function() {addNewEngine();}
	
	function getToolIconIndex(element) {
		 let toolIcons = document.getElementsByClassName('searchEngineRow');
		 for (let i=0;i<toolIcons.length;i++) {
			 if (toolIcons[i] === element) {
				return i;
			}
		 }
		 
		 return -1;
	}
	function nearestParent( tagName, target ) {
		while ( target && target.nodeName.toUpperCase() !== tagName.toUpperCase() ) {
			target = target.parentNode;
		}
		
		return target;
	}
	function dragstart_handler(ev) {
		ev.dataTransfer.setData("text", getToolIconIndex(nearestParent("TR",ev.target)));
		ev.effectAllowed = "copyMove";
	}
	function dragover_handler(ev) {
		let row = nearestParent("TR",ev.target);
		row.style.outline = '2px solid #6ec179';
		row.style.opacity = .5;
		ev.preventDefault();
	}
	function dragleave_handler(ev) {
		nearestParent("TR",ev.target).style=null;
	}
	function drop_handler(ev) {
		ev.preventDefault();
		let tr = nearestParent("TR",ev.target);
		tr.style = null;
		let old_index = ev.dataTransfer.getData("text");
		let new_index = getToolIconIndex(tr);

		if (new_index > old_index)
			se_container.insertBefore(document.getElementsByClassName('searchEngineRow')[old_index],tr.nextSibling);			
		else
			se_container.insertBefore(document.getElementsByClassName('searchEngineRow')[old_index],tr);
		
		let se = searchEngines.splice(old_index,1)[0];

		searchEngines.splice( new_index, 0, se );	
	}
	function dragend_handler(ev) {
		saveOptions();
		ev.dataTransfer.clearData();
	}
	
	// get Bookmark
	let bookmarkNames = [];
	let bookmarkNamesPromise = CSBookmarks.getNames().then( (names) => {
		bookmarkNames = names;
	});
	
	// build table
	for (let i=0;i<searchEngines.length;i++) {
		let se = searchEngines[i];
		
		if (se.hidden === undefined) se.hidden = false;
	
		let icon = document.createElement('img');
		icon.className = 'icon';
		icon.src = se.icon_base64String;
		
		// searchEngine name
		let title = document.createElement('div');
		title.title = browser.i18n.getMessage('ClickToEdit').toLowerCase();
		//title.title = 'click to edit';
		title.className = 'title';
		
		// let input = document.createElement('input');
		// input.style = 'border:none;width:100%;cursor:default';
		// input.onfocus = function(e) {
			// console.log('yep');
			// e.preventDefault();
			// e.target.blur();
			// return false;
		// }
		// input.onclick = function(e) {
			
		// }
		// input.value = se.title;
		// title.appendChild(input);
		
		title.innerText = se.title;
		
		title.onclick = function() {
			
			// close if open on same TR
			if (nearestParent("TR",edit_form) === nearestParent("TR",title) && edit_form.style.maxHeight) {
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
			
			edit_form.addEventListener('mouseover', () => {
				nearestParent("TR",edit_form).setAttribute('draggable', 'false');
			});
			
			edit_form.addEventListener('mouseout', () => {
				nearestParent("TR",edit_form).setAttribute('draggable', 'true');
			});
			
			edit_form.cancel.onclick = function() {
				edit_form.style.maxHeight = null;
			}
			
			edit_form.copy.onclick = function() {
				let r = nearestParent("TR",this);
				let index = getToolIconIndex(r);
				
				addNewEngine(index);
			}
			
			edit_form.save.onclick = function() {

				function showError(el, msg) {
					el.previousSibling.innerText = msg;
					el.previousSibling.style.color = "red";
					el.classList.add("error");
				}
				
				function saveForm() {
					// loading icon is last step. Set values after everything else
						
					// alert of problems with changing name
					if (se.title !== edit_form.shortName.value) {

						if ( confirm(browser.i18n.getMessage('NameChangeWarning')) ) {
							CSBookmarks.rename(se.title, edit_form.shortName.value);
							se.title = edit_form.shortName.value;
							
							edit_form.previousSibling.innerText = se.title;
						}
					}
					
					se.icon_base64String = icon.src;
					se.query_string = se.template = edit_form.template.value;
					se.searchForm = edit_form.searchform.value;
					se.icon_url = edit_form.iconURL.value;
					se.method = edit_form._method.value;
					se.queryCharset = edit_form._encoding.value;
					se.params = paramStringToNameValueArray(edit_form.post_params.value);
					
					saveOptions();
					edit_form.style.maxHeight = null;
				}

				// Check bad form values
				if ( !edit_form.shortName.value.trim() ) {
					showError(edit_form.shortName,browser.i18n.getMessage('NameInvalid'));
					return;
				}
				for (let engine of userOptions.searchEngines) {
					if (engine.title == edit_form.shortName.value) {
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
					showError(edit_form.searchform,browser.i18n.getMessage("FormPathURLError"));
					return;
				}
				if (edit_form.post_params.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'POST' ) {
					showError(edit_form.post_params, browser.i18n.getMessage("POSTIncludeError"));
					return;
				}
				if (edit_form.iconURL.value.match(/^resource:/) === null) {
					icon.src = browser.runtime.getURL("/icons/spinner.svg");
					let newIcon = new Image();
					newIcon.onload = function() {
						icon.src =  imageToBase64(this, 32);
						saveForm();
					}
					newIcon.onerror = function() {
						icon.src = se.icon_base64String;
						showError(edit_form.iconURL,browser.i18n.getMessage("IconLoadError"));
					}
					newIcon.src = edit_form.iconURL.value;
				}
			}
			
			// clear error formatting on focus
			for (let element of edit_form.getElementsByTagName('input')) {
				element.addEventListener('focus', () => {
					clearError( element );
				});
			}

			// attach form to title cell
			title.parentNode.appendChild(edit_form);
			
			// reflow trick
			edit_form.getBoundingClientRect();
			edit_form.style.maxHeight = '400px';
		}
		
		let _delete = document.createElement('img');
		_delete.title = browser.i18n.getMessage('Delete').toLowerCase();
		_delete.className = 'delete';
		_delete.src = '/icons/delete.png';
		_delete.onclick = function(e) {
			e.stopPropagation();
			_delete.style.display = 'none';
			
			let yes = document.createElement('button');
			let no = document.createElement('button');

			yes.innerText = browser.i18n.getMessage('Yes').toLowerCase(); no.innerText = browser.i18n.getMessage('No').toLowerCase();
			//yes.innerText = 'yes'; no.innerText = 'no';
			
			yes.onclick = function(ev) {
				ev.stopPropagation(); // prevents closing edit_form

				let r = nearestParent("TR",this);
				
				// move the edit form if attached to prevent deletion
				if (r === nearestParent("TR", edit_form)) {
					edit_form.style.maxHeight = null;
					document.body.appendChild(edit_form);
				}
				
				let index = getToolIconIndex(r);
				console.log('deleting index ' + index);
				CSBookmarks.remove(searchEngines[index].title);
				searchEngines.splice(index,1);
				r.parentNode.removeChild(r);	
				saveOptions();
			}

			no.onclick = function(ev) {
				ev.stopPropagation(); // prevents closing edit_form
				no.parentNode.removeChild(yes);
				no.parentNode.removeChild(no);
				_delete.style.display = null;
			}
			
			let span = document.createElement('span');
			span.className = 'delete';
			span.appendChild(no);
			span.appendChild(yes);

			_delete.parentNode.appendChild(span);
	
		}
		
		title.appendChild(_delete);
		
		// let add_search = document.createElement('img');
		// add_search.src = '/icons/add_search.png';
		// add_search.className = 'add_search';
		// add_search.title = 'add to firefox search toolbar';
		
		// add_search.onclick = function(e) {
			// e.stopPropagation();
			
			// let r = nearestParent("TR",this);
			// let index = getToolIconIndex(r);

			// let url = "https://opensearch-api.appspot.com" 
				// + "?SHORTNAME=" + encodeURIComponent(se.title)
				// + "&DESCRIPTION=" + encodeURIComponent(se.title) 
				// + "&TEMPLATE=" + encodeURIComponent(encodeURI(se.template))
				// + "&POST_PARAMS=" + encodeURIComponent(se.params) 
				// + "&METHOD=" + encodeURIComponent(se.method)
				// + "&ENCODING=" + encodeURIComponent(se.queryCharset)
				// + "&ICON=" + encodeURIComponent(encodeURI(new URL(se.template).origin + "/favicon.ico"))
				// + "&ICON_WIDTH=" + 16 
				// + "&ICON_HEIGHT=" + 16
				// + "&SEARCHFORM=" + encodeURIComponent(encodeURI(se.searchForm))
				// + "&VERSION=" + encodeURIComponent(browser.runtime.getManifest().version);
				
			// browser.runtime.sendMessage({action: "addSearchEngine", url:url});
		// }
		
		// title.appendChild(add_search);
		
		let hide = document.createElement('label');
		hide.title = browser.i18n.getMessage('ShowHide').toLowerCase();
		//hide.title = 'show/hide';
		hide.className = 'container hide';
		
		let cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.checked = !se.hidden;
		cb.addEventListener('change', () => {
			se.hidden = !cb.checked;
			saveOptions();
		});
		
		let sp = document.createElement('span');
		sp.className = 'checkmark checkmark2';
		sp.style.textAlign = 'center';
		
		hide.appendChild(cb);
		hide.appendChild(sp);
		
		let bookmark = document.createElement('span');
		bookmark.title = browser.i18n.getMessage('Bookmark').toLowerCase();
		//bookmark.title = 'bookmark';
		bookmark.className = 'checkboxImage';
		
		// Hide if disabled
		if (!userOptions.contextMenuBookmarks)
			bookmark.style.display='none';
		
		let bm_cb = document.createElement('input');
		bm_cb.type = 'checkbox';
		bm_cb.id = 'bm_cb' + i;
		
		bookmarkNamesPromise.then(()=>{
			bm_cb.checked = bookmarkNames.includes(se.title);
		});

		bm_cb.addEventListener('change', () => {

			if (bm_cb.checked)
				CSBookmarks.add(se);
			if (!bm_cb.checked)
				CSBookmarks.remove(se.title);
			
			saveOptions();

		});
		
		let bm_label = document.createElement('label');
		bm_label.setAttribute('for',bm_cb.id);
		bm_label.innerHTML = '<img src="/icons/bookmark.png" />';
		
		bookmark.appendChild(bm_cb);
		bookmark.appendChild(bm_label);
		
		let row = document.createElement('tr');
		
		row.className = 'searchEngineRow';
		row.setAttribute('draggable', true);
		row.setAttribute('text', i); 
		
		row.addEventListener('dragstart',dragstart_handler);
		row.addEventListener('dragend',dragend_handler);
		row.addEventListener('drop',drop_handler);
		row.addEventListener('dragover',dragover_handler);
		row.addEventListener('dragleave',dragleave_handler);
		
		[hide, bookmark, icon, title].forEach( (element) => {

			let td = document.createElement('td');
			td.appendChild(element);
			row.appendChild(td);
			
		});
		
		se_container.appendChild(row);
		
	}
}

function restoreOptions() {

	function onGot(result) {
		
		userOptions = result.userOptions || {};

		document.getElementById('cb_quickMenu').checked = userOptions.quickMenu;	
		document.getElementById('n_quickMenuColumns').value = userOptions.quickMenuColumns;
		document.getElementById('n_quickMenuItems').value = userOptions.quickMenuItems;	
		document.getElementById('b_quickMenuKey').value = userOptions.quickMenuKey;
		document.getElementById('b_quickMenuKey').innerText = keyTable[userOptions.quickMenuKey] || "Set";
		document.getElementById('r_quickMenuOnKey').checked = userOptions.quickMenuOnKey;
		document.getElementById('cb_quickMenuOnHotkey').checked = userOptions.quickMenuOnHotkey;
		
		document.getElementById('d_hotkey').appendChild(keyArrayToButtons(userOptions.quickMenuHotkey));
		
		document.getElementById('cb_quickMenuOnMouse').checked = userOptions.quickMenuOnMouse;
		document.getElementById('s_quickMenuOnMouseMethod').value = userOptions.quickMenuOnMouseMethod;
		document.getElementById('cb_quickMenuSearchOnMouseUp').checked = userOptions.quickMenuSearchOnMouseUp;
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		document.getElementById('cb_quickMenuAutoOnInputs').checked = userOptions.quickMenuAutoOnInputs;
		document.getElementById('cb_quickMenuCloseOnScroll').checked = userOptions.quickMenuCloseOnScroll,
		document.getElementById('cb_quickMenuCloseOnClick').checked = userOptions.quickMenuCloseOnClick,
		document.getElementById('s_quickMenuSearchBar').value =  userOptions.quickMenuSearchBar,
		document.getElementById('cb_quickMenuSearchBarFocus').checked = userOptions.quickMenuSearchBarFocus,
		document.getElementById('cb_quickMenuSearchBarSelect').checked = userOptions.quickMenuSearchBarSelect,
		document.getElementById('range_quickMenuScale').value = userOptions.quickMenuScale;
		document.getElementById('range_quickMenuIconScale').value = userOptions.quickMenuIconScale;
		document.getElementById('i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		document.getElementById('i_quickMenuIconScale').value = (parseFloat(userOptions.quickMenuIconScale) * 100).toFixed(0) + "%";
		document.getElementById('n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		document.getElementById('n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;
		
		document.getElementById('s_quickMenuMouseButton').value = userOptions.quickMenuMouseButton.toString();
		document.getElementById('cb_contextMenu').checked = userOptions.contextMenu;
		document.getElementById('i_searchJsonPath').value = userOptions.searchJsonPath.replace("/search.json.mozlz4","");
		document.getElementById('h_position').value = userOptions.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.className = p.className.replace(' active', '');
			if (p.dataset.position === userOptions.quickMenuPosition)
				p.className+=' active';
		}
		
		buildToolIcons();

		document.getElementById('cb_automaticImport').checked = (userOptions.reloadMethod === 'automatic')

		document.getElementById('s_contextMenuClick').value = userOptions.contextMenuClick;
		document.getElementById('s_contextMenuShift').value = userOptions.contextMenuShift;
		document.getElementById('s_contextMenuCtrl').value = userOptions.contextMenuCtrl;
		
		document.getElementById('cb_contextMenuShowAddCustomSearch').checked = userOptions.contextMenuShowAddCustomSearch;
		document.getElementById('cb_contextMenuBookmarks').checked = userOptions.contextMenuBookmarks;
		
		document.getElementById('s_quickMenuLeftClick').value = userOptions.quickMenuLeftClick;
		document.getElementById('s_quickMenuRightClick').value = userOptions.quickMenuRightClick;
		document.getElementById('s_quickMenuMiddleClick').value = userOptions.quickMenuMiddleClick;
		document.getElementById('s_quickMenuShift').value = userOptions.quickMenuShift;
		document.getElementById('s_quickMenuCtrl').value = userOptions.quickMenuCtrl;
		document.getElementById('s_quickMenuAlt').value = userOptions.quickMenuAlt;
		
		buildSearchEngineContainer(userOptions.searchEngines);

	}
  
	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.runtime.getBackgroundPage();
	getting.then(onGot, onError);
	
}

function saveOptions(e) {

	function onSet() {
		browser.runtime.sendMessage({action: "updateUserOptions", "userOptions": userOptions});
	}
	
	function onError(error) {
		console.log(`Error: ${error}`);
	}
	
	userOptions = {
		searchEngines: (searchEngines.length > 0) ? searchEngines : userOptions.searchEngines,
		quickMenu: document.getElementById('cb_quickMenu').checked,
		quickMenuColumns: parseInt(document.getElementById('n_quickMenuColumns').value),
		quickMenuItems: parseInt(document.getElementById('n_quickMenuItems').value),
		quickMenuKey: parseInt(document.getElementById('b_quickMenuKey').value),
		quickMenuOnKey: document.getElementById('r_quickMenuOnKey').checked,
		quickMenuOnHotkey: document.getElementById('cb_quickMenuOnHotkey').checked,
		quickMenuHotkey: function() {
			let buttons = document.getElementById('d_hotkey').querySelectorAll('[data-keycode]');
			if (!buttons) return [];
			let arr = [];
			for (let button of buttons)
				arr.push(parseInt(button.dataset.keycode));
			return arr;
		}(),
		quickMenuOnMouse: document.getElementById('cb_quickMenuOnMouse').checked,
		quickMenuOnMouseMethod: document.getElementById('s_quickMenuOnMouseMethod').value,
		quickMenuSearchOnMouseUp: document.getElementById('cb_quickMenuSearchOnMouseUp').checked,
		quickMenuMouseButton: parseInt(document.getElementById("s_quickMenuMouseButton").value),
		quickMenuAuto: document.getElementById('r_quickMenuAuto').checked,
		quickMenuAutoOnInputs: document.getElementById('cb_quickMenuAutoOnInputs').checked,
		quickMenuScale: parseFloat(document.getElementById('range_quickMenuScale').value),
		quickMenuIconScale: parseFloat(document.getElementById('range_quickMenuIconScale').value),
		quickMenuOffset: {x: parseInt(document.getElementById('n_quickMenuOffsetX').value), y: parseInt(document.getElementById('n_quickMenuOffsetY').value)},
		quickMenuCloseOnScroll: document.getElementById('cb_quickMenuCloseOnScroll').checked,
		quickMenuCloseOnClick: document.getElementById('cb_quickMenuCloseOnClick').checked,
		quickMenuPosition: document.getElementById('h_position').value,
		contextMenuClick: document.getElementById('s_contextMenuClick').value,
		contextMenuShift: document.getElementById('s_contextMenuShift').value,
		contextMenuCtrl: document.getElementById('s_contextMenuCtrl').value,
		contextMenuShowAddCustomSearch: document.getElementById('cb_contextMenuShowAddCustomSearch').checked,
		contextMenuBookmarks: document.getElementById('cb_contextMenuBookmarks').checked,
		quickMenuLeftClick: document.getElementById('s_quickMenuLeftClick').value,
		quickMenuRightClick: document.getElementById('s_quickMenuRightClick').value,
		quickMenuMiddleClick: document.getElementById('s_quickMenuMiddleClick').value,
		quickMenuShift: document.getElementById('s_quickMenuShift').value,
		quickMenuCtrl: document.getElementById('s_quickMenuCtrl').value,
		quickMenuAlt: document.getElementById('s_quickMenuAlt').value,
		quickMenuSearchBar: document.getElementById('s_quickMenuSearchBar').value,
		quickMenuSearchBarFocus: document.getElementById('cb_quickMenuSearchBarFocus').checked,
		quickMenuSearchBarSelect: document.getElementById('cb_quickMenuSearchBarSelect').checked,
		contextMenu: document.getElementById('cb_contextMenu').checked,
		searchJsonPath: function () {
			let path = document.getElementById('i_searchJsonPath').value;
			if (path.match(/\/search.json.mozlz4$/) === null && path != "")
				path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
			return path;
		}(),
		quickMenuTools: function() {
			let tools = [];
			for (let toolIcon of document.getElementsByClassName('toolIcon'))
				tools.push({"name": toolIcon.name, "disabled": toolIcon.disabled})			
			return tools;
		}(),
		reloadMethod: (document.getElementById('cb_automaticImport').checked) ? 'automatic' : 'manual'

	}

//	var setting = browser.storage.local.set({"userOptions": userOptions});
	var setting = browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});
	setting.then(onSet, onError);
}

document.addEventListener("DOMContentLoaded", makeTabs());
document.addEventListener("DOMContentLoaded", restoreOptions);

document.getElementById('cb_contextMenu').addEventListener('change', saveOptions);
document.getElementById('cb_contextMenuShowAddCustomSearch').addEventListener('change', saveOptions);
document.getElementById('cb_contextMenuBookmarks').addEventListener('change', (e) => {
	
	if (e.target.checked) {
		
		// permission popups do not work from the browser action panel
		if (window.location.hash === '#browser_action') {
			browser.runtime.sendMessage({action:'openOptions'});
			window.close();
			return;
		}
		if (browser.bookmarks === undefined)
			alert(browser.i18n.getMessage("BookmarksPermissionMessage"));
		
		CSBookmarks.requestPermissions().then( (result) => {
			if (result) {
				saveOptions();
				buildSearchEngineContainer(userOptions.searchEngines);
			} else
				e.target.checked = false;
		});
	} else {
		saveOptions();
		buildSearchEngineContainer(userOptions.searchEngines);
	}
	
});

document.getElementById('cb_quickMenu').addEventListener('change', saveOptions);
// document.getElementById('cb_quickMenu').addEventListener('change', (e) => {
	// showInfoMsg(e.target.parentNode, "Reload tabs for changes to take effect");
	// setTimeout(() => {
		// document.getElementById('info_msg').style.display = 'none';
	// }, 5000);
	
// });

document.getElementById('n_quickMenuColumns').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 4, 1, 100);
	saveOptions(e);
});

document.getElementById('n_quickMenuItems').addEventListener('change',  (e) => {
	fixNumberInput(e.target, 100, 1, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetX').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('n_quickMenuOffsetY').addEventListener('change', (e) => {
	fixNumberInput(e.target, 0, -999, 999);
	saveOptions(e);
});

document.getElementById('cb_quickMenuOnMouse').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnKey').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuOnHotkey').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuAuto').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuAutoOnInputs').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuSearchOnMouseUp').addEventListener('change', saveOptions);
document.getElementById('cb_automaticImport').addEventListener('change', saveOptions);

//document.getElementById('s_quickMenuSearchBar').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuSearchBarFocus').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuSearchBarSelect').addEventListener('change', saveOptions);

for (let el of document.getElementsByTagName('select'))
	el.addEventListener('change', saveOptions);

//document.getElementById('s_quickMenuMouseButton').addEventListener('change', saveOptions);
//document.getElementById('s_quickMenuOnMouseMethod').addEventListener('change', saveOptions);

document.getElementById('cb_quickMenuCloseOnScroll').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuCloseOnClick').addEventListener('change', saveOptions);

document.getElementById('range_quickMenuScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
document.getElementById('range_quickMenuScale').addEventListener('change', saveOptions);

document.getElementById('range_quickMenuIconScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuIconScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});
document.getElementById('range_quickMenuIconScale').addEventListener('change', saveOptions);
document.getElementById('b_checkSearchJsonPath').addEventListener('click', checkSearchJsonPath);
document.getElementById('i_searchJsonPath').addEventListener('change', checkSearchJsonPath);
document.getElementById('i_searchJsonPath').addEventListener('keydown', (ev) => {
	if (
		ev.repeat ||
		ev.which !== 13
	) return false;
	
	ev.target.blur();
});
function checkSearchJsonPath() {
	let el = document.getElementById('div_searchJsonPathResponse');
	let ev_target = document.getElementById('i_searchJsonPath');
	
	el.innerText = browser.i18n.getMessage("Validating");
	
	ev_target.value = ev_target.value.replace(/\\/g, "/").trim();
	if (ev_target.value == "") {
		el.innerText = "";
		return false;
	}
	
	let path = ev_target.value;
	
	if (path.match(/\/search.json.mozlz4$/) === null) {
		path+=(path.charAt(path.length -1) === "/") ? "search.json.mozlz4" : "/search.json.mozlz4";
	}
	
	console.log(path);
	
	function onResponse(response) {
		
		if (response.error) {
			el.innerHTML = "<img src='/icons/no.png' style='height:30px;vertical-align:middle;' />&nbsp;&nbsp;&nbsp;";
			let span = document.createElement('span');
			span.innerText = response.error;
			el.appendChild(span);
			return false;
		}

		let tn = document.createTextNode("   " + browser.i18n.getMessage("ImportSuccessful"));
		el.innerHTML = "<img src='/icons/yes.png' style='height:16px;vertical-align:middle;' />";
		el.appendChild(tn);
		
		saveOptions();

		browser.runtime.getBackgroundPage().then((w) => { 
		
			// prevent double execution from blur + import button click
			if (w.nativeAppActive) return;
		
			w.nativeApp({force: true}).then(() => {
				console.log('building search engine container');
				buildSearchEngineContainer(w.userOptions.searchEngines);
			});
		});
	}
	
	function onError(error) {
		console.log(error);
		el.innerHTML = "<img src='/icons/yes.png' style='height:30px;vertical-align:middle;' />&nbsp;&nbsp;&nbsp;";
		el.textContent = browser.i18n.getMessage("NativeAppImportError").replace("%1", error.message);
		el.style.color = 'red';
	}
	
	if (typeof browser.runtime.sendNativeMessage === 'function') {
		var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + path + '"}');
		sending.then(onResponse, onError);
	}
	
}

document.getElementById('b_quickMenuKey').addEventListener('click', (e) => {
	e.target.innerText = '';
	var img = document.createElement('img');
	img.src = 'icons/spinner.svg';
	e.target.appendChild(img);
	e.target.addEventListener('keydown', function(evv) {
		evv.preventDefault();
		e.target.innerText = keyTable[evv.which];
		e.target.value = evv.which;
		saveOptions(e);
		}, {once: true} // parameter to run once, then delete
	); 
});

function fixNumberInput(el, _default, _min, _max) {

	if (isNaN(el.value) || el.value === "") el.value = _default;
	if (!el.value.isInteger) el.value = Math.floor(el.value);
	if (el.value > _max) el.value = _max;
	if (el.value < _min) el.value = _min;
}

function keyArrayToButtons(arr) {
	
	let div = document.createElement('div');
	
	if (arr.length === 0) {
		div.innerText = 'Click To Set';
	}
	
	for (let i=0;i<arr.length;i++) {

		let hk = arr[i]
		let span = document.createElement('span');
		let key = keyTable[hk];
		if (key.length === 1) key = key.toUpperCase();
		
		span.innerText = key;
		span.dataset.keycode = hk;
		span.className = 'keyboardButton';
		span.style = 'min-width:auto;padding:3px 10px;';
		div.appendChild(span);
		
		if ( i + 1 < arr.length) {
			let p = document.createElement('span');
			p.innerHTML = '&nbsp;&nbsp;+&nbsp;&nbsp;';
			div.appendChild(p);
		}
	}
	
	return div;
}

// Modify Options for quickload popup
document.addEventListener('DOMContentLoaded', () => {

	if (window.location.hash === '#quickload') {
		history.pushState("", document.title, window.location.pathname);
		
		document.querySelector('button[data-tabid="enginesTab"]').click();
		document.getElementById('selectMozlz4FileButton').click();
	}
});

// switch to tab based on params
document.addEventListener('DOMContentLoaded', () => {
	
	let params = new URLSearchParams(location.search);

	if (params.get('tab') === 'help')
		document.querySelector('button[data-tabid="helpTab"]').click();
	
	if (params.get('tab') === 'searchengines')
		document.querySelector('button[data-tabid="enginesTab"]').click();

});

// Modify Options for BrowserAction
document.addEventListener("DOMContentLoaded", () => {
	if (window.location.hash === '#browser_action') {
		document.getElementById('left_div').style.display = 'none';
		document.getElementById('right_div').style.width = "auto";
		let loadButton = document.getElementById("selectMozlz4FileButton");
		loadButton.onclick = (e) => {
			browser.runtime.sendMessage({action:"openOptions", hashurl:"#quickload"});
			e.preventDefault();
		}
	}
});

function makeTabs() {
	
	let tabs = document.getElementsByClassName("tablinks");
	for (let tab of tabs) {
		tab.addEventListener('click', (e) => {

			for (let tabcontent of document.getElementsByClassName("tabcontent"))
				tabcontent.style.display = "none";
			
			for (let _tab of tabs)
				_tab.getElementsByTagName('img')[0].style.display='none';
			
			e.target.getElementsByTagName('img')[0].className = 'fade-in';
			e.target.getElementsByTagName('img')[0].style.display='inline-block';
				
			// Get all elements with class="tablinks" and remove the class "active"
			for (let tablink of document.getElementsByClassName("tablinks")) 
				tablink.className = tablink.className.replace(" active", "");

			// Show the current tab, and add an "active" class to the button that opened the tab
			document.getElementById(e.target.dataset.tabid).style.display = "block";
			e.currentTarget.className += " active";
		});
	}
	tabs[0].click();
}

function buildToolIcons() {
	function getToolIconIndex(element) {
		 let index = 0;
		 let toolIcons = document.getElementsByClassName('toolIcon');
		 for (let i=0;i<toolIcons.length;i++) {
			 if (toolIcons[i] === element) {
				index = i;
				break;
			}
		 }
		 
		 return index;
	}
	function dragstart_handler(ev) {
		ev.currentTarget.style.border = "dashed transparent";
		ev.dataTransfer.setData("text", getToolIconIndex(ev.target));
		ev.effectAllowed = "copyMove";
	}
	function dragover_handler(ev) {
		for (let icon of document.getElementsByClassName('toolIcon'))
			icon.style.backgroundColor='';
		
		ev.target.style.backgroundColor='#ddd';
		ev.preventDefault();
	}
	function drop_handler(ev) {
		ev.preventDefault();
		
		ev.target.style.border = '';
		ev.target.style.backgroundColor = '';
		let old_index = ev.dataTransfer.getData("text");
		let new_index = getToolIconIndex(ev.target);

		if (new_index > old_index) 
			ev.target.parentNode.insertBefore(document.getElementsByClassName('toolIcon')[old_index],ev.target.nextSibling);
		else
			ev.target.parentNode.insertBefore(document.getElementsByClassName('toolIcon')[old_index],ev.target);
	}
	function dragend_handler(ev) {
		ev.target.style.border = '';
		saveOptions();
		ev.dataTransfer.clearData();
	}
	
	let toolIcons = [
		{name: 'close', src: "icons/close.png", title: browser.i18n.getMessage('tools_Close'), index: Number.MAX_VALUE, disabled: true},
		{name: 'copy', src: "icons/clipboard.png", title: browser.i18n.getMessage('tools_Copy'), index: Number.MAX_VALUE, disabled: true},
		{name: 'link', src: "icons/link.png", title: browser.i18n.getMessage('tools_OpenAsLink'), index: Number.MAX_VALUE, disabled: true},
		{name: 'disable', src: "icons/power.png", title: browser.i18n.getMessage('tools_Disable'), index: Number.MAX_VALUE, disabled: true},
		{name: 'lock', src: "icons/lock.png", title: browser.i18n.getMessage('tools_Lock'), index: Number.MAX_VALUE, disabled: true}
	];
	
	for (let t=0;t<toolIcons.length;t++) {
		for (let i=0;i<userOptions.quickMenuTools.length;i++) {
			if (toolIcons[t].name === userOptions.quickMenuTools[i].name) {
				toolIcons[t].index = i;
				toolIcons[t].disabled = userOptions.quickMenuTools[i].disabled;
				break;
			}
		}
	}
	
	toolIcons = toolIcons.sort(function(a, b) {
		return (a.index < b.index) ? -1 : 1;
	});

	for (let icon of toolIcons) {
		let img = document.createElement('img');
		img.disabled = icon.disabled;
		img.style.opacity = (img.disabled) ? .4 : 1;
		img.className = 'toolIcon';
		img.setAttribute('draggable', true);
		img.src = icon.src;
		img.setAttribute('data-title',icon.title);
		img.name = icon.name;

		img.addEventListener('dragstart',dragstart_handler);
		img.addEventListener('dragend',dragend_handler);
		img.addEventListener('drop',drop_handler);
		img.addEventListener('dragover',dragover_handler);

		img.addEventListener('click',(e) => {
			e.target.disabled = e.target.disabled || false;
			e.target.style.opacity = e.target.disabled ? 1 : .4;
			e.target.disabled = !e.target.disabled;	
			saveOptions();
		});
		
		let t_toolIcons = document.getElementById('t_toolIcons');
		img.addEventListener('mouseover', (e) => {
			t_toolIcons.innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', (e) => {
			t_toolIcons.innerText = browser.i18n.getMessage(t_toolIcons.dataset.i18n);
		});

		document.getElementById('toolIcons').appendChild(img);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	for (let el of document.getElementsByClassName('position')) {
		el.addEventListener('click', (e) => {
			for (let _el of document.getElementsByClassName('position'))
				_el.className = _el.className.replace(' active', '');
			el.className+=' active';
			document.getElementById('h_position').value = el.dataset.position;
			saveOptions();
		});
		
		let t_position = document.getElementById('t_position');
		el.addEventListener('mouseover', (e) => {
			let parts = e.target.dataset.position.split(" ");
			t_position.innerText = browser.i18n.getMessage("PositionRelativeToCursor").replace("%1", browser.i18n.getMessage(parts[0])).replace("%2",browser.i18n.getMessage(parts[1]));
		});
		
		el.addEventListener('mouseout', (e) => {
			t_position.innerText = browser.i18n.getMessage(t_position.dataset.i18n);
		});
		
	}
	
});

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('version').innerText = "" + browser.runtime.getManifest().version;
});

// lite
document.addEventListener("DOMContentLoaded", (e) => {
	
	if (typeof browser.runtime.sendNativeMessage === 'function') return false;
	
	for (let el of document.getElementsByTagName('native'))
		el.style.display = 'none';
	
	setTimeout(() => {
		document.getElementById('manual').style.display='inline-block';
	}, 250);
});

function showInfoMsg(el, msg) {
	let div = document.getElementById('info_msg');
		
	let parsed = new DOMParser().parseFromString(msg, `text/html`);
	let tag = parsed.getElementsByTagName('body')[0];
				
	div.innerHTML = null;
	div.appendChild(tag.firstChild);

	div.style.top = el.getBoundingClientRect().top + window.scrollY + 10 + 'px';
	div.style.left = el.getBoundingClientRect().left + window.scrollX + 20 + 'px';
	
	if (el.getBoundingClientRect().left > ( window.innerWidth - 220) )
		div.style.left = parseFloat(div.style.left) - 230 + "px";
	
	div.style.display = 'block';
}

// set up info bubbles
document.addEventListener("DOMContentLoaded", () => {
	
	let i18n_tooltips = document.querySelectorAll('[data-i18n_tooltip]');
	
	for (let el of i18n_tooltips) {
		el.dataset.msg = browser.i18n.getMessage(el.dataset.i18n_tooltip + 'Tooltip');
	}
	
	for (let el of document.getElementsByClassName('info')) {
		el.addEventListener('mouseover', (e) => {
			showInfoMsg(el, el.dataset.msg);
		});
		
		el.addEventListener('mouseout', (e) => {
			document.getElementById('info_msg').style.display = 'none';
		});
	}
});

// import/export buttons
document.addEventListener("DOMContentLoaded", () => {
	
	function download(filename, text) {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);

		element.style.display = 'none';
		document.body.appendChild(element);

		element.click();

		document.body.removeChild(element);
	}
	
	let b_export = document.getElementById('b_exportSettings');
	b_export.onclick = function() {
		let text = JSON.stringify(userOptions);
		download("ContextSearchOptions.json", text);
	}
	
	let b_import = document.getElementById('b_importSettings');
	b_import.onclick = function() {
		if (window.location.hash === '#browser_action') {
			browser.runtime.sendMessage({action: "openOptions", hashurl:"?click=importSettings"});
			return;
		}
		document.getElementById('importSettings').click();
	}
	
	document.getElementById('importSettings').addEventListener('change', (e) => {
		var reader = new FileReader();

		// Closure to capture the file information.
		reader.onload = function() {
			try {
				let newUserOptions = JSON.parse(reader.result);
				
				// run a few test to check if it's valid
				if ( 
					typeof newUserOptions !== 'object'
					|| newUserOptions.quickMenu === undefined
					|| !newUserOptions.searchEngines
					
				) {
					alert(browser.i18n.getMessage("ImportSettingsNotFoundAlert"));
					return;
				}
				
				//v1.5.8
				if (newUserOptions.quickMenuOnClick !== undefined) {
					
					if (newUserOptions.quickMenuOnClick)
						newUserOptions.quickMenuOnMouseMethod = 'click';
					
					if (newUserOptions.quickMenuOnMouse)
						newUserOptions.quickMenuOnMouseMethod = 'hold';
					
					if (newUserOptions.quickMenuOnClick || newUserOptions.quickMenuOnMouse)
						newUserOptions.quickMenuOnMouse = true;
					
					delete newUserOptions.quickMenuOnClick;
				}

				browser.runtime.sendMessage({action: "getDefaultUserOptions"}).then((message) => {
					
					let defaultUserOptions = message.defaultUserOptions;

					for (let key in defaultUserOptions) {
						newUserOptions[key] = (newUserOptions[key] !== undefined) ? newUserOptions[key] : defaultUserOptions[key];
					}

					//browser.storage.local.set({"userOptions": newUserOptions}).then(() => {
					browser.runtime.sendMessage({action: "saveUserOptions", userOptions: newUserOptions}).then(() => {
						browser.runtime.sendMessage({action: "updateUserOptions"}).then(() => {
							location.reload();
						});
					});
				});

			} catch(err) {
				alert(browser.i18n.getMessage("InvalidJSONAlert"));
			}
		}

      // Read in the image file as a data URL.
      reader.readAsText(e.target.files[0]);
	});
});

// click element listed in the hash for upload buttons
document.addEventListener('DOMContentLoaded', () => {
	let params = new URLSearchParams(window.location.search);
	
	if (params.has('click')) {
		document.getElementById(params.get('click')).click();
		history.pushState("", document.title, window.location.pathname);
	}
});	

document.addEventListener('DOMContentLoaded', () => {

	function traverse(node) {
		
		if (node.nodeType === 3 && node.nodeValue.trim())
			return node;

		for (let child of node.childNodes) {
			let c = traverse(child);
			if (c) return c;
		}
		
		return false;
	}
	
	let i18n = document.querySelectorAll('[data-i18n]');
	
	for (let el of i18n) {

		let textNode = traverse(el);
		
		if (browser.i18n.getMessage(el.dataset.i18n))
			textNode.nodeValue = browser.i18n.getMessage(el.dataset.i18n);
	}
	
	
	// add locale-specific styling
	var link = document.createElement( "link" );
	link.href = browser.runtime.getURL('/_locales/' + browser.i18n.getUILanguage() + '/style.css');
	link.type = "text/css";
	link.rel = "stylesheet";
	document.getElementsByTagName( "head" )[0].appendChild( link );
	
	// set up localized help pages
	let help = document.getElementById('helpTab');
	
	let loaded = false;
	let iframe = document.createElement('iframe');
	
	iframe.style = 'display:none';
	iframe.onerror = function() {
		console.log('error');
	}
	
	iframe.onload = function() {
		console.log('loaded @ ' + iframe.src);
		var iframeDocument = iframe.contentDocument;
		var iframeBody = iframeDocument.body;
		
		const parser = new DOMParser();
		const parsed = parser.parseFromString(iframeBody.innerHTML, `text/html`);
		
		for (let child of parsed.getElementsByTagName('body')[0].childNodes) {
			help.appendChild(child);
		}

		help.removeChild(iframe);
	}
	
	setTimeout( () => {
		if (!loaded) {
			iframe.src = '/_locales/' + browser.runtime.getManifest().default_locale + '/help.html';
		}
	}, 250);
	
	iframe.src = '/_locales/' + browser.i18n.getUILanguage() + '/help.html';
	
	help.appendChild(iframe);

});

document.addEventListener('DOMContentLoaded', () => {
	
	let hk = document.getElementById('d_hotkey');
	hk.onclick = function() {
		
		hk.innerHTML = '<img src="/icons/spinner.svg" style="height:1em" /> ';
		hk.appendChild(document.createTextNode(browser.i18n.getMessage('PressKey')));
				
		document.addEventListener('keyup', (e) => {
			
			e.preventDefault();
			
			let keyArray = [];
			
			if (e.ctrlKey) keyArray.push(17);
			if (e.altKey) keyArray.push(18);
			if (e.shiftKey) keyArray.push(16);
			
			keyArray.push(e.keyCode);
			
			hk.innerHTML = null;
			hk.appendChild(keyArrayToButtons(keyArray));
			
			saveOptions();
			
		}, {once: true});
		
	}
});
	
