const express = require('express')
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const connection = require('./database/connection');
const app = express();
const port = 8000;

app.use(express.json());
app.use(cors());
app.use(reqLogger);
app.use(cookieParser())

// Log request info
function reqLogger(req, res, next) {
    console.log(`${req.method}: ${req.url}`);
    next();
  }

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connection.connect((err) => {
        if (err) throw err;
        console.log('Database connected');
    });
});
