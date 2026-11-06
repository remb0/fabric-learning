migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const suggestions = new Collection({
    type: 'base',
    name: 'improvement_suggestions',
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: '(@request.body.user:isset = false || (@request.auth.id != "" && @request.body.user = @request.auth.id)) && @request.body.status:isset = false',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
    fields: [
      { name: 'message', type: 'text', required: true, min: 10, max: 2000 },
      { name: 'page', type: 'text', required: true, min: 1, max: 120 },
      { name: 'exam', type: 'text', required: false, max: 12 },
      { name: 'user', type: 'relation', required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { name: 'status', type: 'select', required: false, maxSelect: 1, values: ['new', 'reviewed', 'closed'] },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE INDEX idx_improvement_suggestions_created ON improvement_suggestions (created)'],
  });
  app.save(suggestions);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('improvement_suggestions'));
});
