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
const corsOptions = {
  origin: "http://localhost:5173", // Specify the exact origin of your frontend app
  credentials: true, // Allow credentials
};

app.use(cors(corsOptions));

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
//update a single students details
/* app.put("/updateStudent/:netid/:reg_no", (req, res) => {
  const { netid, reg_no } = req.params;
  const updateFields = req.body;
  console.log("UpdateFields:", updateFields);

  connection.query(
    "SELECT * FROM student_details WHERE reg_no = ? AND netid = ?",
    [reg_no, netid],
    (error, results) => {
      if (error) {
        console.error("Error fetching student details:", error);
        return res.status(500).send({
          success: false,
          message: "Failed to fetch student details.",
        });
      }

      if (results.length === 0) {
        return res
          .status(404)
          .send({ success: false, message: "Student not found." });
      }
    // Exclude fields not to be updated (like 'id', 'netid', and any others not intended for update)
      const currentState = results[0];
      delete currentState.id; // Assuming 'id' is auto-increment primary key and should not be updated
      delete currentState.netid; // 'netid' is used in WHERE clause, not typically updated
      delete currentState.year; // Exclude if 'year' should not be updated based on request
      // Add or remove fields based on your requirements

      const mergedUpdates = { ...currentState, ...updateFields };
      const nonEmptyUpdateFields = Object.entries(updateFields).reduce(
        (acc, [key, value]) => {
          if (value !== "") acc[key] = value; // Consider also checking for null/undefined if needed
          return acc;
        },
        {}
      );
      const setClause = Object.keys(nonEmptyUpdateFields)
        .map((key) => `${key}=?`)
        .join(", ");
      const queryValues = [
        ...Object.values(nonEmptyUpdateFields),
        reg_no,
        netid,
      ];

      console.log("setClause:", setClause);
      // Step 3: Update the database with merged object
      const query = `
      UPDATE student_details
      SET ${setClause}
      WHERE reg_no = ? AND netid = ?
    `; 
      const setClause = Object.keys(updateFields)
        .map((key) => `${key} = ?`)
        .join(", ");
      const queryValues = [...Object.values(updateFields), netid, reg_no]; // Assuming these are the correct identifiers

      const query = `
  UPDATE student_details
  SET ${setClause}
  WHERE reg_no = ? AND netid = ?
`;

      connection.query(query, queryValues, (error, result) => {
        if (error) {
          console.error("Error updating student details:", error);
          return res.status(500).send({
            success: false,
            message: "Failed to update student details.",
          });
        }
        console.log("Affected rows:", result.affectedRows);
        console.log("Update Result:", results);
        res.status(200).json({
          Status: "Success",
          Message: "Student details updated successfully.",
        });
      });
    }
  );
}); */
app.put("/updateStudent/:netid/:reg_no", (req, res) => {
  const { netid, reg_no } = req.params;
  const year = req.query.year; // If year is passed as a query parameter
  const updateFields = req.body;

  // Filter out empty fields from the updateFields object
  const fieldsToUpdate = Object.entries(updateFields).reduce(
    (acc, [key, value]) => {
      if (value !== "") {
        // Checks if the field is not an empty string
        acc[key] = value;
      }
      return acc;
    },
    {}
  );

  // If no fields are left to update, return an error or a message
  if (Object.keys(fieldsToUpdate).length === 0) {
    return res
      .status(400)
      .send({ message: "No valid fields provided for update." });
  }

  // Construct the SET part of the SQL query dynamically
  const setClauseParts = Object.keys(fieldsToUpdate).map((key) => `${key} = ?`);
  const setClause = setClauseParts.join(", ");
  const queryValues = [...Object.values(fieldsToUpdate), reg_no, netid, year];

  // Construct the full SQL query
  const query = `UPDATE student_details SET ${setClause} WHERE reg_no = ? AND netid = ? AND year = ?`;

  // Execute the query
  connection.query(query, queryValues, (error, results) => {
    if (error) {
      console.error("Error updating student details:", error);
      return res
        .status(500)
        .send({ message: "Failed to update student details." });
    }
    if (results.affectedRows > 0) {
      res.status(200).json({
        Status: "Success",
        Message: "Student details updated successfully.",
      });
    } else {
      res.status(404).send({ message: "Student not found." });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  connection.connect((err) => {
    if (err) throw err;
    console.log("Database connected");
  });
});
