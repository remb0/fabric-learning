migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.listRule = null;
  users.viewRule = null;
  users.createRule = '';
  users.updateRule = null;
  users.deleteRule = null;
  users.fields.getByName('name').max = 120;
  app.save(users);

  const progress = new Collection({
    type: 'base',
    name: 'progress',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'payload', type: 'json', required: true, maxSize: 1000000 },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_progress_user ON progress (user)'],
  });
  app.save(progress);
}, (app) => {
  const progress = app.findCollectionByNameOrId('progress');
  app.delete(progress);

  const users = app.findCollectionByNameOrId('users');
  const selfRule = 'id = @request.auth.id';
  users.listRule = selfRule;
  users.viewRule = selfRule;
  users.createRule = '';
  users.updateRule = selfRule;
  users.deleteRule = selfRule;
  users.fields.getByName('name').max = 255;
  app.save(users);
});
