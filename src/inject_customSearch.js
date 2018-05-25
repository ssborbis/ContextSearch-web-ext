// listen for right-mousedown and enable Add Custom Search menu item if no text is selected
function inputAddCustomSearchHandler(input) {
	input.addEventListener('mousedown', (ev) => {
		if (
			ev.which !== 3
			|| getSelectedText(input)
		) return;

		browser.runtime.sendMessage({action: "enableAddCustomSearchMenu"});
			
	});
}

// Add Custom Search listener
for (let input of document.getElementsByTagName('input')) {
	inputAddCustomSearchHandler(input);
}

// Add listener for dynamically added inputs
var CS_observer = new MutationObserver((mutationsList) => {
	for(var mutation of mutationsList) {
        if (mutation.type == 'childList') {
			for (let node of mutation.addedNodes) {
				if (node.nodeName === "INPUT") {
					console.log("INPUT added dynamically to the DOM. Adding listener");
					inputAddCustomSearchHandler(node);
				}
			}
        }
    }
});

CS_observer.observe(document.body, {childList: true, subtree: true});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action !== 'undefined') {
		switch (message.action) {
							
			case "openCustomSearch":
				var iframe = document.createElement('iframe');
				iframe.id = "CS_customSearchIframe";
				iframe.src = browser.runtime.getURL('/customSearch.html');
				document.body.appendChild(iframe);
				
				// reflow trick
				iframe.getBoundingClientRect();
				iframe.style.opacity=1;

				break;
			
			case "closeCustomSearch":
				var iframe = document.getElementById("CS_customSearchIframe");
				iframe.style.opacity = 0;
				
				// remove after transition effect completes
				setTimeout(() => {
					document.body.removeChild(iframe);
				},250);
				
				// run native app to check for updated search.json.mozlz4 with enough delay to process file
				setTimeout(() => {
					browser.runtime.sendMessage({action: "nativeAppRequest"});
				}, 1000);
				
				break;
		}
	}
});