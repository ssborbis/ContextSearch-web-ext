
let DragShake = function() {

	var start = null;
	let lastMovementX = 0;
	let reversals = [];
	const shake_threshold = 5;

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

	function dragHandler(e) {
		let deltaX = e.clientX - start.x;

		if ( deltaX * lastMovementX < 0 )
			reversals.push(Date.now());

		if ( reversals.length > shake_threshold ) reversals.shift();

		lastMovementX = deltaX;

		if ( reversals.length === shake_threshold && Date.now() - reversals[0] < 1000 ) {
			stop();
			shake();
		}
	}

	return this;
}
