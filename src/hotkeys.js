function isHotkey(e, keycodeArray) {
	for (let i=0;i<keycodeArray.length;i++) {
		let key = keycodeArray[i];
		if (key === 16 && !e.shiftKey) return false;
		if (key === 17 && !e.ctrlKey) return false;
		if (key === 18 && !e.altKey) return false;
		if (key !== 16 && key !== 17 && key !== 18 && key !== e.keyCode) return false;
	}
	
	return true;
}

function addHotkey(enabled, keycodeArray, callback) {
	window.addEventListener('keydown', (e) => {

		if (
			!enabled
			|| !keycodeArray.includes(e.keyCode)
			|| e.repeat
		) return;

		if ( !isHotkey(e, keycodeArray) ) return;

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
			enabler: userOptions.highLight.findBar.hotKey.length,
			hotkey: userOptions.highLight.findBar.hotKey,
			callback: (e) => {
				
				let searchTerms = ( typeof getSelectedText === 'function' ) ? getSelectedText(e.target) : "";
				browser.runtime.sendMessage({action: "findBarHotkey", searchTerms: searchTerms});
			}
		}
	].forEach( hko => {
		addHotkey( hko.enabler, hko.hotkey, hko.callback );
	});
});