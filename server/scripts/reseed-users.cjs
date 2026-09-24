const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const users = [
  { id: 'usr_admin', email: 'admin@renuzi', name: 'Renuzi Admin', role: 'admin', passwordHash: bcrypt.hashSync('Admin@2026', 10) },
  { id: 'usr_ketu', email: 'ketu@renuzi', name: 'Ketu Manager', role: 'warehouse_manager', location: 'Ketu', passwordHash: bcrypt.hashSync('Ketu@2026', 10) },
  { id: 'usr_lekki', email: 'lekki@renuzi', name: 'Lekki Manager', role: 'warehouse_manager', location: 'Lekki', passwordHash: bcrypt.hashSync('Lekki@2026', 10) },
  { id: 'usr_super', email: 'temidire@renuzi', name: 'Temidire Super Admin', role: 'super_admin', passwordHash: bcrypt.hashSync('Super@2026', 10) },
];

const out = path.join(__dirname, '..', 'data', 'users.json');
fs.writeFileSync(out, JSON.stringify({ users }, null, 2));
console.log('OK users.json reseeded ->', out);
