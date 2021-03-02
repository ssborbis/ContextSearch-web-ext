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
		let newProp = window.getComputedStyle(el).getPropertyValue(prop);
		if ( newProp !== oldProp ) {
			oldProp = newProp;
			return;
		}

		clearInterval(checkPropInterval);
		callback();
		
	}, ms);
}


