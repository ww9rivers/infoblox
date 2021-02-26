//Load Node Modules
const axios = require('axios');

class Infoblox {
  	/**
  	* InfoBlox Constructor
	* @param {Object} config
	* @param {String} config.wapiIp (Ip Address of Infoblox Server)
	* @param {String} config.wapiVersion = 2.1
	*/
	constructor(config) {
		this.url = `https://${config.ip}/wapi/v${config.apiVersion}/`;
		this.containers = [];
		this.reqOptions = {
			url: String,
			method: String,
			strictSSL: false,
			data: Object,
			auth: Object,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
    			}
  		};
	}

	_req (path, data) {
		this.reqOptions.url = this.url + path;
		this.reqOptions.method = data.method;
		this.reqOptions.data = data.json;
		let options = this.reqOptions;
		return axios(options);
		// Handle Certain Auth Errors
		// if(res.statusCode === 403)
	}

	login (user, pwd) {
		this.reqOptions.auth = {
			user: user,
			pass: pwd
  		};
  		return this._req('grid', {
			method: 'GET'
		}).then(res => {
			try {
				let resBody = JSON.parse(res.body);
				this.grid = resBody[0]._ref;
				this.reqOptions.headers.Cookie = res.headers['set-cookie'];
				delete client.reqOptions.auth;
				return true;
			} catch(err) {
				return false;
			}
		});
	}

	logout () {
		return this._req('logout', { method: 'POST' });
	}

	reqServiceStatus (opts) {
		let grid = this.grid;
		let fn = '?_function=requestrestartservicestatus';
  		return this._req(grid + fn, {
			method: 'POST',
			json: { 'service_option': opts.toUpperCase() }
		});
	}

	restartServices () {
		let grid = this.grid;
		let fn = '?_function=restartservices';
		return this._req(grid + fn, {
			method: 'POST',
			json: {
      				member_order: 'SIMULTANEOUSLY',
      				service_option: 'ALL'
    			}
  		});
	}

	getNetwork (subnet) {
		let query = 'network?network=' + subnet + '&_return_fields%2B=extattrs';
		return this._req(query, { method: 'GET' });
	}

	// sample Extra Attribute:
	// {
	//   "Site": { "value": "East" }
	// }
	createNetwork (parentNetId, network, comment, extattrs) {
  		return this._req(`${parentNetId}`, {
			json: { network, comment, extattrs},
			method: 'POST'
  		});
	}

	deleteObject (ref) { return this.delete(`${ref}`); }

	getNetworkFromIp (ip) {
		return this.getHost(ip).then(data => {
			try {
				let result = JSON.parse(data);
				if (result instanceof Array) {
					let network = result[0];
					return this.getNetwork(network);
				} else if (result.Error) {
					throw { error: result.text };
				}
			} catch(e) {
				throw e;
			}
		});
	}

	getNetworkByAttr (vlan) {
		return this._req('network?_return_fields%2B=extattrs&*VLAN=' + vlan, {
			method: 'GET'
		});
	}

	getHostByAttr (query) {
		let path = 'record:host?_return_fields%2B=extattrs';
		return this._req(path + query, { method: 'GET' });
	}

	getIpsFromSubnet (subnet) {
		let query = 'ipv4address?network=' + subnet + '&_max_results=10000';
		return this._req(query, { method: 'GET' });
	}

	getContainer (container) {
		return this._req('networkcontainer?network=' + container, {
			method: 'GET'
		});
	}

	getNetworksFromContainer (container) {
		let query = 'network?network_container=' + container + '&_return_fields%2B=extattrs';
		return this._req(query, {
			method: 'GET'
		});
	}

	_containersRecursion (container) {
		return this._req('networkcontainer?network_container=' + container, {
			method: 'GET'
		}).then(res => {
			let containers = JSON.parse(res);
			return Promise.each(containers, ({ network }) => {
				this.containers.push(network);
				return this._containersRecursion(network);
			});
		});
	}

	getContainersFromContainer (container) {
		if (this.containers.length > 0) this.containers = [];
		return this._containersRecursion(container).then(() => {
			return this.containers;
		});
	}

	getNext (netId, num) {
		return this._req(netId + '?_function=next_available_ip', {
			json: { num: num },
			method: 'POST'
		}).then(function(data) {
			if (data && data.text) {
				return data.text;
			}
			return data.ips;
		});
	}

	getNextIps (num, refId, subnet) {
		if (subnet) {
			return this.getNetwork(subnet).then(data => {
				return JSON.parse(data)[0]['_ref'];
			}).then(ref => {
				return this.getNext(ref, num);
			});
		} else {
			return this.getNext(refId, num).then(data => {
				return data.ips;
			});
		}
	}

	getNextSubnets ({ netId, cidr, num }) {
		return this._req(`${netId}?_function=next_available_network`, {
			json: { num, cidr },
			method: 'POST'
		}).then(data => {
			if (data && data.text) return Promise.reject(data.text);
			return data;
		});
	}

	getHost (ip) {
		return this.list('ipv4address?_return_fields%2B=extattrs&ip_address=' + ip);
	}

	getDomain () {
		return this.list('zone_auth').then(data => {
			let zones = JSON.parse(data);
			return Promise.filter(zones, zone => {
				//We don't want Numeric Domain Names
				return !parseInt(zone.fqdn.substring(0, 1));
				//MAP and Return New Array - Numeric Domains/Zones
			}).map(zone => {
				return zone.fqdn;
			});
		});
	}

	getAdminGroup () { return this.list('admingroup'); }

	/**
	 * @param {Object} permission - Properties to assign perms to objects
	 * @param {String} permission.group - Admin Group Name
	 * @param {String} permission.permission - READ | WRITE | DENY
	 * @param {String} permission.object - _REFID of Container/Network
	 */
	addPermission (permission) {
		return this.create('permission', permission);
	}

	getMemberServers () {
		return this._req('member:dns', {
			method: 'GET'
		}).then(hosts => {
			return JSON.parse(hosts).map(host => {
				return {
					hostname: host['host_name'],
					ip: host['ipv4addr']
				};
			});
		});
	}

	// Generic Methods You Can Use if You Know the API
	create (path, data) { return this._req(path, { method: 'POST', json: data }); }
	delete (id) { return this._req(id, { method: 'DELETE' }); }
	list (path) { return this._req(path, { method: 'GET' }); }
	update (path, data) { return this._req(path, { method: 'PUT', json: data }); }
}
module.exports = Infoblox;