
let DragShake = function() {

	const shakeInterval = 250;
	const resetMinMaxInterval = 500;

	let start = null;
	let lastMovementX = 0;
	let reversals = [];
	let last_x = 0;
	let statusDiv;
	let minMaxTimer;
	let min = Number.MAX_SAFE_INTEGER;
	let max = 0

	this.start = () => {
		document.addEventListener('dragover', e => {
		    start = {x: e.clientX, y: e.clientY}
		}, {once: true});

		document.addEventListener('dragover', dragHandler);

		statusDiv = document.createElement('div');
		statusDiv.style = 'font-size:9pt;position:fixed;bottom:0;right:0;background-color:#0000ff4;color:white';
		statusDiv.style.zIndex = Number.MAX_SAFE_INTEGER;
		document.body.appendChild(statusDiv);

		minMaxTimer = Date.now();
	}
	stop = () => {
		document.removeEventListener('dragover', dragHandler);
		statusDiv.parentNode.removeChild(statusDiv);
	}

	this.onshake = () => {}
	shake = () => this.onshake();
	this.stop = stop;

	function dragHandler(e) {

		// set min/max
		min = e.clientX < min ? e.clientX : min;
		max = e.clientX > max ? e.clientX : max;

		let deltaX = e.clientX - start.x;

		reversals = reversals.filter(r => Date.now() - r < shakeInterval );

		if ( deltaX * lastMovementX < 0 )
			reversals.push(Date.now());

		if ( reversals.length === userOptions.shakeSensitivity ) {
			stop();
			shake();
		}

		lastMovementX = deltaX;

		statusDiv.innerText = "shakes: " + reversals.length;

		if ( Date.now() - minMaxTimer > resetMinMaxInterval ) {
			minMaxTimer = Date.now();

			// reset center point
			start.x = min + ( max - min ) / 2;

			// reset local min/max
			min = Number.MAX_SAFE_INTEGER;
			max = 0;
		}
	}

	return this;
}

function dragOverIframeDiv(el) {
	var rect = el.getBoundingClientRect();

	var style = window.getComputedStyle ? getComputedStyle(el, null) : el.currentStyle;

	if ( !style.position || style.position !== "fixed" ) {
		console.warn('NotFixedPosition', el);
		return;
	}

	let div = document.createElement('div');
	div.style.display = 'inline-block';
	div.style.position = 'fixed';
	div.id = 'CS_' + gen();
	div.style.left = style.left;
	div.style.top = style.top;
	div.style.width = rect.width + "px";
	div.style.height = rect.height + "px";
	div.style.zIndex = style.zIndex ? style.zIndex + 1 : 2;

	div.style.border="1px dashed #6ec17988"

	document.body.appendChild(div);

	div.addEventListener('dragover', e => e.preventDefault())

	div.addEventListener('drop', e => {

		el.contentWindow.postMessage({
			drop: true,
			pageX:e.pageX, 
			pageY:e.pageY,
			clientX:e.clientX,
			clientY:e.clientY,
			offsetX:e.offsetX,
			offsetY:e.offsetY,
			screenX:e.screenX,
			screenY:e.screen
		}, el.src);

	});

	document.addEventListener('dragend', e => {
		if (div && div.parentNode) div.parentNode.removeChild(div)
	}, {once: true});

	return div;
}

