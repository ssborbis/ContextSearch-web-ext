// import_export.js
// Handles importing and exporting settings

function exportSettingsHandler(e) {

	function download(filename, json) {

		var blob = new Blob([json], {type: "application/json"});
		var url  = URL.createObjectURL(blob);

		var a = document.createElement('a');
		a.href        = url;
		a.download    = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	let uo = JSON.parse(JSON.stringify(userOptions));

	let pretty = uo.exportJsonPretty ? "\t" : null;

	let date = new Date().toISOString().replace(/:|\..*/g,"").replace("T", "_");
	
	if ( uo.exportWithoutBase64Icons ) {
		
		findNodes(uo.nodeTree, node => {
			if ( node.iconCache )
				node.iconCache = "";
			if ( node.type === "oneClickSearchEngine" )
				node.icon = "";
		});
	}

	// clear the old searchEngines array
	delete uo.searchEngines;

	// rebuild the searchEngines array for export
	uo = deunifyNodeTree(uo);

	download(`ContextSearchOptions_${date}.json`, JSON.stringify(uo, null, pretty));
}

function importSettingsHandler(e) {
	var reader = new FileReader();
	reader.onload = () => importSettings(reader.result);
	reader.readAsText(e.target.files[0]);
}

async function importSettings(fileContents) {

	let json = {};

	try {
		json = JSON.parse(fileContents);
	} catch(error) {
		console.log(error);
		return false;
	}

	// check for exported nodes
	importNodes: try {
		if ( !json.exportedNodes ) break importNodes;

		let uo = JSON.parse(JSON.stringify(userOptions));

		let folder = {
			type:"folder",
			children: json.exportedNodes,
			id:gen(),
			title: "Imported"
		}

		// convert to unified node tree
		for ( const n of folder.children ) {
			if ( n.searchEngine ) {
				n = Object.assign(n, n.searchEngine);
				delete n.searchEngine;
			}
		}

		// flatten
		folder.children = findNodes(folder, n => n.type !== 'folder' ); // findNodesDeep

		// get nodes with duplicate ids in userOptions.nodeTree
		let dupes = findNodes(folder, n => findNode(uo.nodeTree, _n => _n.id === n.id)); //findNodesDeep

		for ( let dupe of dupes ) {
			let result = await new Promise( res => {
				$('#importModalDuplicates').classList.remove('hide');
				$('#importModalDuplicates [name="message"]').innerText = dupe.title || dupe.type;

				$('#importModalDuplicates').querySelectorAll('BUTTON[name]').forEach( el => {
					el.addEventListener('click', e => res(el.name));
				})
			});

			if ( result === "skip" )
				removeNodesById(folder, dupe.id);

			if ( result === "cancel" ) {
				$('#importModalDuplicates').classList.add('hide');
				return;
			}

			if ( result === "replace" ) {
				let oldNode = findNode(uo.nodeTree, n => n.id === dupe.id );
				oldNode = JSON.parse(JSON.stringify(dupe));

				removeNodesById(folder, dupe.id);
			}

			if ( result === "merge" ) {
				// replace id 
				dupe.id = gen();
			}
				
			$('#importModalDuplicates').classList.add('hide');

		}

		if ( folder.children.length ) uo.nodeTree.children.push(folder);

		await sendMessage({action: "saveUserOptions", userOptions: uo});
		location.reload();

		return;

	} catch (error) { console.error(error)}

	chooseWhatToImport: try {
		let newUserOptions = JSON.parse(fileContents);
		
		// run a few test to check if it's valid
		if ( 
			typeof newUserOptions !== 'object'
			|| newUserOptions.quickMenu === undefined
			
		) {
			alert(i18n("ImportSettingsNotFoundAlert"));
			return;
		}

		if ( false && userOptions.advancedImport ) {

			$('#main').classList.add('blur');

			// let choice1 = await new Promise( res => {
			// 	$('#importModal').classList.remove('hide');

			// 	$('#importModal .replace').addEventListener('click', e => res("replace"));
			// 	$('#importModal .merge').addEventListener('click', e => res("merge"));
			// 	$('#importModal .cancel').addEventListener('click', e => res("cancel"));
			// });

			// $('#importModal').classList.add('hide');

			// if ( choice1 === "cancel" ) return;
			// if ( choice1 === "merge" ) {
			{
				await new Promise( res => {
					$('#importModalCustom').classList.remove('hide');
					$('#importModalCustom .ok').addEventListener('click', e => res("replace"));
					$('#importModalCustom .cancel').addEventListener('click', e => res("cancel"));

					let left_browser = $('#importModalCustom [name="nodes_left"]');
					let right_browser = $('#importModalCustom [name="nodes_right"]');

					left_browser.innerHTML = null;
					right_browser.innerHTML = null;

					let copy = Object.assign({}, newUserOptions);
					traverseNodes(copy.nodeTree, (n,p) => {

						// remove OCSE from non-FF browsers
						if ( n.type === "oneClickSearchEngine" && !browser.search )
							removeNode(n,p);
						// remove duplicate nodes
						else if ( findNode(userOptions.nodeTree, _n => _n.id === n.id && JSON.stringify(_n) === JSON.stringify(n)) )
							removeNode(n,p);
						// remove missing engines
						else if ( n.type === "searchEngine" && !copy.searchEngines.find(se => se.id === n.id ) )
							removeNode(n,p);
						// remove empty folders
						else if ( n.type === "folder" && !n.children.length && p)
							removeNode(n,p);

					})

					//left_browser.appendChild(makeFolderBrowser(copy.nodeTree));
					left_browser.appendChild(makeFolderBrowser(userOptions.nodeTree));
					right_browser.appendChild(makeFolderBrowser({type: "folder", title:"/", id: gen(), children: []}));

					left_browser.querySelectorAll('li').forEach( li => {
						li.classList.add('new');

						// checkboxes
						{
							let cb = document.createElement('input');
							cb.type = 'checkbox';
							cb.classList.add('selectCheckbox', 'showCheckboxes');

							cb.addEventListener('change', e => e.stopPropagation())

							li.insertBefore(cb, li.firstChild);

							// header.addEventListener('mousedown', e => {
							// 	window.mouseDownTimer = setTimeout(() => {
							// 		// class bound to container to affect all boxes
							// 		$('managerContainer').classList.add('showCheckboxes');
							// 	}, 1000);
							// });

							// header.addEventListener('click', e => {

							// 	// prevents double action / no change
							// 	if ( e.target === cb ) return;

							// 	// check box if displayed
							// 	if ( $('managerContainer').classList.contains('showCheckboxes'))
							// 		cb.checked = !cb.checked;
							// })

						}

						li.addEventListener('click', e => {

							return;
							if ( e.target !== li ) return;

							let parent = li.closest('.folderBrowser');
							let notParent = [left_browser, right_browser].find( b => !b.contains(parent));

							if ( left_browser.contains(parent) ) {
								let div = document.createElement('div');
								div.dataset.id = li.node.id;
								li.parentNode.insertBefore(div, li);
								notParent.querySelector('li[title="/"] > UL').appendChild(li);
							} else {
								let placeholder = left_browser.querySelector(`div[data-id="${li.node.id}"]`);

								if ( placeholder)  {
									placeholder.parentNode.insertBefore(li, placeholder);
									placeholder.parentNode.removeChild(placeholder);
								}
							}
						})
					});
				}).then( async result => {

					if ( result === "cancel" ) {
						newUserOptions = null;
						return;
					}

					let _settings = $('#importModalCustom [name="settings"]').checked;
					let _history = $('#importModalCustom [name="history"]').checked;

					if ( !_history )
						newUserOptions.searchBarHistory = JSON.parse(JSON.stringify(userOptions.searchBarHistory));

					if ( !_settings ) {
						for ( key in userOptions ) {
							if ( !["nodeTree", "searchEngines", "searchBarHistory"].includes(key) )
								newUserOptions[key] = JSON.parse(JSON.stringify(userOptions[key]));
						}
					}

					let tree = listToNodeTree($('#importModalCustom [name="nodes_right"] .folderBrowser li[title="/"] > UL'));
					let ids = findNodes(tree, n => n.type === "searchEngine").map(n => n.id);

					let duplicates = [];
					ids.forEach( id => {
						let node = findNode(userOptions.nodeTree, n => n.id === id );
						if ( node ) duplicates.push(n);
					});

					// loop over duplicates to replace, skip, cancel
					for ( let dupe of duplicates ) {
						await new Promise( res => {
							$('#importModalDuplicates').classList.remove('hide');
							$('#importModalDuplicates [name="message"]').innerText = dupe.title;
							$('#importModalDuplicates [name="replace"]').addEventListener('click', e => res("replace"));
							$('#importModalDuplicates [name="skip"]').addEventListener('click', e => res("skip"));
							$('#importModalDuplicates [name="cancel"]').addEventListener('click', e => res("cancel"));
						}).then(result => {
							if ( result === "skip" )
								removeNodesById(tree, dupe.id);

							$('#importModalDuplicates').classList.add('hide');
						});
					}

					if ( duplicates.length ) console.error(duplicates);

					// append searchEngines
					let ses = userOptions.searchEngines.filter(se => ids.includes(se.id));
					newUserOptions.searchEngines = userOptions.searchEngines.concat(ses);
					
					// append tree to newUserOptions
					tree.title = "Imported";
					newUserOptions.nodeTree = JSON.parse(JSON.stringify(userOptions.nodeTree));

					if ( tree.children.length )
						newUserOptions.nodeTree.children.push(JSON.parse(JSON.stringify(tree)));

				});

				$('#importModalCustom').classList.add('hide');
			}

			$('#main').classList.remove('blur');
		}

		// check for cancel
		if ( !newUserOptions ) return;
		
		// update imported options
		let _uo = await sendMessage({action: "updateUserOptionsObject", userOptions: newUserOptions})
		
		try {
			_uo = await sendMessage({action: "updateUserOptionsVersion", userOptions: _uo})		
		} catch ( error ) {
			console.log(error);
			if ( !confirm("Failed to update config. This may cause some features to not work. Install anyway?"))
				return;
		}

		if ( userOptions.cacheIcons) {

			// load icons to base64 if missing
			let overDiv = document.createElement('div');
			overDiv.style = "position:fixed;left:0;top:0;height:100%;width:100%;z-index:9999;background-color:rgba(255,255,255,.85);background-image:url(icons/spinner.svg);background-repeat:no-repeat;background-position:center center;background-size:64px 64px;line-height:100%";
			let msgDiv = document.createElement('div');
			msgDiv.style = "text-align:center;font-size:12px;color:black;top:calc(50% + 44px);position:relative;background-color:white";
			msgDiv.innerText = i18n("Fetchingremotecontent");
			overDiv.appendChild(msgDiv);
			document.body.appendChild(overDiv);

		
			let sesToBase64 = findNodes(_uo.nodeTree, n => n.icon);
			let details = await loadRemoteIcon({searchEngines: sesToBase64, timeout:10000});
			details.searchEngines.forEach( se => {
				let n = findNode(_uo.nodeTree, n => n.id === se.id);
				if ( n ) n.iconCache = se.iconCache;
			})
		}
		
		// load OCSE favicons
		if ( browser.search && browser.search.get ) {
			let ocses = await browser.search.get();
			findNodes(_uo.nodeTree, node => {
				if ( node.type === "oneClickSearchEngine" ) {
					let ocse = ocses.find(_ocse => _ocse.name === node.title);	
					if ( ocse ) node.icon = ocse.favIconUrl;
				}
			});
		} else {
			findNodes(_uo.nodeTree, node => {
				if ( node.type === "oneClickSearchEngine" ) node.hidden = true;
			});
		}

		userOptions = _uo;
		await sendMessage({action: "saveUserOptions", userOptions: _uo});
		location.reload();
		

	} catch(err) {
		console.log(err);
		alert(i18n("InvalidJSONAlert"));
	}
}
