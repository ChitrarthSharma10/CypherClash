import 'dotenv/config';

function testDatabaseUri() {
  const explicitTestUri = process.env.MONGO_URI_TEST;
  const sourceUri = explicitTestUri || process.env.MONGO_URI;
  if (!sourceUri) {
    throw new Error('Tests require MONGO_URI_TEST or MONGO_URI');
  }

  let parsed;
  try {
    parsed = new URL(sourceUri);
  } catch {
    throw new Error('Test database URI is invalid');
  }
  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('Test database URI is invalid');
  }
  if (!databaseName && explicitTestUri) {
    throw new Error('Test database URI must include a database name');
  }

  if (explicitTestUri) {
    if (!databaseName.endsWith('_test')) {
      throw new Error('MONGO_URI_TEST database name must end in "_test"');
    }
  } else {
    const sourceDatabaseName = databaseName || 'test';
    if (!sourceDatabaseName.endsWith('_test')) {
      databaseName = `${sourceDatabaseName}_test`;
    } else {
      databaseName = sourceDatabaseName;
    }
    parsed.pathname = `/${encodeURIComponent(databaseName)}`;
  }

  return explicitTestUri || parsed.toString();
}

process.env.MONGO_URI = testDatabaseUri();
