const	TYPE_INT	= 0,
	TYPE_BOOL	= 1,
	TYPE_ARRAY	= 3,
	TYPE_STR	= 4;
const API_OPTIONS = {	// Option mapping to value type
	_max_results:		TYPE_INT,	// Integer: Number of results to return.
	_return_fields:		TYPE_ARRAY,	// Comma separated list of field names.
	"_return_fields%2B":	TYPE_ARRAY,	// Comma separated list of additional field names.
	_return_as_object:	TYPE_BOOL,	// For paging: If set to 1, a results object will be returned.
	_return_type:		TYPE_STR,	// Valid choices: json, json-pretty, xml, xml-pretty.
	_paging:		TYPE_BOOL,	// If set to 1, the request is considered a paging request.
	_page_id:		TYPE_STR,	// If set, the specified page of results will be returned.
	_proxy_search:		TYPE_STR,	// GM=Grid master; LOCAL=the request is processed locally.
	_schema:		TYPE_BOOL,	// Return a WAPI schema.
	_schema_version:	TYPE_INT,	// Returned a WAPI schema of a particular version.
	_get_doc:		TYPE_BOOL,	// Return a v2 WAPI schema with documentation.
	_schema_searchable:	TYPE_BOOL,	// Search only fields will also be returned (only for v2)
	_inheritance:		TYPE_BOOL,	// If set to True, fields which support inheritance, will display data properly.
	lease_state:		TYPE_STR,	// ACTIVE, FREE, or absent
	network:		TYPE_STR,	// Network address, in CIDR format.
	status:			TYPE_STR	// ipv4address status
};
const OPERATORS = [ '=', '<', '>', '!=', '<=', '>=', ':=', '~=' ];

module.exports = {
	// Encode all known options, ignore all others.
	encode: opts => {
		let res = '';
		for (let opt in opts) {
			let val = opts[opt];
			let op = '=';
			if (val instanceof Array && val.length == 2 && OPERATORS.includes(val[0])) {
				op = val[0];
				val = val[1];
			}
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
			res += `${opt}${op}${val}`;
		}
		return res;
	}
};