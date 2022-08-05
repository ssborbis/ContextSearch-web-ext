document.addEventListener('keydown', e => {

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

			let sc = defaultShortcuts.find(d => d.id === s.id);

			if ( !sc ) return;

			e.preventDefault();
			e.stopPropagation();

			// prevent quickMenuKey opening method using keyup
			document.addEventListener('keyup', _e => {
				_e.preventDefault();
				_e.stopPropagation();
				_e.stopImmediatePropagation();
			}, {once: true, capture: true});

			let action = sc.action;

			if ( typeof action === 'string')
				browser.runtime.sendMessage({action: action});
			else if ( typeof action === 'function' ) action(e);
			
			return false;
		}

	}

	if ( typeof checkForNodeHotkeys === 'function' ) checkForNodeHotkeys(e);
})
