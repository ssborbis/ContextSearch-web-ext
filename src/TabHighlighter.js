function TabHighlighter() {
	let tabs = [];
	
	this.get = () => tabs;

	this.add = function(index) {
		if ( tabs.indexOf(index) == -1 ) {
			tabs.push(index);
			highlight();
		}
	}

	this.remove = function(tabIndex) {
		let io = tabs.indexOf(tabIndex);

		if ( io != -1 ) tabs = tabs.splice(io,1);
	}

	this.clear = function() {
		tabs = [];
		highlight();
	}

	const highlight = async() => {
		let activeTabs = await browser.tabs.query({active:true, windowId: browser.windows.WINDOW_ID_CURRENT});
		await browser.tabs.highlight({tabs: tabs, populate:false});

		if ( activeTabs )
			await browser.tabs.update(activeTabs[0].id, {active: true});
	}
}