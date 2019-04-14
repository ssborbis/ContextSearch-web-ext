function isHotkey(e, _key) {
	
	if ( Array.isArray(_key) ) {
	
		for (let i=0;i<_key.length;i++) {
			let key = _key[i];
			if (key === 16 && !e.shiftKey) return false;
			if (key === 17 && !e.ctrlKey) return false;
			if (key === 18 && !e.altKey) return false;
			if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return false;
		}
		
		return true;
		
	} else {
		
		// check for hotkeys that could prevent typing in a text box
		if ( 
			e.target.contentEditable &&
			!e.altKey &&
			!e.ctrlKey &&
			!e.metaKey &&
			e.key.length === 1
		) {
			console.log(e.key, 'Hotkey appears to be a typeable character and target element is editable. Aborting hotkey');
			return false;
		}
		
		if ( 
			e.key === _key.key &&
			e.altKey === _key.alt &&
			e.ctrlKey === _key.ctrl &&
			e.metaKey === _key.meta &&
			e.shiftKey === _key.shift
		) return true;
		else return false;
	}
}

function isSame(array1, array2) { 
	return (array1.length == array2.length) && array1.every(function(element, index) {
		return element === array2[index]; 
	});
}

function addHotkey(enabled, key, callback) {
	
	window.addEventListener('keydown', (e) => {

		if (
			!enabled
			|| ( Array.isArray(key) && !key.includes(e.keyCode) )
			|| ( typeof key.key !== 'undefined' && key.key !== e.key )
			|| e.repeat
		) return;

		// convert keyCode arrays to key objects
		if ( Array.isArray(key) ) {

			if ( !isHotkey(e, key) ) return;
			
			_key = {
				alt: e.altKey,
				ctrl: e.ctrlKey,
				meta: e.metaKey,
				shift: e.shiftKey,
				key: e.key
			}

			if ( isSame(key,userOptions.highLight.findBar.hotKey) )
				userOptions.highLight.findBar.hotKey = Object.assign({}, _key);
			
			if ( isSame(key,userOptions.quickMenuHotkey) ) 
				userOptions.quickMenuHotkey = Object.assign({}, _key);
			
			console.log('converting hotkey',key,"to",_key);
			
			key = _key;

			browser.runtime.sendMessage({action: "saveUserOptions", userOptions: userOptions});

		} 

		if ( !isHotkey(e, key) ) return false;

		e.preventDefault();

		callback(e);
	});
}

browser.runtime.sendMessage({action: "getUserOptions"}).then( message => {
	let userOptions = message.userOptions;
	[	
		{ // sidebar
			enabler: userOptions.quickMenuOnHotkey,
			hotkey: userOptions.quickMenuHotkey,
			callback: (e) => {
				browser.runtime.sendMessage({action: "sideBarHotkey"});
			}
		},
		{ // findbar
			enabler: userOptions.highLight.findBar.enabled,
			hotkey: userOptions.highLight.findBar.hotKey,
			callback: (e) => {
				
				browser.runtime.sendMessage({action: "getFindBarOpenStatus"}).then( results => {
					
					let isOpen = results.shift(); // get the first array element ( true || false )

					let searchTerms = ( typeof getSelectedText === 'function' ) ? getSelectedText(e.target) : "";
					
					if (!isOpen || ( isOpen && searchTerms) )
						browser.runtime.sendMessage({action: "openFindBar", searchTerms: searchTerms});
					else
						browser.runtime.sendMessage({action: "closeFindBar"});
				});
			}
		}
	].forEach( hko => {
		addHotkey( hko.enabler, hko.hotkey, hko.callback );
	});
});