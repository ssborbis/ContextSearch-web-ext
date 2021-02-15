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

			s.action = defaultShortcuts.find(d => d.id === s.id).action;

			if ( typeof s.action === 'string')
				browser.runtime.sendMessage({action: s.action});
			else if ( typeof s.action === 'function' ) s.action(e);
			return;
		}

	}

	if ( typeof checkForNodeHotkeys === 'function' ) checkForNodeHotkeys(e);
})
