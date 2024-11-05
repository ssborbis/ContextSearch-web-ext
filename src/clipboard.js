async function copyImage(imageURL){

	const dataURI = await sendMessage({action: "fetchURI", url: imageURL});
	const blob = await (await fetch(dataURI)).blob();
	const item = new ClipboardItem({ [blob.type]: blob });
	navigator.clipboard.write([item]);
}

async function copyRaw(autoCopy) {

	if ( userOptions.autoCopyImages && quickMenuObject.searchTermsObject.image ) {
		console.log('attempting to copy image to clipboard');
		return copyImage(quickMenuObject.searchTermsObject.image);
	}

	let rawText = getRawSelectedText(document.activeElement);

	if ( !rawText ) rawText = quickMenuObject.searchTerms;

	if ( !rawText ) return;

	try {
		if ( userOptions.copyUseDepreciatedExecCommand ) {
			if ( window.getSelection() && window.getSelection().toString() ) {
				return document.execCommand('copy');
			} else {
				throw new Error("copyUseDepreciatedExecCommand");
			}
		}

		navigator.clipboard.writeText(rawText);
		
	} catch (err) {

		let active = document.activeElement;

		save = () => {

			if ( active && typeof active.selectionStart !== 'undefined' ) {
				return {start: active.selectionStart, end: active.selectionEnd};
			}
		    const selection = window.getSelection();

		    return selection.rangeCount === 0 ? null : selection.getRangeAt(0);
		};

		// Restore the selection
		restore = (range) => {
			if ( active && typeof active.selectionStart !== 'undefined' ) {
				active.selectionStart = range.start;
				active.selectionEnd = range.end;
				active.focus();
				return;
			}
		    const selection = window.getSelection();

		    if ( range ) {
		    	selection.removeAllRanges();
		   		selection.addRange(range);
		   	}
		};

		window.suspendSelectionChange = true;

		let activeRange = save();
		
		var t = document.createElement("textarea");

		// Avoid scrolling to bottom
		t.style.top = "-1000px";
		t.style.left = "-1000px";
		t.style.position = "fixed";
		t.style.width = 0;
		t.style.height = 0;

		// execCommand('copy') will not work with hidden inputs
		// t.style.display = "none";

		t.value = rawText;

		document.body.appendChild(t);
		t.focus();
		t.select();

		try {
			document.execCommand('copy');
		} catch (_err) {
			console.log(_err);
		}

		document.body.removeChild(t);

		restore(activeRange);
		active.focus();

		// delay required in Waterfox
		setTimeout(() => window.suspendSelectionChange = false, 10);

	}
}