const express = require('express');
const mongoose = require('mongoose');

const bcrypt=require("bcrypt")
const session=require("express-session");
const { use } = require('react');

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'crazysecret1102',
  resave:false,
  saveUninitialized:false,
}));

mongoose.connect('mongodb://localhost:27017/alarx-forum', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9_]{3,20}$/,
  },
  passwordHash: String
});

const User = mongoose.model('User',userSchema)

const postSchema = new mongoose.Schema({
  subject: String,
  question: String,
  usernameUsed: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// Get all posts
app.get('/api/posts', async (req, res) => {
  const posts = await Post.find().sort({ timestamp: -1 });
  res.json(posts);
});

// Create a new post
app.post('/api/posts', async (req, res) => {
  console.log(req.body)
  const { subject, question } = req.body;

  if (typeof subject !== 'string' || subject.length > 30) {
    return res.status(400).json({ error: 'Title must be 30 characters or less.' });
  }

  if (typeof question !== 'string' || question.length > 2000) {
    return res.status(400).json({ error: 'Post content must be 2000 characters or less.' });
  }

  var usernameUsed="Guest"

  if (req.session.userId){
    const user = await User.findById(req.session.userId);
    usernameUsed=user.username
  }

  const newPost = new Post({ subject, question,usernameUsed });

  console.log(newPost)
  await newPost.save();
  res.status(201).json(newPost);
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–20 characters, only letters, numbers, and underscores.' });
  }

  const passwordRegex = /^\S{6,100}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be 6–100 characters with no spaces.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({ username, passwordHash });
    req.session.userId = user._id;
    res.status(201).json({ message: 'Registered!' });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken' });
  }
});



app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user) return res.status(401).json({ error: 'Invalid username' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

  req.session.userId = user._id;
  res.json({ message: 'Logged in' });
});
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = await User.findById(req.session.userId);
  res.json({ username: user.username });
});
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});