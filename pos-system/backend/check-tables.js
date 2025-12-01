const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos_system.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error reading tables:', err);
    return;
  }
  
  console.log('Tables in database:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });
  
  // Check for users table specifically
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
    if (err) {
      console.error('Error checking users table:', err);
      return;
    }
    
    if (row) {
      console.log('\nUsers table exists! Checking structure...');
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('Error getting users table structure:', err);
          return;
        }
        
        console.log('Users table columns:');
        columns.forEach(col => {
          console.log(`- ${col.name}: ${col.type} (${col.pk ? 'PRIMARY KEY' : ''})`);
        });
        
        // Check if there are any users
        db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
          if (err) {
            console.error('Error counting users:', err);
            return;
          }
          
          console.log(`\nTotal users: ${result.count}`);
          
          if (result.count > 0) {
            db.all("SELECT id, username, email, role, createdAt FROM users LIMIT 5", (err, users) => {
              if (err) {
                console.error('Error getting users:', err);
                return;
              }
              
              console.log('\nFirst 5 users:');
              users.forEach(user => {
                console.log(`- ${user.username} (${user.email}) - Role: ${user.role}`);
              });
              
              db.close();
            });
          } else {
            console.log('\nNo users found in database');
            db.close();
          }
        });
      });
    } else {
      console.log('\nUsers table does not exist');
      db.close();
    }
  });
});