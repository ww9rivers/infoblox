/**
 *	Command line tool to query Infoblox for all IPv4 addresses used
 */
const	Infoblox = require('../lib/infoblox'),
	query = require('../lib/query'),
	c9rpath = require('c9r/file/path'),
	c9rutil = require('c9r/file/util'),
	config = require('../etc/config.json');

let	ipv4 = [],
	subnet = [],
	ip_count = 0,
	subnet_count,
	discovery_done = false,
	outputer,
	ipam = new Infoblox(config);

/**
 * Function to write out the data.
 */
function init_output () {
	outputer = new Promise((resolve) => {
		let count = 0, free = 0;
		c9rutil.forge_path(config.output.dir);
		let outf = c9rpath.rotated_stream(config.output.dir, config.output.template, {
			autoClose: true
		});
		setInterval(() => {
			do {
				let ipset = ipv4.pop();
				// TO-DO: Filter out lease_state == 'FREE'
				if (!ipset) {
					if (discovery_done) {
						outf.close();
						resolve([count, free]);
					}
					break;
				}
				ipset.forEach(xip => {
					if (xip.lease_state != 'FREE') {
						delete xip._ref;
						outf.write(JSON.stringify(xip)+'\n');
						count++;
					} else { free++; }
				});
			} while (true);
		}, 1000);
	})
}

/**
 * Function to query and page IPv4 addresses on a given subnet.
 *
 * @param net	Network object returned from Infoblox.
 * @returns /net/ if this network is not done yet; Or, false if no more pages.
 */
let ipv4_options = {
	_paging: true,
	_return_as_object: true,
	_max_results: 1000,
	// _page_id: null
	'_return_fields%2B': [ 'discovered_data' ],
	_return_type: 'json',
	// lease_state: [ '!=', 'FREE' ],	// Can only be searched with = / :=
	status: 'USED',
	network: null
}
function page_ipv4 (net) {
	ipv4_options.network = net.network;
	return ipam.list('ipv4address?'+query.encode(ipv4_options)).then(resp => {
		// Push this result set to stack and start output:
		let len = resp.data.result.length;
		// console.log(`ipv4 has ${ipv4.length} IP set(s). ${net.network} has ${len} IPs.`);
		if (len > 0) {
			ipv4.push(resp.data.result);
			ip_count += len;
		}
		if (!outputer) { init_output(); }
		let page = resp.data.next_page_id;
		if (!page) {
			delete ipv4_options._page_id;
			return false;
		}
		ipv4_options._page_id = page;
		return net;
	}).catch(err => console.error(err));
}

/**
 * Function to query for the next page of subnets.
 */
let options = {		// Network entry listing options
	_paging: true,
	_return_as_object: true,
	_max_results: 1000,
	// _page_id: null
	_return_fields: [ 'comment', 'members', 'network', 'extattrs' ]
}
function page_subnet () {
	return ipam.list('network?'+query.encode(options)).then(resp => {
		// console.log(resp.data);
		subnet = subnet.concat(resp.data.result);
		let page = resp.data.next_page_id;
		if (!page) { return false; }
		options._page_id = page;
		return true;
	}).catch(err => console.log(err));
}

/**
 * Async function to wait on subnet paging, as one page leads to the next.
 */
async function main () {
	let more_subnet = true;
	do {
		more_subnet = await page_subnet();
	} while(more_subnet);
	subnet_count = subnet.length;
	do {
		if (!more_subnet && !(more_subnet = subnet.pop())) {
			discovery_done = true;
			break;
		}
		more_subnet = await page_ipv4(more_subnet);
	} while(true);
	let count = await outputer;
	console.log(`${ip_count} IPv4 addresses found in ${subnet_count} subnets, ${count[0]} used / ${count[1]} free.`);
	process.exit(0);
}
main();