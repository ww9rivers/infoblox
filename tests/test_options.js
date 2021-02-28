const Infoblox = require('../lib/infoblox');
const expect = require('chai').expect;

const test_1 = '_max_results=11&_return_fields=field1,extras&_return_as_object=0&_paging=1&_page_id=2';
expect(Infoblox.encode_options({
	_max_results:		11,
	_return_fields:		[ 'field1', 'extras' ],
	_return_as_object:	false,
	_paging:		true,
	_page_id:		2
})).to.equal(test_1);
expect(() => Infoblox.encode_options({
	aaa: 3
})).to.throw('Unknown option: aaa');