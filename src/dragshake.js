window.getShadowRoot = window.getShadowRoot || function() { return document.body };

let DragShake = function() {

	const shakeInterval = 500;
	const resetMinMaxInterval = 1000;

	let origin;
	let lastMovementX = 0;
	let reversals = [];
	let statusDiv;
	let minMaxTimer = 0;
	let min = Number.MAX_SAFE_INTEGER;
	let max = 0

	this.onshake = () => {}

	this.start = () => {
		document.addEventListener('dragover', e => {
		    origin = {x: e.clientX, y: e.clientY}
		}, {once: true});

		document.addEventListener('dragover', this.dragHandler);

		statusDiv = document.createElement('status');
		statusDiv.style = 'font-size:9pt;position:fixed;bottom:0;right:0;color:#aaa';
		statusDiv.style.zIndex = Number.MAX_SAFE_INTEGER;
		getShadowRoot().appendChild(statusDiv);
	}
	this.stop = () => {
		document.removeEventListener('dragover', this.dragHandler);
		if ( statusDiv && statusDiv.parentNode ) statusDiv.parentNode.removeChild(statusDiv);
	}

	this.dragHandler = e => {

		reversals = reversals.filter(r => Date.now() - r < shakeInterval );

		// set min/max
		min = e.clientX < min ? e.clientX : min;
		max = e.clientX > max ? e.clientX : max;

		let deltaX = e.clientX - origin.x;

		if ( Math.abs(deltaX) > 25 && deltaX * lastMovementX < 0 )
			reversals.push(Date.now());

		if ( reversals.length === userOptions.shakeSensitivity ) {
			this.stop();
			this.onshake();
		}

		lastMovementX = deltaX;

		statusDiv.innerText = `${reversals.length} / ${userOptions.shakeSensitivity} shakes`;

		if ( Date.now() - minMaxTimer > resetMinMaxInterval ) {
			minMaxTimer = Date.now();

			// reset origin
			origin.x = min + ( max - min ) / 2;

			// reset local min/max
			min = Number.MAX_SAFE_INTEGER;
			max = 0;
		}
	}

	return this;
}

function copyNodeStyle(sourceNode, targetNode) {
  const computedStyle = window.getComputedStyle(sourceNode);
  Array.from(computedStyle).forEach(key => targetNode.style.setProperty(key, computedStyle.getPropertyValue(key), computedStyle.getPropertyPriority(key)))
}

function dragOverIframeDiv(el) {
	var rect = el.getBoundingClientRect();

	let div = document.createElement('div');

	copyNodeStyle(el, div);

	div.id = 'CS_' + gen();
	div.style.zIndex = div.style.zIndex ? div.style.zIndex + 1 : 2;
	div.style.opacity = 0;

	getShadowRoot().appendChild(div);

	div.addEventListener('dragover', e => e.preventDefault());

	['drop','dragover'].forEach( eventType => {
		div.addEventListener(eventType, e => {
			el.contentWindow.postMessage({
				eventType: eventType,
				pageX:e.pageX, 
				pageY:e.pageY,
				clientX:e.clientX,
				clientY:e.clientY,
				offsetX:e.offsetX,
				offsetY:e.offsetY,
				screenX:e.screenX,
				screenY:e.screenY
			}, el.src);
		});
	});

	document.addEventListener('dragend', e => {
		if (div && div.parentNode) div.parentNode.removeChild(div)
	}, {once: true});

	return div;
}

undefined; // prevents unclonable error in FF