
let DragShake = function() {

	var start = null;
	let lastMovementX = 0;
	let reversals = [];
	const shake_threshold = 5;
	let last_dir = 0;
	let last_x = 0;

	this.start = () => {
		document.addEventListener('dragover', e => {
		    start = {x: e.clientX, y: e.clientY}
		}, {once: true});

		document.addEventListener('dragover', dragHandler);
	}
	stop = () => document.removeEventListener('dragover', dragHandler);

	this.onshake = () => {}
	shake = () => this.onshake();
	this.stop = stop;

	// function dragHandler(e) {
	// 	let deltaX = e.clientX - start.x;

	// 	if ( deltaX * lastMovementX < 0 )
	// 		reversals.push(Date.now());

	// 	if ( reversals.length > shake_threshold ) reversals.shift();

	// 	lastMovementX = deltaX;

	// 	if ( reversals.length === shake_threshold && Date.now() - reversals[0] < 1000 ) {
	// 		stop();
	// 		shake();
	// 	}
	// }

	function dragHandler(e) {

		let deltaX = last_x - e.clientX;
		let dir = deltaX > 0 ? 1 : -1;

		if (Math.abs(deltaX) > userOptions.shakeSensitivity && dir != last_dir ) {
			reversals.push(Date.now());
		}

		if ( reversals.length > shake_threshold ) reversals.shift();

		last_dir = dir;
		last_x = e.clientX;

		if ( reversals.length === shake_threshold && Date.now() - reversals[0] < 1000 ) {
			stop();
			shake();
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

