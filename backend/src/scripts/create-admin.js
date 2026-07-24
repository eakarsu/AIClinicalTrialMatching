'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function main() {
  if (!['1', 'true'].includes(process.env.ALLOW_SCHEMA_MIGRATION || '')) {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  if (!email || password.length < 12) {
    throw new Error('Admin email and a 12+ character password are required');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: { email, password: passwordHash, name: 'Runtime Administrator', role: 'admin' },
  });
  await user.update({ password: passwordHash, name: 'Runtime Administrator', role: 'admin' });
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
