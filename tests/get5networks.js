const	Infoblox = require('../lib/infoblox'),
	query = require('../lib/query'),
	config = require('../etc/config.json');
var options = {
	_max_results: 5,
	_return_fields: [ 'comment', 'members', 'network', 'extattrs' ],
	_paging: true,
	_return_as_object: true,
	//_page_id: 1
}

var ipam = new Infoblox(config);
ipam.list('network?'+query.encode(options))
.then(resp => {
	console.log(resp.data);
	let page = resp.data.next_page_id;
	if (page) { options._page_id = page; }
	return ipam.list('network?'+query.encode(options));
}).then(resp => {
	console.log(resp.data);
}).catch(err => console.log(err));