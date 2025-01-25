class Shortcut {

	constructor(key) {
		this.alt = key.alt;
		this.ctrl = key.ctrl;
		this.alt = key.alt;
		this.meta = key.meta;
		this.keyCode = key.keyCode;
	}

	static getCharFromKeyCode = keyCode => { 
		return keyTable[keyCode] || null
	}

	static keyCodeToString = keyCode => {
		if ( keyCode === 0 ) return null;
		return this.getCharFromKeyCode(keyCode) /*|| String.fromCharCode(code)*/ || keyCode.toString();
	}

	static getHotkeyCharFromNode = n => {
		let key = this.getHotkeyFromNode(n);
		return key && key.length === 1 ? key : null;
	}

	static hasModifiers = e => {
		return (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.alt || e.ctrl || e.shift || e.meta) ? true : false;
	}

	static getHotkeyFromNode = node => {
		if ( !node.shortcut && node.hotkey) 
			return this.getCharFromKeyCode(node.hotkey);
		else if ( node.shortcut && !this.hasModifiers(node.shortcut) ) 
			return node.shortcut.key;
		else
			return null;
	}

	static keyFromEvent = e => {
		return {
			alt: e.altKey,
			ctrl: e.ctrlKey,
			meta: e.metaKey,
			shift: e.shiftKey,
			key: e.key,
			keyCode: e.keyCode
		};
	}

	static matches = (s1, s2) => {

		if ( !s1 || !s2 ) return false;

		// keyCode (int) objects
		if ( s1 == s2 ) return true;

		// key objects
		return 	s1.key == s2.key &&
				s1.alt == s2.alt &&
				s1.ctrl == s2.ctrl &&
				s1.meta == s2.meta &&
				s1.shift == s2.shift
	}

	static getNodeFromEvent = e => {
		let key = Shortcut.keyFromEvent(e);
		let node = findNode( userOptions.nodeTree, n => n.shortcut && this.matches(n.shortcut,key));

		if ( !node )
			node = findNode(userOptions.nodeTree, n => n.hotkey && !n.shortcut && n.hotkey === e.keyCode && !this.hasModifiers(e));

		return node;

	}

	static listen = () => {

		return new Promise(resolve => {

			document.body.style.pointerEvents = 'none';
				
			const preventDefaults = e => {
				e.preventDefault();
				e.stopPropagation();
			}

			document.addEventListener('keydown', preventDefaults, {capture:true});
			document.addEventListener('keypress', preventDefaults, {capture:true});
			
			document.addEventListener('keyup', e => {
				
				preventDefaults(e);
				
				if ( e.key === "Escape" ) resolve(null);
				
				let key = this.keyFromEvent(e);
									
				document.removeEventListener('keydown', preventDefaults, {capture:true});
				document.removeEventListener('keypress', preventDefaults, {capture:true});

				document.body.style.pointerEvents = null;

				resolve(key);
				
			}, {once: true, capture: true});
		});	
	}

	static getShortcutStringFromKey = key => {

		if ( !key ) return "";

		if ( Number.isInteger(key) )
			return this.keyCodeToString(key);

		return 	(key.ctrl ? i18n("ctrl") + " + " : "")
			+ 	(key.alt ? i18n("alt") + " + " : "")
			+ 	(key.shift ? i18n("shift") + " + " : "")
			+	(key.meta ? "meta" + " + " : "")
			+	key.key;
	}

	static buttonListener = async(hk, options = {}) => {

		hk.innerHTML = null;
		let img = document.createElement('img');
		img.src = "/icons/spinner.svg";
		img.style = "height:1em;vertical-align:middle;margin-right:6px";

		hk.appendChild(img);

		hk.appendChild(document.createTextNode(i18n('PressKey')));

		let key = await this.listen();

		hk.innerText = this.getShortcutStringFromKey(key);

		return key;

	}

	static addShortcutListener = () => {
		document.addEventListener('keydown', this.shortcutListener);
	}

	static removeShortcutListener = () => {
		document.removeEventListener('keydown', this.shortcutListener);
	}

	static shortcutListener = e => {
		
		// skip text boxes
		if ( e.key && !e.ctrlKey && !e.altKey && !e.metaKey && isTextBox(e.target) ) return;

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

				let sc = Shortcut.defaultShortcuts.find(d => d.id === s.id);

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
					sendMessage({action: action});
				else if ( typeof action === 'function' ) action(e);
				
				return false;
			}

		}

		if ( typeof checkForNodeHotkeys === 'function' ) checkForNodeHotkeys(e);
	}

	static getDefaultShortcutById = id => this.defaultShortcuts.find(ds => ds.id === id);

	static defaultShortcuts = [
		{
			name:"Menu → Quick → Open",
			action: e => {
				if ( !getSearchTermsForHotkeys ) return;
				sendMessage({action: "openQuickMenu", searchTerms:getSearchTermsForHotkeys(e)});
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
				sendMessage({action: "toggleFindBar"});
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
				sendMessage({action: "openPageTiles", searchTerms:getSearchTermsForHotkeys(e), hotkey: true});
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
}

