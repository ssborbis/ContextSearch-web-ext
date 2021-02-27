const defaultShortcuts = [
	{
		name:"quickMenuOpen",
		action: e => {
			let searchTerms = getSelectedText().trim() || "";
			browser.runtime.sendMessage({action: "openQuickMenu", searchTerms:searchTerms});
		},
		key: "x",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 0
	},
	{
		name:"findBarOpen",
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
		name:"findBarNext",
		action: "findBarNext",
		key: "F3",
		ctrl: false,
		alt: false,
		shift:false,
		meta:false,
		id: 2
	},{
		name:"findBarPrevious",
		action: "findBarPrevious",
		key: "F3",
		ctrl: false,
		alt: false,
		shift:true,
		meta:false,
		id: 3
	},{
		name:"sideBarOpen",
		action: "openSideBar",
		key: "z",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 4
	},{
		name:"toggleDisplayMode",
		action: () => qm.toggleDisplayMode(),
		key: ".",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 6
	},{
		name:"quickMenuLock",
		action: () => QMtools.find(t => t.name === "lock").action(),
		key: "l",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 7
	},{
		name:"quickMenuEdit",
		action:() => QMtools.find(t => t.name === "edit").action(),
		key: "e",
		ctrl: true,
		alt: true,
		shift:false,
		meta:false,
		id: 8
	},{
		name:"optionsOpen",
		action:"openOptions",
		key: "O",
		ctrl: true,
		alt: false,
		shift:true,
		meta:false,
		id: 9
	},{
		name:"pageTilesOpen",
		action:"openPageTiles",
		key: ",",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 10
	},{
		name:"themeNext",
		action:() => nextTheme(),
		key: "ArrowRight",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 11
	},{
		name:"themePrevious",
		action:() => previousTheme(),
		key: "ArrowLeft",
		ctrl: true,
		alt: false,
		shift:false,
		meta:false,
		id: 12
	},{
		name:"sideBarMinify",
		action:"minifySideBar",
		key: "M",
		ctrl: true,
		alt: false,
		shift:true,
		meta:false,
		id: 13
	}
];

/*

	hotkeys on/off
	scale menu

toggle user styles




*/