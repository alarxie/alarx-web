const fs = require('fs');
const path = require('path');


const express = require('express');
const mongoose = require('mongoose');

const bcrypt = require("bcrypt")
//const uuid=require("uuid/v4")
const session = require("express-session");
const {
    use
} = require('react');

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'crazysecret1102',
    resave: false,
    saveUninitialized: false,
}));

mongoose.connect('mongodb+srv://alarx:ddlcostslaps@cluster0.b6gn3zb.mongodb.net/alarx-forum', {
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

const User = mongoose.model('User', userSchema)

const postSchema = new mongoose.Schema({
    subject: String,
    question: String,
    usernameUsed: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const generateRandomFileName = (extension = '') => {
  const timestamp = Date.now().toString(36); // Convert timestamp to base 36 for shorter length
  const randomNumber = Math.random().toString(36).slice(2, 8); // Extract a random part
  return `${timestamp}-${randomNumber}${extension ? `.${extension}` : ''}`;
};

const Post = mongoose.model('Post', postSchema);

// Get all posts
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({
        timestamp: -1
    });
    res.json(posts);
});

function stripHtmlTags(str) {
  return str.replace(/<\/?[^>]+(>|$)/g, "#");
}

app.post('/api/posts', async (req, res) => {
  console.log(req.body);
  let { subject, question } = req.body;

  // Strip HTML tags
  subject = stripHtmlTags(subject).trim();
  question = stripHtmlTags(question).trim();

  if (typeof subject !== 'string' || subject.length > 60) {
    return res.status(400).json({ error: 'Title must be 30 characters or less.' });
  }

  if (typeof question !== 'string' || question.length > 2000) {
    return res.status(400).json({ error: 'Post content must be 2000 characters or less.' });
  }

  let usernameUsed = "Guest";
  if (req.session.userId) {
    const user = await User.findById(req.session.userId);
    usernameUsed = user.username;
  }

  const newPost = new Post({ subject, question, usernameUsed });
  await newPost.save();

  // 🔥 Create unique folder based on post ID
  const folderName = path.join(__dirname, 'public', 'posts', newPost._id.toString());
  fs.mkdirSync(folderName, { recursive: true });

  // ✏️ Make HTML content
  const htmlContent = `
<head>
	<link rel="stylesheet" href="../../ss.css">
</head>
<br>
<body>
	<h1 style="line-height: .1;" class="mh">[alarx-web]</h1>
	<p style="font-size: 30;line-height: .1;" class="mp">> ${usernameUsed} says...</p>
</body>
<ul>
	<li><a class="../../home" href="../../home">home</a></li>
	<li><a class="../../forums" href="../../forums">forums</a></li>
	<li><a class="../../people" href="../../people">people</a></li>
	<li><a class="../../rules" href="../../rules">rules</a></li>
	<li><a class="../../account" href="../../account">account</a></li>
	<li><a class="../../more" href="../../more">more</a></li>
</ul>
<body>
<div class="post">
	<h1 class="post-title";font-size: 40;" class="mh">${subject}</h1>
	<p>${usernameUsed}</p>
	<p class="post-contentLarge"; style="line-height: 1;font-size: 20;" class="mp">${question}</p>
	<p></p>
</div>

</body>
  `;

  // 💾 Write HTML to file
  fs.writeFileSync(path.join(folderName, 'index.html'), htmlContent);
  res.json({ redirectUrl: `/posts/${newPost._id}` });
});


app.post('/api/register', async (req, res) => {
    const {
        username,
        password
    } = req.body;

    console.log("Registered : "+username,password)

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({
            error: 'Username must be 3–20 characters, only letters, numbers, and underscores.'
        });
    }

    const passwordRegex = /^\S{6,100}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            error: 'Password must be 6–100 characters with no spaces.'
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
        const user = await User.create({
            username,
            passwordHash
        });
        req.session.userId = user._id;
        res.status(201).json({
            message: 'Registered!'
        });
    } catch (err) {
        res.status(400).json({
            error: 'Username already taken'
        });
    }
});



app.post('/api/login', async (req, res) => {
    const {
        username,
        password
    } = req.body;
    const user = await User.findOne({
        username
    });

    if (!user) return res.status(401).json({
        error: 'Invalid username'
    });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({
        error: 'Invalid password'
    });

    req.session.userId = user._id;
    res.json({
        message: 'Logged in'
    });
});
app.get('/api/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({
        error: 'Not logged in'
    });
    const user = await User.findById(req.session.userId);
    res.json({
        username: user.username
    });
});
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({
            message: 'Logged out'
        });
    });
});