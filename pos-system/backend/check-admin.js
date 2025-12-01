const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos_system.db');
const db = new sqlite3.Database(dbPath);

// Check the admin user details
db.get("SELECT id, username, email, role, isActive, lastLogin FROM users WHERE username = 'admin'", (err, user) => {
  if (err) {
    console.error('Error reading admin user:', err);
    return;
  }
  
  if (user) {
    console.log('Admin user found:');
    console.log(`- ID: ${user.id}`);
    console.log(`- Username: ${user.username}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Active: ${user.isActive}`);
    console.log(`- Last Login: ${user.lastLogin}`);
    
    // Try to check if there's a default password we can test
    console.log('\nTesting common default passwords...');
    
    // We'll test with "admin" as default password
    const bcrypt = require('bcryptjs');
    const testPassword = 'admin';
    
    db.get("SELECT password FROM users WHERE username = 'admin'", (err, result) => {
      if (err) {
        console.error('Error getting password:', err);
        db.close();
        return;
      }
      
      if (result) {
        const isValid = bcrypt.compareSync(testPassword, result.password);
        console.log(`Password 'admin': ${isValid ? 'VALID' : 'INVALID'}`);
        
        if (!isValid) {
          // Try other common defaults
          const testPasswords = ['password', '123456', 'admin123', '1234'];
          let found = false;
          
          testPasswords.forEach(pwd => {
            if (bcrypt.compareSync(pwd, result.password)) {
              console.log(`Password '${pwd}': VALID`);
              found = true;
            }
          });
          
          if (!found) {
            console.log('No common default passwords found. The admin password appears to be custom.');
          }
        }
      }
      
      db.close();
    });
  } else {
    console.log('No admin user found');
    db.close();
  }
});