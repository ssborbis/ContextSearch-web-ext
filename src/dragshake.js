
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

		if (Math.abs(deltaX) > 2 && dir != last_dir ) {
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
