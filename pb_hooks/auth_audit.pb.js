onRecordAuthWithPasswordRequest((e) => {
  const saveAttempt = (success) => {
    try {
      const collection = e.app.findCollectionByNameOrId('login_attempts');
      const attempt = new Record(collection);
      attempt.set('identity', String(e.identity || '').trim().toLowerCase());
      attempt.set('success', success);
      attempt.set('user_agent', e.request ? String(e.request.header.get('User-Agent') || '').slice(0, 500) : '');
      if (success && e.record) attempt.set('user', e.record.id);
      e.app.save(attempt);
    } catch (auditError) {
      console.log('Could not record login attempt:', auditError);
    }
  };
  try {
    e.next();
    saveAttempt(!!e.record);
  } catch (error) {
    saveAttempt(false);
    throw error;
  }
}, 'users');

onRecordCreateRequest((e) => {
  e.record.set('emailVisibility', true);
  e.record.set('role', 'user');
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  e.record.set('emailVisibility', true);
  e.next();
}, 'users');
