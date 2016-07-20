const Path = require('path');

exports.install = function() {
	F.route('/api/apps/',              json_query,            ['*Application']);
	F.route('/api/apps/',              json_apps_save,        ['post', '*Application', 50000]);
	F.route('/api/apps/info/',         json_apps_info,        ['*Application', 20000]);
	F.route('/api/stats/',             json_stats,            [20000]);
	F.route('/api/apps/{id}/',         json_read,             ['*Application']);
	F.route('/api/apps/{id}/restart/', json_apps_restart,     ['*Application', 20000]);
	F.route('/api/apps/{id}/stop/',    json_apps_stop,        ['*Application', 20000]);
	F.route('/api/apps/{id}/remove/',  json_apps_remove,      ['delete', '*Application', 20000]);
	F.route('/api/apps/{id}/logs/',    json_apps_logs,        ['*Application']);
	F.route('/api/apps/{id}/pack/',    file_apps_pack,         ['*Application']);
	F.route('/api/apps/restart/',      json_apps_restart,     ['*Application', 50000]);
	F.route('/api/apps/stop/',         json_apps_stop,        ['*Application', 50000]);
	F.route('/api/apps/reconfigure/',  json_apps_reconfigure, ['*Application', 120000]);
	F.route('/api/apps/upload/',       json_apps_upload,      ['upload', 120000], 1024 * 50); // Max 50 MB
	F.route('/api/apps/unpack/',       json_apps_unpack,      ['post', '*Package', 120000]);
	F.route('/api/apps/backup/',       json_apps_backup,      [500000]);
	F.route('/api/apps/monitor/',      json_apps_monitor,     [60000]);
};

function json_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

function json_save() {
	var self = this;
	self.$save(self.callback());
}

function json_apps_save() {
	var self = this;
	self.$async(self.callback(), 1).$workflow('check').$workflow('port').$save().$workflow('nginx');
}

function json_apps_info() {
	var self = this;
	self.$workflow2('info', self.callback());
}

function json_read(id) {
	var self = this;
	self.$read(id, self.callback());
}

function json_apps_remove(id) {
	var self = this;
	self.$remove(id, self.callback());
}

function json_apps_restart(id) {
	var self = this;

	// restarts all
	if (!id) {
		var errors = [];
		APPLICATIONS.wait(function(item, next) {
			SuperAdmin.restart(item.port, function(err) {
				err && errors.push(err);
				next();
			});
		}, () => self.json(SUCCESS(true, errors)));
		return;
	}

	var app = APPLICATIONS.find('id', id);
	if (!app)
		return self.invalid().push('error-app-404');
	SuperAdmin.restart(app.port, (err) => self.json(SUCCESS(true, err)));
}

function json_apps_stop(id) {
	var self = this;

	// stops all
	if (!id) {
		var errors = [];
		APPLICATIONS.wait(function(item, next) {
			SuperAdmin.kill(item.port, function(err) {
				err && errors.push(err);
				next();
			});
		}, () => self.json(SUCCESS(true, errors)));
		return;
	}

	var app = APPLICATIONS.find('id', id);
	if (!app)
		return self.invalid().push('error-app-404');
	SuperAdmin.kill(app.port, (err) => self.json(SUCCESS(true, err)));
}

function json_apps_logs(id) {
	var self = this;
	self.$workflow('logs', id, self.callback());
}

function json_apps_reconfigure() {
	var self = this;
	var errors = [];

	APPLICATIONS.wait(function(item, next) {
		var model = GETSCHEMA('Application').create();
		U.copy(item, model);
		model.$async(function(err) {
			err && errors.push(model.id, err);
			next();
		}).$workflow('check').$workflow('port').$workflow('nginx');
	}, function() {

		if (!errors.length) {
			self.json(SUCCESS(true));
			return;
		}

		var err = self.invalid();
		for (var i = 0, length = errors.length; i < length; i++)
			err.push(errors[i]);
	});
}

function json_stats() {
	var self = this;
	SuperAdmin.sysinfo((err, response) => self.json(response));
}

function json_apps_upload(argument) {
	var self = this;
	var app = APPLICATIONS.findItem('id', self.body.custom);
	if (!app)
		return self.json(SUCCESS(false));

	var file = self.files[0];
	var filename = Path.join(CONFIG('directory-www'), app.url.superadmin_linker(), app.id + '.package');

	file.copy(filename, function(err) {
		if (err)
			return self.invalid().push(err);
		self.json(filename);
	});
}

function json_apps_unpack() {
	var self = this;
	self.$async(self.callback(), 4).$workflow('check').$workflow('stop').$workflow('remove').$workflow('unpack').$workflow('restart');
}

function file_apps_pack(id) {
	var self = this;
	var app = APPLICATIONS.findItem('id', id);
	if (!app)
		return self.invalid().push('error-app-404');

	var linker = app.url.superadmin_linker();
	var directory = Path.join(CONFIG('directory-www'), linker);
	var backup = Path.join(directory, linker + '_backup.package');

	F.backup(backup, directory, () => self.file('~' + backup, U.getName(backup)), (filename) => filename.match(/(\/tmp\/|_backup\.package)/g) ? false : true);
}

function json_apps_backup() {
	var self = this;
	SuperAdmin.backup(function(err, filename) {
		if (err)
			return self.invalid().push(err);
		self.file('~' + filename, U.getName(filename));
	});
}

function json_apps_monitor() {
	var self = this;
	var output = {};

	APPLICATIONS.wait(function(item, next) {
		if (!item.monitor)
			return next();
		U.request(item.url + item.monitor, ['get', 'dnscache'], function(err, response) {

			var data = response.parseJSON();
			if (data) {
				var obj = {};
				obj.errors = data.errors;
				obj.versionTotal = data.versionTotal;
				obj.reqstats = data.reqstats;
				output[item.id] = obj;
			}

			next();
		});
	}, () => self.json(output));

}

