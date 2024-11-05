const contexts = ["audio", "frame", "image", "link", "page", "selection", "video"];
const contextCodes = [1,2,4,8,16,32,64];

function getContextCode(t) {
	return contextCodes[contexts.indexOf(t)]
}

function hasContext(contextText, contextCode) {

	if ( Array.isArray(contextText) ) 
		return contextText.map(c => hasContext(c, contextCode)).reduce( (a,b) => a || b );

	let code = getContextCode(contextText);
	return ( (contextCode & code ) === code );			
}

function filterContexts(root, context) {

	let filteredNodeTree = JSON.parse(JSON.stringify(root));

	traverseNodesDeep(filteredNodeTree, ( node, parent ) => {

		if ( node.type === 'searchEngine' ) {
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			let _contexts = node.contexts || se.contexts;
			if ( se && (!_contexts || !hasContext(context, _contexts)) )
				return removeNode( node, parent );
		}

		if ( node.contexts && node.type !== 'tool' && !hasContext(context, node.contexts)) {
			return removeNode(node, parent);
		}

		if ( node.type === 'folder' && node.children.length === 0 )
			if ( parent ) return removeNode( node, parent );

		// remove folders with only separators
		if ( node.type === 'folder' && node.children.length === node.children.filter(n => n.type === "separator").length )
			if ( parent ) return removeNode( node, parent );

	});

	if ( userOptions.removeConsecutiveSeparators )
		removeConsecutiveSeparators(filteredNodeTree);

	return filteredNodeTree;
}