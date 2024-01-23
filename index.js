const express = require('express')
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const connection = require('./database/connection');
const app = express();
const port = 8000;
require('dotenv').config();
const salt =10; 

app.use(express.json());

app.use(reqLogger);
app.use(cookieParser())
app.use(cors({
  origin: 'http://localhost:5173',
  methods:["POST","GET"],
  credentials:true// or '*' to allow all origins
}));


// Log request info
function reqLogger(req, res, next) { 
    console.log(`${req.method}: ${req.url}`);
    next();
  }

  app.post('/register',(req,res)=>{
    const sql = "INSERT INTO users(`name`,`email`,`password`) VALUES (?)";
    bcrypt.hash(req.body.password.toString(), salt,(err,hash)=>{
        if(err){
            return res.json({Error: "Error in Hashing Password"})
        }
        const values =[
            req.body.name,
            req.body.email,
            hash
        ]
      connection.query(sql,[values],(err,result)=>{
        if(err){
            return res.json({Error:"Unable to Insert the Data"})
        }
        return res.json ({Status:"Success"})
        
      })
    })
  

  })

  app.post('/login', (req, res) => {
    plainPassword= req.body.password
    const sql = "SELECT * FROM users WHERE email = ?";
    connection.query(sql, [req.body.email], (err, data) => {
      if (err) {
        // Consider using a generic error message in production
        return res.status(500).json({ Error: "Login error in server" });
      }
 
      if (data.length > 0) {
        
        bcrypt.compare(plainPassword.toString(), data[0].password, (err, response) => {
          if (err) {
            // Generic error message for production
            return res.status(500).json({ Error: "Error processing request" });
          }
  
          if (response) {
            // Generate and send token here (if applicable)
            const name = data[0].name;
            const mail= data[0].email;
            const token = jwt.sign({name,mail},process.env.SECRET_KEY,{expiresIn:'1d'});
            res.cookie('token', token);
            return res.status(200).json({ Status: "Success" });
          } else {
            return res.status(401).json({ Error: "Password doesn't match" });
          }
        });
      } else {
        return res.status(404).json({ Error: "No email existed" });
      }
    });
  });
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connection.connect((err) => {
        if (err) throw err;
        console.log('Database connected');
    });
});
