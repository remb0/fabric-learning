migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const ownerOrAdmin = '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")';
  const activity = app.findCollectionByNameOrId('learning_activity');
  activity.listRule = ownerOrAdmin;
  activity.viewRule = ownerOrAdmin;
  app.save(activity);
  for (const definition of [
    { name: 'learning_clock', fields: [
      { name: 'checkpoint', type: 'number', min: 0 },
      { name: 'tokens', type: 'json', maxSize: 100000 },
    ], indexes: ['CREATE UNIQUE INDEX idx_learning_clock_user ON learning_clock (user)'] },
    { name: 'learning_time', fields: [
      { name: 'exam', type: 'text', required: true, max: 12 },
      { name: 'day', type: 'text', required: true, max: 10 },
      { name: 'seconds', type: 'number', min: 0 },
    ], indexes: ['CREATE UNIQUE INDEX idx_learning_time_day ON learning_time (user, exam, day)'] },
  ]) {
    app.save(new Collection({type: 'base', name: definition.name,
      listRule: definition.name === 'learning_time' ? ownerOrAdmin : null,
      viewRule: definition.name === 'learning_time' ? ownerOrAdmin : null,
      createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        ...definition.fields,
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ], indexes: definition.indexes,
    }));
  }
}, (app) => {
  app.delete(app.findCollectionByNameOrId('learning_time'));
  app.delete(app.findCollectionByNameOrId('learning_clock'));
  const activity = app.findCollectionByNameOrId('learning_activity');
  activity.listRule = '@request.auth.role = "admin"';
  activity.viewRule = '@request.auth.role = "admin"';
  app.save(activity);
});
