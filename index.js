const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const connection = require("./database/connection");
const multer = require("multer");
const XLSX = require("xlsx");
const app = express();
const port = 8000;
require("dotenv").config();
const salt = 10;
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));
app.use(express.json());

app.use(reqLogger);
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["POST", "GET"],
    credentials: true, // or '*' to allow all origins
  })
);

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
        console.log(req.netid);
        next();
      }
    });
  }
};

app.post("/logout", (req, res) => {
  res.clearCookie("token"); // Clear the authentication cookie
  return res.status(200).json({ message: "Logged out successfully" });
});
app.get("/", verifyUser, (req, res) => {
  return res.json({ Status: "Success", netid: req.netid, mail: req.mail });
});
app.post("/register", (req, res) => {
  const sql = "INSERT INTO users(`netid`,`email`,`password`) VALUES (?)";
  bcrypt.hash(req.body.password.toString(), salt, (err, hash) => {
    if (err) {
      return res.json({ Error: "Error in Hashing Password" });
    }
    const values = [req.body.netid, req.body.email, hash];
    console.log(hash);
    connection.query(sql, [values], (err, result) => {
      if (err) {
        return res.json({ Error: "Unable to Insert the Data" });
      }
      return res.json({ Status: "Success" });
    });
  });
});

app.post("/login", (req, res) => {
  plainPassword = req.body.password;
  console.log(plainPassword);
  const sql = "SELECT * FROM users WHERE email = ?";
  connection.query(sql, [req.body.email], (err, data) => {
    if (err) {
      // Consider using a generic error message in production
      return res.status(500).json({ Error: "Login error in server" });
    }
    console.log(data);
    if (data.length > 0) {
      bcrypt.compare(
        plainPassword.toString(),
        data[0].password,
        (err, response) => {
          if (err) {
            // Generic error message for production
            return res.status(500).json({ Error: "Error processing request" });
          }

          if (response) {
            // Generate and send token here (if applicable)
            const netid = data[0].netid;
            const mail = data[0].email;
            const token = jwt.sign({ netid, mail }, process.env.SECRET_KEY, {
              expiresIn: "1d",
            });
            res.cookie("token", token, { httpOnly: true, secure: true });
            return res.status(200).json({ Status: "Success" });
          } else {
            return res.status(401).json({ Error: "Password doesn't match" });
          }
        }
      );
    } else {
      return res.status(404).json({ Error: "No email existed" });
    }
  });
});

//Uploading Basic student Details

app.post("/basicDetail", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const { netid, year } = req.body; // Assuming these are provided by the user
  const workbook = XLSX.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  const extractionData = jsonData.map((row) => {
    return {
      netid: netid,
      year: year,
      reg_no: row["Registration No."],
      full_name: row["Full Name"],
      gender: row["GENDER"],
      nri: row["NRI STUDENT"],
      dob: row["DATE OF BIRTH"],
      specialization: row["Specialization"],
      section: row["Section"],
      srm_mail: row["SRMIST Mail ID"],
      personal_mail: row["Personal Mail ID"],
      mobile_no: row["Mobile Number"],
      father: row["Father Mobile Number"],
      fa: row["Name of Faculty Advisor"],
    };
  });

  // Begin a transaction
  connection.beginTransaction((err) => {
    if (err) {
      throw err;
    }

    let errors = [];
    let successCount = 0;

    extractionData.forEach((student) => {
      const query = `INSERT INTO student_details 
    (netid, year, reg_no, full_name, gender, nri, dob, specialization, section, srm_mail, personal_mail, mobile_no, father, fa) 
  VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
  ON DUPLICATE KEY UPDATE 
  full_name = VALUES(full_name), 
  gender = VALUES(gender), 
  nri = VALUES(nri), 
  dob = VALUES(dob), 
  specialization = VALUES(specialization), 
  section = VALUES(section), 
  srm_mail = VALUES(srm_mail), 
  personal_mail = VALUES(personal_mail), 
  mobile_no = VALUES(mobile_no), 
  father = VALUES(father), 
  fa = VALUES(fa)
`;

      connection.query(
        query,
        [
          student.netid,
          student.year,
          student.reg_no,
          student.full_name,
          student.gender,
          student.nri,
          student.dob,
          student.specialization,
          student.section,
          student.srm_mail,
          student.personal_mail,
          student.mobile_no,
          student.father,
          student.fa,
        ],
        (err, result) => {
          if (err) {
            errors.push(err);
          } else {
            successCount++;
          }

          if (successCount + errors.length === extractionData.length) {
            if (errors.length > 0) {
              // If errors occur, rollback the transaction
              connection.rollback(() => {
                res.status(500).json({ Error: errors });
              });
            } else {
              // If all operations were successful, commit the transaction
              connection.commit((err) => {
                if (err) {
                  connection.rollback(() => {
                    throw err;
                  });
                }
                console.log("Transaction Completed Successfully.");
                res.status(200).json({
                  Status: "Success",
                  Message: "Data uploaded successfully",
                });
              });
            }
          }
        }
      );
    });
  });
});

//fetch Basic Student Details
app.get("/studentDetails/:year/:netid", (req, res) => {
  const selectedYear = req.params.year;
  const netid = req.params.netid;

  const query = `SELECT * FROM student_details WHERE year = ? AND netid = ?`;

  connection.query(query, [selectedYear, netid], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error Retrieving data");
    }
    res.json(result);
  });
});

//get available years for the user id

app.get("/availableYears/:netid", (req, res) => {
  const netid = req.params.netid;

  const query = `SELECT DISTINCT year FROM student_details WHERE netid = ?`;

  connection.query(query, [netid], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).send("Error Retriving Data");
    }
    console.log("Query Results:", result);
    const years = result.map((row) => row.year);
    console.log("Years:", years);
    res.json(years);
  });
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  connection.connect((err) => {
    if (err) throw err;
    console.log("Database connected");
  });
});
