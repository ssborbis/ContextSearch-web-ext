function findNodes(tree, callback) {
		
	let results = [];
	
	function _traverse(node, parent) {
		
		if ( callback(node, parent) ) results.push(node);
		
		if (node && node.children) {
			for (let child of node.children) {
				_traverse(child, node);
			}
		}
	}
	
	_traverse(tree, null);
	 
	return results;
}

var setParent = function(o){
	
	if(o.children != undefined){
		
		for(n in o.children) {

			// build the JSON.stringify function, omitting parent
			o.children[n].toJSON = function() {
				let rObj = {};
				
				// skip parent property
				Object.keys(this).forEach(function(key,index) {
					if (key !== "parent") rObj[key] = this[key];
				}, this);

				return rObj;
		  }
		  o.children[n].parent = o;
		  setParent(o.children[n]);
		}
	}
}

function removeNodesById(tree, id) {
	
	findNodes( tree, (node, parent) => {
		if (node.id == id) parent.children.splice(parent.children.indexOf(node), 1);
	});

}