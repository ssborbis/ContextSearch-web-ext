const defaultShortcuts = [
	{
		name:"Menu → Quick → Open",
		action: e => {
			if ( !getSearchTermsForHotkeys ) return;
			browser.runtime.sendMessage({action: "openQuickMenu", searchTerms:getSearchTermsForHotkeys(e)});
		},
		key: "x",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 0
	},
	{
		name:"Findbar → Open",
		action: async (e) => {
			let isOpen = await browser.runtime.sendMessage({action: "getFindBarOpenStatus"});
			isOpen = isOpen.shift();

			let searchTerms = ( typeof getSelectedText === 'function' ) ? getSelectedText(e.target) : "";
			
			if (!isOpen || ( isOpen && searchTerms) )
				browser.runtime.sendMessage({action: "openFindBar", searchTerms: searchTerms});
			else
				browser.runtime.sendMessage({action: "closeFindBar"});
		},
		key: "f",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 1
	},{
		name:"Findbar → Find Next",
		action: "findBarNext",
		key: "F3",
		ctrl: false,
		alt: false,
		shift:false,
		meta:false,
		id: 2
	},{
		name:"Findbar → Find Previous",
		action: "findBarPrevious",
		key: "F3",
		ctrl: false,
		alt: false,
		shift:true,
		meta:false,
		id: 3
	},{
		name:"Menu → Sidebar → Open",
		action: "openSideBar",
		key: "z",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 4
	},{
		name:"Menu → [All] → Toggle Grid / List",
		action: () => qm.toggleDisplayMode(),
		key: ".",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 6
	},{
		name:"Menu → Quick → Lock",
		action: () => qm && QMtools.find(t => t.name === "lock").action(),
		key: "l",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 7
	},{
		name:"Menu → [All] → Edit Layout",
		action:() => qm && QMtools.find(t => t.name === "edit").action(),
		key: "e",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 8
	},{
		name:"Options → Open",
		action:"openOptions",
		key: "O",
		ctrl: true,
		alt: false,
		shift:true,
		meta:false,
		id: 9
	},{
		name:"Menu → Page Tiles → Open",
		action: e => {
			if ( !getSearchTermsForHotkeys ) return;
			browser.runtime.sendMessage({action: "openPageTiles", searchTerms:getSearchTermsForHotkeys(e), hotkey: true});
		},
		key: ",",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 10
	},{
		name:"Menu → [All] → Theme → Next",
		action:() => nextTheme(),
		key: "ArrowRight",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 11
	},{
		name:"Menu → [All] → Theme → Previous",
		action:() => previousTheme(),
		key: "ArrowLeft",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 12
	},{
		name:"Menu → Sidebar → Minify",
		action:"minifySideBar",
		key: "M",
		ctrl: true,
		alt: false,
		shift:true,
		meta:false,
		id: 13
	},{
		name:"Last Used Search Engine",
		action:(e) => {
			let searchTerms = getSearchTermsForHotkeys(e);

			if ( !searchTerms ) return;

			quickMenuObject.searchTerms = searchTerms;

			QMtools.find(t => t.name === "lastused").action(e);
		},
		key: "l",
		ctrl: true,
		alt: false,
		shift:true,
		meta:false,
		id: 14
	},{
		name:"Search Results → Next Engine",
		action:() => nextResultsEngine(),
		key: "ArrowRight",
		ctrl: false,
		alt: false,
		shift:false,
		meta:false,
		id: 15
	},{
		name:"Search Results → Previous Engine",
		action:() => previousResultsEngine(),
		key: "ArrowLeft",
		ctrl: false,
		alt: false,
		shift:false,
		meta:false,
		id: 16
	}
];

/*

	hotkeys on/off
	scale menu

toggle user styles




*/