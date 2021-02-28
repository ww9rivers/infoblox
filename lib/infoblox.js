//Load Node Modules
const axios = require('axios');
const	TYPE_INT	= 0,
	TYPE_BOOL	= 1,
	TYPE_ARRAY	= 3,
	TYPE_STR	= 4;
const API_OPTIONS = {	// Option mapping to value type
	_max_results:		TYPE_INT,	// Integer: Number of results to return.
	_return_fields:		TYPE_ARRAY,	// Comma separated list of field names.
	"_return_fields+":	TYPE_ARRAY,	// Comma separated list of additional field names.
	_return_as_object:	TYPE_BOOL,	// For paging: If set to 1, a results object will be returned.
	_paging:		TYPE_BOOL,	// If set to 1, the request is considered a paging request.
	_page_id:		TYPE_INT,	// If set, the specified page of results will be returned.
	_proxy_search:		TYPE_STR,	// GM=Grid master; LOCAL=the request is processed locally.
	_schema:		TYPE_BOOL,	// Return a WAPI schema.
	_schema_version:	TYPE_INT,	// Returned a WAPI schema of a particular version.
	_get_doc:		TYPE_BOOL,	// Return a v2 WAPI schema with documentation.
	_schema_searchable:	TYPE_BOOL,	// Search only fields will also be returned (only for v2)
	_inheritance:		TYPE_BOOL	// If set to True, fields which support inheritance, will display data properly.
};
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
			auth: config.auth||Object,
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
  		return this.list('grid').then(res => {
			delete this.reqOptions.auth;
			try {
				let resBody = JSON.parse(res.body);
				this.grid = resBody[0]._ref;
				this.reqOptions.headers.Cookie = res.headers['set-cookie'];
				return true;
			} catch(err) {
				return false;
			}
		}).catch(err => {
			delete this.reqOptions.auth;
		});
	}

	logout () {
		return this.post('logout');
	}

	reqServiceStatus (opts) {
		return this.post(this.grid + '?_function=requestrestartservicestatus',
			{ 'service_option': opts.toUpperCase() });
	}

	restartServices () {
		return this.post(this.grid + '?_function=restartservices', {
			member_order: 'SIMULTANEOUSLY',
			service_option: 'ALL'
    		});
	}

	getNetwork (subnet) {
		return this.list('network?network=' + subnet + '&_return_fields%2B=extattrs');
	}

	// sample Extra Attribute:
	// {
	//   "Site": { "value": "East" }
	// }
	createNetwork (parentNetId, network, comment, extattrs) {
		return this.post(`${parentNetId}`, { network, comment, extattrs});
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
		return this.list('network?_return_fields%2B=extattrs&*VLAN=' + vlan);
	}

	getHostByAttr (query) {
		return this.list('record:host?_return_fields%2B=extattrs' + query);
	}

	getIpsFromSubnet (subnet) {
		return this.list('ipv4address?network=' + subnet + '&_max_results=10000');
	}

	getContainer (container) {
		return this.list('networkcontainer?network=' + container);
	}

	getNetworksFromContainer (container) {
		return this.list('network?network_container=' + container + '&_return_fields%2B=extattrs');
	}

	_containersRecursion (container) {
		return this.list('networkcontainer?network_container=' + container).then(res => {
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
		return this.post(netId + '?_function=next_available_ip', { num: num }).then(data => {
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
		return this.post(`${netId}?_function=next_available_network`, { num, cidr }).then(data => {
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
		return this.post('permission', permission);
	}

	getMemberServers () {
		return this.list('member:dns').then(hosts => {
			return JSON.parse(hosts).map(host => {
				return {
					hostname: host['host_name'],
					ip: host['ipv4addr']
				};
			});
		});
	}

	// Generic Methods You Can Use if You Know the API
	post (path, data) { return this._req(path, { method: 'POST', json: data }); }
	delete (id) { return this._req(id, { method: 'DELETE' }); }
	list (path) { return this._req(path, { method: 'GET' }); }
	update (path, data) { return this._req(path, { method: 'PUT', json: data }); }

	// Encode all known options, ignore all others.
	static encode_options (opts) {
		let res = '';
		for (let opt in opts) {
			let val = opts[opt];
			switch (API_OPTIONS[opt]) {
			case TYPE_ARRAY:	// takes Array or string
				if (val instanceof Array) { val = val.join(','); }
				break;
			case TYPE_BOOL:
				val = (val) ? 1 : 0;
				break;
			case TYPE_INT:
				val = parseInt(val);
				break;
			case TYPE_STR:
				break;
			default:
				throw new Error(`Unknown option: ${opt}`);
			}
			if (res) { res += `&`; }
			res += `${opt}=${val}`;
		}
		return res;
	}
}
module.exports = Infoblox;