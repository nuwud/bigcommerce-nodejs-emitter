var bc = require('bigcommerce-emitter').create({
	username: 'admin',
	token: '...',
	baseUrl: 'https://www.example.com/api/v2'
});

// watch the orders resource and emit some created and updated events
bc.watch({
	resource: '/orders',
	create: 'order-created',
	update: 'order-updated'
});

// as above, for customers
bc.watch({
	resource: '/customers',
	create: 'customer-created',
	update: 'customer-updated'
});

// now listen for new or updated orders or customers...

bc.on('order-created', function(order){
	// new order
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
