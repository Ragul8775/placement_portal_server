const express = require('express')
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const connection = require('./database/connection');
const multer = require('multer');
const XLSX = require('xlsx');
const app = express();
const port = 8000;
require('dotenv').config();
const salt =10; 
const upload = multer({dest:'uploads/'})
app.use('/uploads', express.static('uploads'));
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
  const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ Error: "You are not Authenticated" });
    } else {
      jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(403).json({ Error: "Token is not valid" });
        } else {
          req.netid = decoded.netid;
          req.mail = decoded.mail;
          console.log(req.netid)
          next();
        }
      });
    }
  };
 
  app.post('/logout', (req, res) => {
    res.clearCookie('token');  // Clear the authentication cookie
    return res.status(200).json({ message: "Logged out successfully" });
});
  app.get('/', verifyUser, (req, res) => {
    return res.json({ Status: "Success", netid: req.netid, mail: req.mail });
  });
  app.post('/register',(req,res)=>{
    const sql = "INSERT INTO users(`netid`,`email`,`password`) VALUES (?)";
    bcrypt.hash(req.body.password.toString(), salt,(err,hash)=>{
        if(err){
            return res.json({Error: "Error in Hashing Password"})
        }
        const values =[
            req.body.netid,
            req.body.email,
            hash
        ]
        console.log(hash)
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
    console.log(plainPassword)
    const sql = "SELECT * FROM users WHERE email = ?";
    connection.query(sql, [req.body.email], (err, data) => {
      if (err) {
        // Consider using a generic error message in production
        return res.status(500).json({ Error: "Login error in server" });
      }
      console.log(data)
      if (data.length > 0) {
        
        bcrypt.compare(plainPassword.toString(), data[0].password, (err, response) => {
          if (err) {
            // Generic error message for production
            return res.status(500).json({ Error: "Error processing request" });
          }
  
          if (response) {
            // Generate and send token here (if applicable)
            const netid = data[0].netid;
            const mail= data[0].email;
            const token = jwt.sign({netid,mail},process.env.SECRET_KEY,{expiresIn:'1d'});
            res.cookie('token', token, { httpOnly: true, secure: true });
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

//Uploading Basic student Details

app.post('/basicDetail',upload.single('file'),async (req,res)=>{
  const {netid, year} = req.body
  const workbook = XLSX.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  const extractionData = jsonData.map(row=>{
   
    return{
      
      netid:netid,
      year:year,
      reg_no: row['Registration No.'],
      full_name:row['Full Name'],
      gender:row['GENDER'],
      nri:row['NRI STUDENT'],
      dob: row['DATE OF BIRTH'],  
      specialization:row['Specialization'],
      section:row['Section'],
      srm_mail:row['SRMIST Mail ID'],
      personal_mail:row['Personal Mail ID'],
      mobile_no:row['Mobile Number'],
      father:row['Father Mobile Number'],
      fa:row['Name of Faculty Advisor'],
      }
  })
  
  let errors = [];
  let successCount = 0;

  extractionData.forEach(student => {
    try {
      const query = 'INSERT INTO student_details SET ? ON DUPLICATE KEY UPDATE ?';
      connection.query(query, [student, student], (err, result) => {
        if (err) {
          errors.push(err);
        } else {
          successCount++;
        }

        // Check if this is the last iteration
        if (successCount + errors.length === extractionData.length) {
          if (errors.length > 0) {
            res.status(500).json({ Error: errors });
          } else {
            res.status(200).json({ Status: "Success", Message: "Data uploaded successfully" });
          }
        }
      });
    } catch (error) {
      errors.push(error);
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
