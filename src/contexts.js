const contexts = ["audio", "frame", "image", "link", "page", "selection", "video"];
const contextCodes = [1,2,4,8,16,32,64];

function hasContext(contextText, contextCode) {

	if ( Array.isArray(contextText) ) 
		return contextText.map(c => hasContext(c, contextCode)).reduce( (a,b) => a || b );

	let code = contextCodes[contexts.indexOf(contextText)];
	return ( (contextCode & code ) === code );			
}

function filterContexts(root, context) {

	let filteredNodeTree = JSON.parse(JSON.stringify(root));

	traverseNodesDeep(filteredNodeTree, ( node, parent ) => {
		// if ( !['folder', 'searchEngine'].includes(node.type) && !node.contexts && !context.includes("selection") )
		// 	removeNode( node, parent );

		if ( node.type === 'searchEngine' ) {
			let se = userOptions.searchEngines.find( _se => _se.id === node.id );
			if ( se && (!se.contexts || !hasContext(context, se.contexts)) )
				return removeNode( node, parent );
		}

		if ( node.contexts && !hasContext(context, node.contexts))
			return removeNode(node, parent);

		if ( node.type === 'folder' && node.children.length === 0 )
			if ( parent ) return removeNode( node, parent );

	});

	return filteredNodeTree;
}