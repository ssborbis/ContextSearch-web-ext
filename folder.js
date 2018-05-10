var userOptions = {};
var root = [
	{type: "searchengine", index: 0},
	{type: "separator"},
	{type: "folder", children: []}
];

function move(obj, parentNode, newIndex) {
	
}

function testXML () {

var xml = "<root>\
<engine index=0 />\
<separator />\
<folder name='firstfolder'>\
	<engine index=1 />\
	<separator />\
	<engine index=2 />\
</folder>\
<engine index=3 />\
<separator />\
<engine index=4 />\
</root>";

parser = new DOMParser();
xmlDoc = parser.parseFromString(xml,"text/xml");


}

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
});

