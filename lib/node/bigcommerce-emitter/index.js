var events = require("events"),
	wwwdude = require("wwwdude"),
	async = require("async"),
	dateformat = require("dateformat"),
	util = require('util');

var _version = "0.0.1";

var _rfc = function (date) {
	// e.g.: Thu, 18 Aug 2011 06:44:17 +0000
	return dateformat(date, "ddd, dd mmm yyyy HH:MM:ss o");
};

var _each = function (hash, callback, context) {
	for (var key in hash) {
		if (!hash.hasOwnProperty(key)) {
			continue;
		}
		callback.apply(context || hash, [key, hash[key]]);
	}
};

var _combine = function (a, b) {
	// @todo use arguments list instead of a, b
	Object.keys(b).forEach(function(key){
		a[key] = b[key];
	});
	return a;
};

var create = exports.create = function create (createOptions) {
	var emitter = new events.EventEmitter();

	createOptions = _combine({
		interval: 15000,
		baseUrl: '',
		createdFilter: 'min_date_created',
		createdField: 'date_created',
		modifiedField: 'date_modified'
	}, createOptions);

	var _debug;
	if (createOptions.debug) {
		_debug = function (data) {
			console.dir(data);
		};
	} else {
		_debug = function(){};
	}

	var watchers = {};

	emitter.watch = function (options) {
		_debug("watch: " + options.resource);

		options = _combine({
			username: createOptions.username,
			token: createOptions.token,
			interval: createOptions.interval,
			createdFilter: createOptions.createdFilter,
			createdField: createOptions.createdField,
			modifiedField: createOptions.modifiedField,
			lastCheck: new Date(),
			create: false,
			update: false,
			unwatch: false
		}, options)

		var watcher;
		if (watchers[options.resource]) {
			watcher = watchers[options.resource];
		} else {
			watcher = {};

			watcher.stopped = false;

			watcher.lastCheck = options.lastCheck;

			watcher.triggers = {
				create: [],
				update: [],
				unwatch: []
			};

			watcher.client = wwwdude.createClient({
				contentParser: wwwdude.parsers.json,
				headers: {
					"User-Agent": "node-bc-emitter/" + _version,
					"Accept": "application/json",
					"Content-Type": "application/json",
					"Authorization": "Basic " + (new Buffer(options.username + ":" + options.token)).toString("base64")
				}
			});

			var trigger = function (event, item) {
				_debug("triggering " + event);
				_each(watcher.triggers[event], function(key, emit){
					emitter.emit(emit, item);
				});
			};

			watchers[options.resource] = watcher;

			var loop = [];

			loop.push(function(next){
				_debug("sleeping");
				setTimeout(next, options.interval);
			});

			loop.push(function(next){
				var parallel = {};

				parallel.modified = function(done) {
					var url = createOptions.baseUrl + options.resource;
					var since = _rfc(watcher.lastCheck);
					var headers = {
						"If-Modified-Since": since
					};

					_debug("requesting " + options.resource + " modified since " + since);

					watcher.client.get(url, { headers: headers })
						.on("200", function(data, response){
							done(null, data);
						})
						.on("204", function(){ done(null, []); })
						.on("3XX", function(){ done(null, []); })
						.on("http-error", function(data, response){
							_debug(data);
							done(null, []);
						})
						.on("error", function(err){
							_debug(err);
							done(null, []);
						});
				};

				if (options.createdFilter) {
					parallel.created = function(done){
						var since = _rfc(watcher.lastCheck);
						var url = createOptions.baseUrl + options.resource + "?" + options.createdFilter + "=" + encodeURIComponent(since);

						_debug("requesting " + options.resource + " created since " + since);

						watcher.client.get(url)
							.on("200", function(data, response){
								done(null, data);
							})
							.on("204", function(){ done(null, []); })
							.on("3XX", function(){ done(null, []); })
							.on("http-error", function(data, response){
								_debug(data);
								done(null, []);
							})
							.on("error", function(err){
								_debug(err);
								done(null, []);
							});
					};
				} else {
					// dummy created function when a resource doesn't support it
					parallel.created = function (done) {
						done(null, []);
					};
				}

				async.parallel(parallel, function(err, results){
					_debug("requests all done, summarising");

					_each(results.created, function(key, created){
						trigger("create", created);

						// if this created order is in the modified order list and has the same modified date then
						// remove it from the list so we don't announce it twice
						if (options.createdField && options.modifiedField) {
							for (var i = results.modified.length; i--;) {
								var modified = results.modified[i];
								if (modified.id == created.id && modified[options.createdField] == modified[options.modifiedField]) {
									_debug("not announcing modified " + modified.id);
									results.modified.splice(i, 1);
								}
							}
						}
					});

					_each(results.modified, function(key, modified){
						trigger("update", modified);
					});

					next();
				});

				// @todo there's an accuracy issue with this if our request takes too long, we may need to use the
				// highest modified/created date received as the lastCheck instead
				watcher.lastCheck = new Date();
			});

			loop.push(function(next){
				_debug("looping");
				next();
				async.series(loop);
			});

			async.series(loop);
		}

		// @todo don't push duplicates

		if (options.create) {
			watcher.triggers.create.push(options.create);
		}

		if (options.update) {
			watcher.triggers.update.push(options.update);
		}

		if (options.unwatch) {
			watcher.triggers.unwatch.push(options.unwatch);
		}

		_debug("triggers:");
		_debug(watcher.triggers);

		return this;
	};

	emitter.unwatch = function (resource) {
		var watcher = watchers[resource];
		watcher.stopped = true;
		// @todo loop and trigger the 'unwatch' list
		return this;
	};

	return emitter;
};
