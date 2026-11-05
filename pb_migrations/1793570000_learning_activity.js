migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const activity = new Collection({
    type: 'base',
    name: 'learning_activity',
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && @request.body.user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin"',
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'exam', type: 'text', required: true, max: 12 },
      { name: 'activity', type: 'text', required: true, max: 80 },
      { name: 'last_seen', type: 'date', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_learning_activity_user ON learning_activity (user)'],
  });
  app.save(activity);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('learning_activity'));
});
