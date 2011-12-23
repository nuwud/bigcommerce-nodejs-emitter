var bc = require('bc-emitter').create({
	username: 'admin',
	token: '...',
	baseUrl: 'https://www.example.com/api/v2'
});

bc.watch({
	resource: '/orders',
	create: 'order-created',
	update: 'order-updated'
});

bc.watch({
	resource: '/customers',
	create: 'customer-created',
	update: 'customer-updated'
});

bc.on('order-created', function(order){
	// order order
});

bc.on('order-updated', function(order){
	// updated order
});

bc.on('customer-created', function(customer){
	// new customer
});

bc.on('customer-updated', function(customer){
	// customer updated
});
