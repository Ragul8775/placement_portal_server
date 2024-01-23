const express = require('express')
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const connection = require('./database/connection');
const app = express();
const port = 8000;

const salt =10; 

app.use(express.json());
app.use(cors());
app.use(reqLogger);
app.use(cookieParser())

// Log request info
function reqLogger(req, res, next) {
    console.log(`${req.method}: ${req.url}`);
    next();
  }

  app.post('/register',(req,res)=>{
    const sql = "INSERT INTO users(`name`,`email`,`password`) VALUE (?)";
    bcrypt.hash(req.body.password.toString(), salt,(err,hash)=>{
        if(err){
            return res.json({Error: "Error in Hashing Password"})
        }
        const values =[
            req.body.name,
            req.body.email,
            hash
        ]
        console.log([values])
      connection.query(sql,[values],(err,result)=>{
        if(err){
            return res.json({Error:"Unable to Insert the Data"})
        }
        return res.json ({Status:"Success"}).status(201)
        
      })
    })
  

  })
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connection.connect((err) => {
        if (err) throw err;
        console.log('Database connected');
    });
});
