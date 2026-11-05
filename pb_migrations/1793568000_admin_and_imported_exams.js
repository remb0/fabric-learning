migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.add(new SelectField({
    name: 'role',
    maxSelect: 1,
    values: ['user', 'admin'],
  }));
  users.listRule = '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin")';
  users.viewRule = '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin")';
  users.createRule = '@request.body.role:isset = false';
  users.updateRule = '@request.auth.id != "" && id = @request.auth.id && @request.body.role:isset = false';
  users.deleteRule = '@request.auth.id != "" && id = @request.auth.id';
  app.save(users);

  const existingUsers = app.findAllRecords('users');
  for (const user of existingUsers) {
    user.set('emailVisibility', true);
    user.set('role', 'user');
    app.save(user);
  }

  const loginAttempts = new Collection({
    type: 'base',
    name: 'login_attempts',
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'user', type: 'relation', required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'identity', type: 'email', required: true, exceptDomains: [], onlyDomains: [] },
      { name: 'success', type: 'bool', required: false },
      { name: 'user_agent', type: 'text', required: false, max: 500 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
    indexes: [
      'CREATE INDEX idx_login_attempts_created ON login_attempts (created)',
      'CREATE INDEX idx_login_attempts_identity ON login_attempts (identity)',
    ],
  });
  app.save(loginAttempts);

  const importedExams = new Collection({
    type: 'base',
    name: 'imported_exams',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin" && @request.body.imported_by = @request.auth.id',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
    fields: [
      { name: 'title', type: 'text', required: true, min: 1, max: 200 },
      { name: 'source_filename', type: 'text', required: true, min: 1, max: 255 },
      { name: 'exam_number', type: 'text', required: false, max: 100 },
      { name: 'time_limit', type: 'number', required: false, min: 0, max: 1440, onlyInt: true },
      { name: 'passing_score', type: 'number', required: false, min: 0, max: 1000, onlyInt: true },
      { name: 'questions', type: 'json', required: true, maxSize: 8000000 },
      { name: 'imported_by', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE INDEX idx_imported_exams_created ON imported_exams (created)'],
  });
  app.save(importedExams);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('imported_exams'));
  app.delete(app.findCollectionByNameOrId('login_attempts'));

  const users = app.findCollectionByNameOrId('users');
  users.fields.removeByName('role');
  users.listRule = null;
  users.viewRule = null;
  users.createRule = '';
  users.updateRule = null;
  users.deleteRule = null;
  app.save(users);
});
