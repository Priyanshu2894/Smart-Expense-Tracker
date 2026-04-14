const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

async function seed() {
  try {
    const db = await getDb();
    
    // Check if user exists
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    
    if (existingUser) {
      console.log('Seed user already exists!');
      return;
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    
    // Insert into table
    await db.run(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      ['test@example.com', hashedPassword]
    );
    
    console.log('Seed user successfully added!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seed();
