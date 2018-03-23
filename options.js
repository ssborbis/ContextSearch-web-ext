// array for storage.local
var searchEngines = [];
var userOptions = {};

let button = document.getElementById("selectMozlz4FileButton");
button.onchange = (ev) => {
	
	searchEngines = [];
	let file = ev.target.files[0];
	readMozlz4File(file, (text) => { // on success

		// parse the mozlz4 JSON into an object
		var engines = JSON.parse(text).engines;	
		searchEngines = searchEngineObjectToArray(engines);

		document.getElementById('status_div').style.display='';
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
						
		for (let i=0;i<searchEngines.length;i++) {
			let se = searchEngines[i];
			if (!old_names.includes(se.title)) {
				console.log(se.title + " not included in userOptions.searchEngines");
				newEngines.push(se);
			}
		}
		// end 1.3.2+
		
		loadRemoteIcons({
			searchEngines: newEngines, // 1.3.2+
//			searchEngines: searchEngines,
			callback: (details) => {

				searchEngines = userOptions.searchEngines.concat(details.searchEngines);
				
//				searchEngines = details.searchEngines;
				saveOptions();
				
				if (details.hasFailedCount) {
					statusMessage({
						img: "icons/alert.png",
						msg: "Failed to load " + details.hasFailedCount + " icon(s). This can occur when Tracking Protection is enabled"
					});
				} else if (details.hasTimedOut) {
					statusMessage({
						img: "icons/alert.png",
						msg: "Fetching icons timed out. Some icons were not loaded."
					});
				} else {
					statusMessage({
						img: "icons/yes.png",
						msg: "Success!  Imported " + details.searchEngines.length + " new search engine(s)"
					});
				}
					
				if (window.location.href.match(/#quickload$/) !== null) {
					browser.runtime.sendMessage({action: "closeWindowRequest"});
				}
				
				buildSearchEngineContainer(searchEngines);
				
				
			/*	
				document.getElementById('searchEngineWarningDivContainer').style.display = "none";
				var el = document.getElementById('searchEngineWarningDiv');
				el.innerText = "";
				
				for (let i=0;i<searchEngines.length;i++) {
					if (searchEngines[i].queryCharset.toLowerCase() !== "utf-8") {
						document.getElementById('searchEngineWarningDivContainer').style.display = "inline-block";
						var p = document.createElement('p');
						p.style.marginLeft = "20px";
						p.innerText = "\u2022 " + searchEngines[i].title + " (" + searchEngines[i].queryCharset + ")";
						el.appendChild(p);
					}
				}
			*/
			}
		});

	}, function() { // on fail

		// print status message to Options page
		statusMessage({
			img: "icons/no.png",
			msg: "Failed to load search engines :("
		});
	});
};

function statusMessage(status) {				
	document.getElementById('status_img').src = status.img || "";
	document.getElementById('status').innerText = status.msg || "";
}

function buildSearchEngineContainer(searchEngines) {
	document.getElementById('searchEnginesContainer').innerHTML = null;
	
	function getToolIconIndex(element) {
		 let index = 0;
		 let toolIcons = document.getElementsByClassName('searchEngineRow');
		 for (let i=0;i<toolIcons.length;i++) {
			 if (toolIcons[i] === element) {
				index = i;
				break;
			}
		 }
		 
		 return index;
	}
	function trFromTarget(target) {
		// get TR
		let tr = target;
		while ( tr && tr.nodeName !== 'TR' ) {
			tr = tr.parentNode;
		}
		
		return tr;
	}
	function dragstart_handler(ev) {
	//	trFromTarget(ev.currentTarget).style.border = "dashed red";
		ev.dataTransfer.setData("text", getToolIconIndex(trFromTarget(ev.target)));
		ev.effectAllowed = "copyMove";
	}
	function dragover_handler(ev) {
		for (let icon of document.getElementsByClassName('searchEngineRow')) {
			icon.style=null;
		}
		
	//	trFromTarget(ev.target).style.backgroundColor='#ddd';
		trFromTarget(ev.target).style.outline = '2px solid #6ec179';
		trFromTarget(ev.target).style.opacity = .5;
		ev.preventDefault();
	}
	function drop_handler(ev) {
		ev.preventDefault();
		let tr = trFromTarget(ev.target);
		tr.style = null;
		let old_index = ev.dataTransfer.getData("text");
		let new_index = getToolIconIndex(tr);
		
//		console.log(old_index);
//		console.log(new_index);

		if (new_index > old_index)
			document.getElementById('searchEnginesContainer').insertBefore(document.getElementsByClassName('searchEngineRow')[old_index],tr.nextSibling);			
		else
			document.getElementById('searchEnginesContainer').insertBefore(document.getElementsByClassName('searchEngineRow')[old_index],tr);
		
		let se = searchEngines.splice(old_index,1)[0];

		searchEngines.splice( new_index, 0, se );
		
		console.log(searchEngines);
		
	}
	function dragend_handler(ev) {
		saveOptions();
		ev.dataTransfer.clearData();
	}
	
//	console.log(searchEngines);
				
	for (let i=0;i<searchEngines.length;i++) {
		let se = searchEngines[i];
		
		if (se.hidden === undefined) se.hidden = false;
		
		let move = document.createElement('div');
		move.style.display='inline-block';
		move.style.width='16px';
		move.style.height='16px';
		move.style.cursor='move';
		move.innerHTML = "<b>&varr;</b>";
		move.style.textAlign = 'center';
		
		let icon = document.createElement('img');
		icon.style.width = "16px";
		icon.style.padding = '2px';
		icon.style.verticalAlign = 'middle';
		icon.src = se.icon_base64String;
		
		let edit = document.createElement('img');
		edit.title = 'edit';
		edit.src = 'icons/edit.png';
		edit.style.height = '20px';
		edit.style.opacity = .5;
		edit.onclick = function() {
			return;
		//	alert('edit function under construction');
		}
		
		let _delete = document.createElement('img');
		_delete.title = 'delete';
		_delete.src = '/icons/delete.png';
		_delete.style.height = '20px';
		_delete.style.margin = '0 4px';
		_delete.style.opacity = .5;
		_delete.onclick = function() {
			_delete.style.display = 'none';
			
			let msg = document.createElement('span');
			msg.innerText = 'Delete?';
			
			let yes = document.createElement('button');
			yes.innerText = 'yes';
			yes.onclick = function() {
				
				let r = trFromTarget(this);
				let index = getToolIconIndex(r);
				console.log('deleting index ' + index);
				searchEngines.splice(index,1);
				r.parentNode.removeChild(r);
				
			}
			
			let no = document.createElement('button');
			no.innerText = 'no';
			no.onclick = function() {
		//		no.parentNode.removeChild(msg);
				no.parentNode.removeChild(yes);
				no.parentNode.removeChild(no);
				_delete.style.display = null;
			}
			
		//	_delete.parentNode.appendChild(msg);
			_delete.parentNode.appendChild(no);
			_delete.parentNode.appendChild(yes);
			
		}
		
		let hide = document.createElement('label');
		hide.title = 'show/hide';
		hide.className = 'container';
		hide.style.display = 'inline';
		hide.style.textAlign = 'center';
		hide.style.paddingRight = '20px';
		hide.style.paddingLeft = '0';
		
		let cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.checked = !se.hidden;
		cb.addEventListener('change', () => {
			searchEngines[getToolIconIndex(trFromTarget(cb))].hidden = !cb.checked;
			console.log(getToolIconIndex(trFromTarget(cb)) + ' hidden is ' + !cb.checked);
			saveOptions();
		});
		
		let sp = document.createElement('span');
		sp.className = 'checkmark checkmark2';
		sp.style.textAlign = 'center';
		
		hide.appendChild(cb);
		hide.appendChild(sp);

		let template = document.createElement('input');
		template.style.width = "auto";
		template.value = se.query_string;
		
		let title = document.createElement('div');
		title.style.display = 'inline-block';
		title.style.width = "450px";
		title.style.border = 'none';
		title.style.overflowX = 'hidden';
		title.innerText = se.title;
		title.style.userSelect = "none";
		title.style.cursor = 'default';
		
		let params = document.createElement('input');
		params.style.width = 'auto';
		params.value = function() {
			if (se.method === "GET") return "";
			let str = '';
			for (let p of se.params) {
				str+= '&' + p.name + "=" + p.value;
			}
			
			return str.slice(1);
		}();
		
		let method = document.createElement('select');
		method.innerHTML = "<option value='GET'>GET</option><option value='POST'>POST</option>";
		method.selectedIndex = (se.method === "GET") ? 0 : 1;
		
		let encoding = document.createElement('select');
		encoding.innerHTML = '<option value="UTF-8">utf-8</option>\
			<option value="WINDOWS-1252">windows-1252</option>\
			<option value="SHIFT_JIS">shift_jis</option>\
			<option value="ISO-2022-JP">iso-2022-jp</option>\
			<option value="EUC-JP">euc-jp</option>\
			<option value="WINDOWS-1250">windows-1250</option>\
			<option value="WINDOWS-1251">windows-1251</option>\
			<option value="WINDOWS-850">windows-850</option>\
			<option value="MACINTOSH">macintosh</option>\
			<option value="ISO-8859-5">iso-8859-5</option>\
			<option value="ISO-8859-2">iso-8859-2</option>';//\
//			<option value="GB2312">gb2312</option>';

		encoding.value = se.queryCharset;
		if (!encoding.value) {
			let o = document.createElement('option');
			o.value = se.queryCharset.toUpperCase();
			o.innerText = se.queryCharset.toLowerCase();
			encoding.appendChild(o);
			encoding.value = o.value;
		}
		
		let row = document.createElement('tr');
		row.style.width = "auto";
		row.style.outline = '1px solid #F3F3F3';
		
		row.className = 'searchEngineRow';
		row.setAttribute('draggable', true);
		row.setAttribute('text', i); 
		
		row.addEventListener('dragstart',dragstart_handler);
		row.addEventListener('dragend',dragend_handler);
		row.addEventListener('drop',drop_handler);
		row.addEventListener('dragover',dragover_handler);
		
		[hide, icon, title, _delete/*, template, method, encoding, params */].forEach(function(element) {
		//	element.style.border = '1px solid #F3F3F3';
			element.style.verticalAlign = 'middle';
			let td = document.createElement('td');
			td.appendChild(element);
			row.appendChild(td);
			
		});
		
		document.getElementById('searchEnginesContainer').appendChild(row);
		
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
		document.getElementById('r_quickMenuAuto').checked = userOptions.quickMenuAuto;
		document.getElementById('cb_quickMenuAutoOnInputs').checked = userOptions.quickMenuAutoOnInputs;
		document.getElementById('r_quickMenuOnClick').checked = userOptions.quickMenuOnClick;
		document.getElementById('cb_quickMenuCloseOnScroll').checked = userOptions.quickMenuCloseOnScroll,
		document.getElementById('cb_quickMenuCloseOnClick').checked = userOptions.quickMenuCloseOnClick,
		document.getElementById('range_quickMenuScale').value = userOptions.quickMenuScale;
		document.getElementById('i_quickMenuScale').value = (parseFloat(userOptions.quickMenuScale) * 100).toFixed(0) + "%";
		document.getElementById('n_quickMenuOffsetX').value = userOptions.quickMenuOffset.x;
		document.getElementById('n_quickMenuOffsetY').value = userOptions.quickMenuOffset.y;	
		document.getElementById('h_mouseButton').value = userOptions.quickMenuMouseButton;
		
		if (document.getElementById('h_mouseButton').value == 3)
			document.getElementById('img_rightMouseButton').style.opacity = 1;
		else if (document.getElementById('h_mouseButton').value == 1)
			document.getElementById('img_leftMouseButton').style.opacity = 1;
		
		document.getElementById('cb_contextMenu').checked = userOptions.contextMenu;
		document.getElementById('i_searchJsonPath').value = userOptions.searchJsonPath.replace("/search.json.mozlz4","");
		document.getElementById('h_position').value = userOptions.quickMenuPosition;

		for (let p of document.getElementsByClassName('position')) {
			p.className = p.className.replace(' active', '');
			if (p.dataset.position === userOptions.quickMenuPosition)
				p.className+=' active';
		}
		
		buildToolIcons();

		// reload method radio buttons
		for (let el of document.getElementsByName('reloadMethod')) {
			if (el.value === userOptions.reloadMethod) {
				document.getElementById('manual').style.display='none';
				document.getElementById('automatic').style.display='none';
				document.getElementById(el.value).style.display='';
				el.checked = true;
				break;
			}
		}

		document.getElementById('s_contextMenuClick').value = userOptions.contextMenuClick;
		document.getElementById('s_contextMenuShift').value = userOptions.contextMenuShift;
		document.getElementById('s_contextMenuCtrl').value = userOptions.contextMenuCtrl;
		
		document.getElementById('cb_contextMenuShowAddCustomSearch').checked = userOptions.contextMenuShowAddCustomSearch;
		
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

	var getting = browser.runtime.sendMessage({action: "getUserOptions"});
	getting.then(onGot, onError);
	
}

function saveOptions(e) {

	function onSet() {
		browser.runtime.sendMessage({action: "updateUserOptions", "userOptions": userOptions}).then(() => {
		/*	if (e && e.target.id === "i_searchJsonPath") {
				browser.storage.local.set({'searchObject_last_mod': ''}).then(()=> {
					let gettingPage = browser.runtime.getBackgroundPage().then((w) => {
						w.nativeApp(true);
					});
				});
			}*/
		});
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
		quickMenuMouseButton: parseInt(document.getElementById('h_mouseButton').value),
		quickMenuAuto: document.getElementById('r_quickMenuAuto').checked,
		quickMenuAutoOnInputs: document.getElementById('cb_quickMenuAutoOnInputs').checked,
		quickMenuOnClick: document.getElementById('r_quickMenuOnClick').checked,
		quickMenuScale: parseFloat(document.getElementById('range_quickMenuScale').value),
		quickMenuOffset: {x: parseInt(document.getElementById('n_quickMenuOffsetX').value), y: parseInt(document.getElementById('n_quickMenuOffsetY').value)},
		quickMenuCloseOnScroll: document.getElementById('cb_quickMenuCloseOnScroll').checked,
		quickMenuCloseOnClick: document.getElementById('cb_quickMenuCloseOnClick').checked,
		quickMenuPosition: document.getElementById('h_position').value,
		
		contextMenuClick: document.getElementById('s_contextMenuClick').value,
		contextMenuShift: document.getElementById('s_contextMenuShift').value,
		contextMenuCtrl: document.getElementById('s_contextMenuCtrl').value,
		
		contextMenuShowAddCustomSearch: document.getElementById('cb_contextMenuShowAddCustomSearch').checked,
		
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
		reloadMethod: function() {
			for (let el of document.getElementsByName('reloadMethod')) {
				if (el.checked) return el.value;
			}
			return null;
		}()
	}

	var setting = browser.storage.local.set({"userOptions": userOptions});
	setting.then(onSet, onError);
}

function changeButtons(e, button) {
	var el = e.target;
	document.getElementById('img_rightMouseButton').style.opacity = .4;
	document.getElementById('img_leftMouseButton').style.opacity = .4;
	el.style.opacity = 1;	
	document.getElementById('h_mouseButton').value = button;
	saveOptions(e);
}

document.addEventListener("DOMContentLoaded", makeTabs());
document.addEventListener("DOMContentLoaded", restoreOptions);

document.getElementById('cb_contextMenu').addEventListener('change', saveOptions);
document.getElementById('cb_contextMenuShowAddCustomSearch').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenu').addEventListener('change', saveOptions);

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

for (let el of document.getElementsByTagName('select'))
	el.addEventListener('change', saveOptions);

document.getElementById('cb_quickMenuCloseOnScroll').addEventListener('change', saveOptions);
document.getElementById('cb_quickMenuCloseOnClick').addEventListener('change', saveOptions);

document.getElementById('img_rightMouseButton').addEventListener('click', (ev) => {changeButtons(ev,3)});
document.getElementById('img_leftMouseButton').addEventListener('click', (ev) => {changeButtons(ev,1)});

document.getElementById('range_quickMenuScale').addEventListener('input', (ev) => {
	document.getElementById('i_quickMenuScale').value = (parseFloat(ev.target.value) * 100).toFixed(0) + "%";
});

document.getElementById('range_quickMenuScale').addEventListener('change', saveOptions);
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
			el.innerText = response.error;
			el.style.color = 'red';
			return false;
		}
		
		el.innerText = "Success";
		el.style.color = 'blue';
		saveOptions();
	}
	
	function onError(error) {
		console.log(error);
		el.innerText = "Failed to load file (" + error.message + ") Is helper app installed?";
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
if (window.location.href.match(/#quickload$/) !== null) {

	for (let kid of document.body.children) 
		kid.style.display = 'none';
	
	var loadButton = document.getElementById('selectMozlz4FileButton');
	document.body.style.padding = "10px";
	document.body.appendChild(loadButton);
	document.title = "Reload Search Engines";
	
	loadButton.addEventListener('change', (ev) => {
		var img = document.createElement('img');
		img.src = 'icons/spinner.svg';
		img.style.height = '20px';
		img.style.width = '20px';
		document.body.appendChild(img);
	});
}

// Modify Options for BrowserAction
if (window.location.href.match(/#browser_action$/) !== null) {
	
	document.addEventListener("DOMContentLoaded", () => {
		document.getElementById('left_div').style.display = 'none';
		document.getElementById('right_div').style.width = "auto";
		let loadButton = document.getElementById("selectMozlz4FileButton");
		loadButton.onclick = (e) => {
			e.preventDefault();
			window.open('/options.html#quickload', 'Reload Search Engines', 'width=400,height=50,dependent=no,location=no,menubar=no,scrollbars=no,titlebar=no,status=no,toolbar=no');
		}
	});	
	
}

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

document.addEventListener("DOMContentLoaded", (e) => {
	for (let el of document.getElementsByName('reloadMethod')) {
		el.addEventListener('click', (e) => {
			document.getElementById('manual').style.display='none';
			document.getElementById('automatic').style.display='none';
			document.getElementById(el.value).style.display='';
		});
		el.addEventListener('change', saveOptions);
	}
});

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

document.addEventListener("DOMContentLoaded", () => {

	for (let el of document.getElementsByClassName('info')) {
		el.addEventListener('mouseover', (e) => {
			let div = document.getElementById('info_msg');
			div.innerText = el.dataset.msg;
			div.style.top = el.getBoundingClientRect().top + window.scrollY + 'px';
			div.style.left = el.getBoundingClientRect().left + window.scrollX + 20 + 'px';
			div.style.display = 'block';
		});
		
		el.addEventListener('mouseout', (e) => {
			document.getElementById('info_msg').style.display = 'none';
		});
	}
});

function buildSearchEngineList() {
	let html = "";
	for (let engine of userOptions.searchEngines) {
		html+=`<div class='searchEngineRow'><div `
	}
}