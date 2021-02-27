const	Infoblox = require('../lib/infoblox'),
	config = require('./config.json');

var ipam = new Infoblox(config);
ipam.list('network?_max_results=5&_return_type=json&_return_fields=comment,members,network,extattrs')
.then(resp => {
	console.log(resp.data);
}).catch(err => console.log(err));