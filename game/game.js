(function (){

if( document.getElementById('flf-config'))
{
	var flf_config = document.getElementById('flf-config').innerHTML;
	flf_config = JSON.parse(flf_config);
	requirejs.config(
	{
		baseUrl: flf_config.root || '',
		paths:
		{
		},
		config:
		{
		}
	});
}

requirejs(['core/support',
'LF/loader!'+flf_config.package,'LF/manager',
'LF/util','./buildinfo.js','core/css!LF/application.css'],
function(Fsupport,
package,Manager,
util,buildinfo){

	if(typeof(console) === 'undefined') {
		console = {};
		console.log = console.error = console.info = console.debug = console.warn = console.trace = console.dir = console.dirxml = console.group = console.groupEnd = console.time = console.timeEnd = console.assert = console.profile = function() {};
	}

	console.log(util.div('projectFmessage').innerHTML);

	if( flf_config.package.indexOf('http')===0)
	{
		package.path = flf_config.package;
		package.location = flf_config.package;
	}
	else
	{
		package.path = util.normalize_path(flf_config.package);
		package.location = util.normalize_path(flf_config.root+flf_config.package);
	}

	util.div('window_caption_title').innerHTML = buildinfo.version;

	var manager = new Manager(package, buildinfo);

});

}());
