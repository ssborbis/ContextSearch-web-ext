document.addEventListener('keydown', e => {

//	console.log(e);

	for ( let s of userOptions.userShortcuts ) {
		if (
			s.enabled &&
			e.key &&
			e.key === s.key &&
			e.altKey === s.alt &&
			e.ctrlKey === s.ctrl &&
			e.shiftKey === s.shift &&
			e.metaKey === s.meta 
		) {

			e.preventDefault();
			e.stopPropagation();

			let action = defaultShortcuts.find(d => d.id === s.id).action;

			if ( typeof s.action === 'string')
				browser.runtime.sendMessage({action: action});
			else if ( typeof action === 'function' ) action(e);
			return;
		}

	}

	if ( typeof checkForNodeHotkeys === 'function' ) checkForNodeHotkeys(e);
})
