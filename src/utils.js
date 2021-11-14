function runAtTransitionEnd(el, prop, callback, ms) {

	ms = ms || 25;

	if ( Array.isArray(prop)) {
		var remaining = prop.length;
		prop.forEach( _prop => {
			runAtTransitionEnd(el, _prop, () => {
				if ( --remaining === 0 ) callback();
			}, ms);
		});
		return;
	}

	let oldProp = null;
	let checkPropInterval = setInterval(() => {
		try {
			let newProp = window.getComputedStyle(el).getPropertyValue(prop);
			if ( newProp !== oldProp ) {
				oldProp = newProp;
				return;
			}

			clearInterval(checkPropInterval);
			callback();
		} catch (e) {
			clearInterval(checkPropInterval);
		}
		
	}, ms);
}

function recentlyUsedListToFolder() {

	let folder = {
		type: "folder",
		id: "___recent___",
		title: browser.i18n.getMessage('Recent'),
		children: [],
		parent: (window.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/history.svg')
	}

	userOptions.recentlyUsedList.forEach( (id,index) => {
		if ( index > userOptions.recentlyUsedListLength -1 ) return;
		let lse = findNode(userOptions.nodeTree, node => node.id === id);

		// filter missing nodes
		if ( lse ) folder.children.push(Object.assign({}, lse));
	});

	return folder;
}

function matchingEnginesToFolder(s) {

	let folder = {
		type: "folder",
		id: "___matching___",
		title: "( .* )",
		children: [],
		parent: (window.qm) ? qm.rootNode : null,
		icon: browser.runtime.getURL('icons/regex.svg'),
		groupFolder: '',
		groupColor: '#88bbdd'
	}

	let matchingEngines = userOptions.searchEngines.filter( se => {

		if ( !se.matchRegex ) return false;

		let lines = se.matchRegex.split(/\n/);

		for ( let line of lines ) {

			try {
				let parts = JSON.parse('[' + line.trim() + ']');
				let rgx = new RegExp(parts[0], parts[1] || 'g');

				if ( rgx.test(s) ) return true;
			} catch (error) {}
		}

		return false;

	});

	matchingEngines.forEach( se => {
		let node = findNode(userOptions.nodeTree, n => n.id === se.id )
		if ( node ) folder.children.push(Object.assign({}, node));
	});

	return folder;
}
