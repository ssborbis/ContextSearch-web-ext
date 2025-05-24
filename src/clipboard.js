async function copyImage(imageURL){

	const dataURI = await sendMessage({action: "fetchURI", url: imageURL});
	const blob = await (await fetch(dataURI)).blob();
	const item = new ClipboardItem({ [blob.type]: blob });
	navigator.clipboard.write([item]);
}

// Function to copy the selected rich text (HTML) to the clipboard
async function copyRichText() {

    const selection = document.getSelection();

    // no selection. just get the searchTerms
    if (!selection.rangeCount) {
    	return navigator.clipboard.write([
	        new ClipboardItem({
	        	"text/plain": new Blob([quickMenuObject.searchTerms], { type: "text/plain" }),
	        })
	    ]);
    } 

    let range = selection.getRangeAt(0);  // Get the selected range

    // Get the HTML content of the selection
    const htmlContent = selection.toString();
    const selectedHtml = range.cloneContents(); // Get the selected HTML (including tags, images, etc.)

    // Create a temporary div to hold the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(selectedHtml);  // Append the selected content to the div

    // Copy the content to the clipboard using the Clipboard API
    navigator.clipboard.write([
        new ClipboardItem({
        	"text/plain": new Blob([tempDiv.innerText], { type: "text/plain" }),
            "text/html": new Blob([tempDiv.innerHTML], { type: "text/html" })
        })
    ])
    .then(() => {
        console.log('Rich text copied to clipboard successfully!');
        return true;
    })
    .catch(err => {
        console.error('Error copying rich text: ', err);
        return false;
    });
}

async function copyRaw() {

	if ( userOptions.autoCopyImages && quickMenuObject.searchTermsObject.image ) {
		console.log('attempting to copy image to clipboard');
		return copyImage(quickMenuObject.searchTermsObject.image);
	}

	let rawText = getRawSelectedText(document.activeElement) || quickMenuObject.searchTerms;

	if ( !rawText ) return;

	try {
		if ( userOptions.copyUseDepreciatedExecCommand ) {
			if ( window.getSelection() && window.getSelection().toString() ) {
				return document.execCommand('copy');
			} else {
				throw new Error("copyUseDepreciatedExecCommand");
			}
		}

		//navigator.clipboard.writeText(rawText);
		copyRichText();
		
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