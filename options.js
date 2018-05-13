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
			msg: "Loading remote content"
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
						msg: "Failed to load " + details.hasFailedCount + " icon(s). This can occur when Tracking Protection is enabled"
					});
				} else if (details.hasTimedOut) {
					statusMessage({
						img: "icons/alert.png",
						msg: "Fetching remote icons timed out. Some icons were not loaded."
					});
				} else {
					statusMessage({
						img: "icons/yes.png",
						msg: "Imported " + searchEngines.length + " engine(s) (" + details.searchEngines.length + " new)"
					});
				}
					
				if (window.location.href.match(/#quickload$/) !== null) {
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
		if (confirm("Remove all search engines?")) {
			
			// necessary to bypass check in saveOptions
			searchEngines = [];
			userOptions.searchEngines = [];
			saveOptions();
			buildSearchEngineContainer([]);
			
			CSBookmarks.removeAll();
		}
	}
	
	let b_addSearchEngine = document.getElementById('b_addSearchEngine');
	b_addSearchEngine.onclick = function() {
		
		let msg = "Enter a unique name for this search engine";;
		let shortName = "";

		while(true) {
			if (! (shortName = window.prompt(msg)) || !shortName.trim() ) return;

			let found = false;
			
			for (let engine of searchEngines) {
				if (engine.title == shortName) {
					console.log(engine.title + "\t" + shortName);
					msg = engine.title + " exists. Enter a unique name for this search engine";
					found = true;
					break;
				}
			}
			
			if ( !found ) break;
		}

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
		
		saveOptions();
		
		buildSearchEngineContainer(searchEngines);
		let titles = document.getElementsByClassName('title');
		let title = titles[titles.length - 1];

		se_container.parentNode.scroll({
			top: se_container.parentNode.scrollHeight,
			behavior:'smooth'
		});

		title.dispatchEvent(new Event('click'));
		
		// wait for animation to end
		setTimeout(() => {
			se_container.parentNode.scroll({
				top: se_container.parentNode.scrollHeight,
				behavior:'smooth'
			});
		},500);
	}
	
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
		title.title = 'click to edit';
		title.className = 'title';
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
				if (label.dataset.label) label.innerText = label.dataset.label;
				label.style.color = null;
				clearError(label.nextSibling)
			}

//			edit_form.shortName.value = se.title;
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
			
			edit_form.save.onclick = function() {

				function showError(el, msg) {
					el.previousSibling.innerText = msg;
					el.previousSibling.style.color = "red";
					el.classList.add("error");
				}
				
				function saveForm() {
					// loading icon is last step. Set values after everything else
					se.icon_base64String = icon.src;
					se.query_string = edit_form.template.value;
					se.searchForm = edit_form.searchform.value;
					se.icon_url = edit_form.iconURL.value;
					se.method = edit_form._method.value;
					se.queryCharset = edit_form._encoding.value;
					se.params = paramStringToNameValueArray(edit_form.post_params.value);
					
					saveOptions();
					edit_form.style.maxHeight = null;
				}

				// Check bad form values
	/*			if ( !edit_form.shortName.value.trim() ) {
					showError(edit_form.shortName,'Engine name');
					return;
				}
				for (let engine of userOptions.searchEngines) {
					if (engine.title == edit_form.shortName.value) {
						showError(edit_form.shortName,"Engine name " + edit_form.shortName.value + '" already exists');
						return;
					}
				}
	*/
				if (edit_form.template.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'GET' ) {
					showError(edit_form.template,'Template must include {searchTerms}');
					return;
				}
				if (edit_form.template.value.match(/^http/i) === null) {
					showError(edit_form.template,'Template must be an URL');
					return;
				}
				if (edit_form.searchform.value.match(/^http/i) === null) {
					showError(edit_form.searchform,'Form path must be an URL');
					return;
				}
				if (edit_form.post_params.value.indexOf('{searchTerms}') === -1 && edit_form._method.value === 'POST' ) {
					showError(edit_form.post_params, 'POST params must include {searchTerms}');
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
						showError(edit_form.iconURL,'Icon failed to load');
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
			edit_form.style.maxHeight = '300px';
		}
		
		let _delete = document.createElement('img');
		_delete.title = 'delete';
		_delete.className = 'delete';
		_delete.src = '/icons/delete.png';
		_delete.onclick = function(e) {
			e.stopPropagation();
			_delete.style.display = 'none';
			
			let yes = document.createElement('button');
			let no = document.createElement('button');

			yes.innerText = 'yes'; no.innerText = 'no';
			
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
			
			_delete.parentNode.appendChild(no);
			_delete.parentNode.appendChild(yes);
			
		}
		
		title.appendChild(_delete);
		
		let hide = document.createElement('label');
		hide.title = 'show/hide';
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
		bookmark.title = 'bookmark';
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
		document.getElementById('r_quickMenuOnMouse').checked = userOptions.quickMenuOnMouse;
		document.getElementById('cb_quickMenuSearchOnMouseUp').checked = userOptions.quickMenuSearchOnMouseUp;
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		document.getElementById('cb_quickMenuAutoOnInputs').checked = userOptions.quickMenuAutoOnInputs;
		document.getElementById('r_quickMenuOnClick').checked = userOptions.quickMenuOnClick;
		document.getElementById('cb_quickMenuCloseOnScroll').checked = userOptions.quickMenuCloseOnScroll,
		document.getElementById('cb_quickMenuCloseOnClick').checked = userOptions.quickMenuCloseOnClick,
		document.getElementById('cb_quickMenuTrackingProtection').checked = userOptions.quickMenuTrackingProtection,
		document.getElementById('range_quickMenuScale').value = userOptions.quickMenuScale;
		document.getElementById('range_quickMenuIconScale').value = userOptions.quickMenuIconScale;
		document.getElementById('i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		document.getElementById('i_quickMenuIconScale').value = (parseFloat(userOptions.quickMenuIconScale) * 100).toFixed(0) + "%";
		document.getElementById('n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		document.getElementById('n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;
		
		document.querySelector('input[name="r_quickMenuMouseButton"][value="' + userOptions.quickMenuMouseButton + '"]' ).checked = true;

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
		quickMenuOnMouse: document.getElementById('r_quickMenuOnMouse').checked,
		quickMenuSearchOnMouseUp: document.getElementById('cb_quickMenuSearchOnMouseUp').checked,
		quickMenuMouseButton: parseInt(document.querySelector('input[name="r_quickMenuMouseButton"]:checked').value),
		quickMenuAuto: document.getElementById('r_quickMenuAuto').checked,
		quickMenuAutoOnInputs: document.getElementById('cb_quickMenuAutoOnInputs').checked,
		quickMenuOnClick: document.getElementById('r_quickMenuOnClick').checked,
		quickMenuScale: parseFloat(document.getElementById('range_quickMenuScale').value),
		quickMenuIconScale: parseFloat(document.getElementById('range_quickMenuIconScale').value),
		quickMenuOffset: {x: parseInt(document.getElementById('n_quickMenuOffsetX').value), y: parseInt(document.getElementById('n_quickMenuOffsetY').value)},
		quickMenuCloseOnScroll: document.getElementById('cb_quickMenuCloseOnScroll').checked,
		quickMenuCloseOnClick: document.getElementById('cb_quickMenuCloseOnClick').checked,
		quickMenuPosition: document.getElementById('h_position').value,
		quickMenuTrackingProtection: document.getElementById('cb_quickMenuTrackingProtection').checked,
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
		if (window.location.href.match(/#browser_action$/) !== null) {
			browser.runtime.sendMessage({action:'openOptions'});
			window.close();
			return;
		}
		if (browser.bookmarks === undefined)
			alert('After closing this prompt you will receive a prompt to accept a new permission for "Bookmarks".\n\nAccepting will add a new folder "ContextSearch Menu" containing your current search engines in bookmarks under the "Other Bookmarks" folder. There you can add separators and group bookmarks into subfolders.\n\nDo not rename the search engine bookmarks as this will cause them to stop working. Deleted bookmarks can be added again from ContextSearch Options->Search Engines. Clicking the bookmark icons in the search engine list can add or remove bookmarks.' );
		
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

document.getElementById('r_quickMenuOnMouse').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnKey').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuAuto').addEventListener('change', saveOptions);
document.getElementById('r_quickMenuOnClick').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuAutoOnInputs').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuSearchOnMouseUp').addEventListener('change', saveOptions);
document.getElementById('cb_automaticImport').addEventListener('change', saveOptions);

for (let el of document.getElementsByTagName('select'))
	el.addEventListener('change', saveOptions);

for (let el of document.getElementsByName('r_quickMenuMouseButton'))
	el.addEventListener('change', saveOptions);

document.getElementById('cb_quickMenuCloseOnScroll').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuCloseOnClick').addEventListener('change', saveOptions);

document.getElementById('cb_quickMenuTrackingProtection').addEventListener('change', saveOptions);

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
	
	el.innerText = "Validating ...";
	
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

		el.innerHTML = "<img src='/icons/yes.png' style='height:16px;vertical-align:middle;' />&nbsp;&nbsp;&nbsp;Import successful";
		
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
		el.textContent = "Failed to load file (" + error.message + ") Is app installed?";
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

// Modify Options for quickload popup
document.addEventListener('DOMContentLoaded', () => {
	if (window.location.href.match(/#quickload$/) !== null) {
		history.pushState("", document.title, window.location.pathname);
		var loadButton = document.getElementById('selectMozlz4FileButton');
		document.querySelector('button[data-tabid="enginesTab"]').click();
		loadButton.click();
	}
});

// Modify Options for quickload popup
document.addEventListener('DOMContentLoaded', () => {
	if (window.location.href.match(/#help$/) !== null) {
		document.querySelector('button[data-tabid="helpTab"]').click();
	}
});

// Modify Options for BrowserAction
document.addEventListener("DOMContentLoaded", () => {
	if (window.location.href.match(/#browser_action$/) !== null) {
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
		{name: 'close', src: "icons/close.png", title: "Close menu", index: Number.MAX_VALUE, disabled: true},
		{name: 'copy', src: "icons/clipboard.png", title: "Copy to clipboard", index: Number.MAX_VALUE, disabled: true},
		{name: 'link', src: "icons/link.png", title: "Open as link", index: Number.MAX_VALUE, disabled: true},
		{name: 'disable', src: "icons/power.png", title: "Disable menu", index: Number.MAX_VALUE, disabled: true},
		{name: 'lock', src: "icons/lock.png", title: "Lock menu open (multi-search)", index: Number.MAX_VALUE, disabled: true}
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
		
		let orig_text = document.getElementById('t_toolIcons').innerText;
		img.addEventListener('mouseover', (e) => {
			document.getElementById('t_toolIcons').innerText = e.target.dataset.title;
		});
		
		img.addEventListener('mouseout', (e) => {
			document.getElementById('t_toolIcons').innerText = orig_text;
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
		
		let orig_text = document.getElementById('t_position').innerText;
		el.addEventListener('mouseover', (e) => {
			document.getElementById('t_position').innerText = e.target.dataset.position + " of cursor";
		});
		
		el.addEventListener('mouseout', (e) => {
			document.getElementById('t_position').innerText = orig_text;
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

document.addEventListener("DOMContentLoaded", () => {
	if (window.location.href.match(/#searchengines$/) === null) return;

	for (let el of document.getElementsByClassName('tablinks')) {
		if (el.dataset.tabid && el.dataset.tabid === 'enginesTab') {
			el.dispatchEvent(new MouseEvent('click'));
			return;
		}
	}
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
		if (window.location.href.match(/#browser_action$/) !== null) {
			browser.runtime.sendMessage({action: "openOptions", hashurl:"#click_importSettings"});
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
					|| !newUserOptions.quickMenu
					|| !newUserOptions.searchEngines
					
				) {
					alert('ContextSearch settings not found!');
					return;
				}
				
				//browser.storage.local.set({"userOptions": newUserOptions}).then(() => {
				browser.runtime.sendMessage({action: "saveUserOptions", userOptions: newUserOptions}).then(() => {
					browser.runtime.sendMessage({action: "updateUserOptions"}).then(() => {
						location.reload();
					});
				});
				
				
			} catch(err) {
				alert('file is not valid JSON');
			}
		}

      // Read in the image file as a data URL.
      reader.readAsText(e.target.files[0]);
	});
});

// click element listed in the hash for upload buttons
if (window.location.href.match(/#click_.*$/) !== null) {
//	let el_name = window.location.href.
	let matches = /#click_(.*)$/g.exec(window.location.href);
	
	if (matches.length === 2) {
		document.addEventListener('DOMContentLoaded', () => {
			document.getElementById(matches[1]).click();
			history.pushState("", document.title, window.location.pathname);
		});
	}
		
}


