(() => {
	
	let div = document.createElement('div');
	div.style = 'position:fixed;top:0;bottom:0;left:0;right:0;background-color:rgba(0,0,0,.5);z-index:2;text-align:center';
	
	div.onclick = function() {
		div.parentNode.removeChild(div);
	}
	
	let text = document.createElement('div');
	
	text.innerHTML = `
		<div style='text-align:left;background-color:#fefefe;width:600px;padding:20px;border-radius:10px;margin:15vh auto;line-height:24px'>
			<h3 style="text-align:center">ContextSearch web-ext Updated</h3>
			
			<hr />
			
			<ul>
				<li>new options page</li>
				<li>highlight search terms in results pages</li>
				<li>separate Toolbar / Sidebar columns settings </li>
				<li>links can be searched by url or text displayed</li>
				<li>quick menu works with links and images ( can be disabled )</li>
				<li>sidebar can be set as overlay or full-height panel</li>
				<li>merged theme settings</li>
				<li>Toolbar width fix with low column count on FF</li>
				<li>special template param {selectdomain} can be used with site-search engines to give an expanding menu with path options</li>
				<li>added restore defaults button to search engine manager</li>	
				<li>many small tweaks and fixes</li>
			</ul>

		</div>
		`;
		
	div.appendChild(text);
	document.body.appendChild(div);
})();