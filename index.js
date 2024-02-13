const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const connection = require("./database/connection");
const multer = require("multer");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const app = express();
const port = 8000;
require("dotenv").config();
const salt = 10;
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(bodyParser.json());
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

  const { netid, year } = req.body;
  const workbook = XLSX.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  const extractionData = jsonData.map((row) => ({
    netid,
    year,
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
  }));

  connection.beginTransaction(async (err) => {
    if (err) {
      return res.status(500).send("Failed to start transaction.");
    }

    try {
      for (const student of extractionData) {
        const fa_id = await checkAndUpdateFA(
          student.fa,
          year,
          netid,
          student.section
        );
        await insertStudentDetails(student, fa_id);
      }

      connection.commit((err) => {
        if (err) {
          connection.rollback(() => {
            throw err;
          });
          return res.status(500).send("Failed to commit transaction.");
        }
        res.json({ Status: "Success" });
      });
    } catch (error) {
      connection.rollback(() => {
        res
          .status(500)
          .send({ message: "Transaction failed", error: error.message });
      });
    }
  });
});

async function checkAndUpdateFA(faName, year, netid, section) {
  const faCheckSql =
    "SELECT fa_id FROM fa WHERE fa_name = ? AND year = ? AND netid = ? LIMIT 1";
  const faCheckValues = [faName, year, netid, section];

  const existingFA = await queryPromise(faCheckSql, faCheckValues);
  if (existingFA.length > 0) {
    return existingFA[0].fa_id;
  } else {
    const insertFASql =
      "INSERT INTO fa (fa_name, year, netid,section) VALUES (?, ?, ?,?)";
    const insertResult = await queryPromise(insertFASql, faCheckValues);
    return insertResult.insertId;
  }
}

async function insertStudentDetails(student, fa_id) {
  const insertSql = `INSERT INTO student_details 
    (netid, year, reg_no, full_name, gender, nri, dob, specialization, section, srm_mail, personal_mail, mobile_no, father,fa, fa_id) 
  VALUES 
    (?, ?, ?, ?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, ?, ?, ?, ?, ?,?) 
  ON DUPLICATE KEY UPDATE 
    full_name = VALUES(full_name), gender = VALUES(gender), nri = VALUES(nri), 
    dob = VALUES(dob), specialization = VALUES(specialization), section = VALUES(section), 
    srm_mail = VALUES(srm_mail), personal_mail = VALUES(personal_mail), 
    mobile_no = VALUES(mobile_no), father = VALUES(father),fa=VALUES(fa) ,fa_id = VALUES(fa_id)`;

  const values = [
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
    fa_id,
  ];

  await queryPromise(insertSql, values);
}

function queryPromise(sql, values) {
  return new Promise((resolve, reject) => {
    connection.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

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

app.put("/updateStudent/:netid/:reg_no", async (req, res) => {
  const { netid, reg_no } = req.params;
  const year = req.query.year; // If year is passed as a query parameter
  const updateFields = req.body;
  // Check if FA name is being updated and handle it
  if (updateFields.fa) {
    try {
      const newFaName = updateFields.fa;
      delete updateFields.fa; // Remove fa from updateFields to handle it separately

      // Check if the new FA exists in the FA table
      const faQuery = `SELECT fa_id FROM fa WHERE fa_name = ? AND year = ? AND netid = ? LIMIT 1`;
      const faValues = [newFaName, year, netid];
      const [existingFA] = await queryPromise(faQuery, faValues);

      let fa_id;
      if (!existingFA) {
        // Insert new FA and get fa_id
        const insertFaQuery = `INSERT INTO fa (fa_name, year, netid) VALUES (?, ?, ?)`;
        const insertFaResult = await queryPromise(insertFaQuery, faValues);
        fa_id = insertFaResult.insertId;
      } else {
        fa_id = existingFA.fa_id;
      }

      // Add fa_id to fields to update
      updateFields.fa_id = fa_id;
    } catch (error) {
      return res.status(500).send({ message: "Error processing FA update." });
    }
  }
  function queryPromise(sql, values) {
    return new Promise((resolve, reject) => {
      connection.query(sql, values, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }

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

//Add single student in the table
app.post("/addStudent", async (req, res) => {
  const {
    netid,
    year,
    reg_no,
    full_name,
    section,
    specialization,
    dob,
    personal_mail,
    srm_mail,
    mobile_no,
    father,
    fa, // Assuming this is the FA's name
    placement,
    company,
    package: packageValue, // 'package' is a reserved keyword in strict mode
  } = req.body;

  try {
    // Step 1: Check and Insert FA
    let faQuery = `SELECT fa_id FROM fa WHERE fa_name = ? AND year = ? AND netid = ? LIMIT 1`;
    let faValues = [fa, year, netid, section];
    let faResults = await queryPromise(faQuery, faValues);

    let fa_id;
    if (faResults.length === 0) {
      // FA does not exist, insert new FA
      let insertFaQuery = `INSERT INTO fa (fa_name, year, netid,section) VALUES (?, ?, ?,?)`;
      let insertFaResults = await queryPromise(insertFaQuery, faValues);
      fa_id = insertFaResults.insertId;
    } else {
      // FA exists
      fa_id = faResults[0].fa_id;
    }

    // Step 2: Insert the Student with FA ID
    const studentQuery = `INSERT INTO student_details (netid, year, reg_no, full_name, section, specialization, dob, personal_mail, srm_mail, mobile_no, father, fa_id, placement, company, package)
                          VALUES (?, ?, ?, ?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, ?, ?, ?, ?, ?, ?)`;
    await queryPromise(studentQuery, [
      netid,
      year,
      reg_no,
      full_name,
      section,
      specialization,
      dob,
      personal_mail,
      srm_mail,
      mobile_no,
      father,
      fa_id, // Use fa_id instead of fa name
      placement,
      company,
      packageValue,
    ]);

    res.status(201).send({ message: "Student added successfully" });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).send({ message: "Failed to add student" });
  }
});

function queryPromise(query, values) {
  return new Promise((resolve, reject) => {
    connection.query(query, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}
app.get("/fa-data", (req, res) => {
  // Extracting year and netid from the request's query parameters
  const { year, netid } = req.query;

  if (!year || !netid) {
    return res.status(400).send({ error: "Year and netid are required." });
  }

  const sql = `
    SELECT 
      fa.fa_name,
      sd.section,
      COUNT(sd.id) AS total_students,
      SUM(CASE WHEN sd.placement = 'Placed' THEN 1 ELSE 0 END) AS num_placed,
      SUM(CASE WHEN sd.placement = 'Unplaced' THEN 1 ELSE 0 END) AS num_unplaced,
      SUM(CASE WHEN sd.placement = 'Intern' THEN 1 ELSE 0 END) AS num_intern,
      SUM(CASE WHEN sd.placement = 'HigherStudies' THEN 1 ELSE 0 END) AS num_higher_studies
    FROM 
      student_details sd
    JOIN 
      fa ON sd.fa_id = fa.fa_id
    WHERE 
      sd.year = ? AND sd.netid = ?
    GROUP BY 
      fa.fa_name, sd.section
    ORDER BY 
      fa.fa_name, sd.section`;

  // Using parameterized query for security and to insert year and netid values
  connection.query(sql, [year, netid], (error, results) => {
    if (error) {
      console.error("Error fetching FA data:", error);
      return res.status(500).send({ error: "Failed to fetch FA data." });
    }
    res.json(results);
  });
});
// UPDATE PLACEMENT DETAILS OF THE STUDENT

app.post("/studentUpdate/placementDetails", (req, res) => {
  const {
    studentRegNos,
    placement,
    company,
    package: packageValue,
    year,
    netid,
  } = req.body;

  if (!studentRegNos || studentRegNos.length === 0) {
    return res
      .status(400)
      .send({ error: "No student registration numbers provided." });
  }

  let sql = `UPDATE student_details SET placement =?,company=?,package=? WHERE reg_no IN (?) AND year = ? AND netid = ?`;

  connection.query(
    sql,
    [placement, company, packageValue, studentRegNos, year, netid],
    (error, results) => {
      if (error) {
        console.error("Failed to update the placement details:", error);
        return res
          .status(500)
          .send({ error: "failed to update the placement details" });
      }
      res.status(200).send({
        message: "Placement Details updated successfully",
        affectedRows: results.affectedRows,
      });
    }
  );
});
app.get("/student-download", (req, res) => {
  let { netid, year, section, placement } = req.query;
  let conditions = ["netid = ?", "year = ?"];
  let params = [netid, year];

  if (section) {
    conditions.push("section = ?");
    params.push(section);
  }
  if (placement) {
    conditions.push("placement = ?");
    params.push(placement);
  }

  let query = `SELECT * FROM student_details WHERE ${conditions.join(" AND ")}`;
  console.log("Executing query:", query);
  console.log("With parameters:", params);

  connection.query(query, params, async (error, results) => {
    if (error) {
      console.error("SQL Error:", error.sqlMessage);
      return res.status(500).send("Error fetching student data");
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Students");

      // Define columns in the Excel sheet
      worksheet.columns = [
        { header: "Reg. No", key: "reg_no", width: 15 },
        { header: "Full Name", key: "full_name", width: 25 },
        { header: "Section", key: "section", width: 25 },
        { header: "Specialization", key: "specialization", width: 25 },
        { header: "SRM Mail", key: "srm_mail", width: 25 },
        { header: "Personal Mail", key: "personal_mail", width: 25 },
        { header: "Placement", key: "placement", width: 25 },
        { header: "Mobile Number", key: "mobile_no", width: 25 },
        { header: "Faculty Advisor", key: "fa", width: 25 },
      ];

      // Add rows from query results
      worksheet.addRows(results);

      // Set filename dynamically based on filters
      let filename = `students_${netid}_${year}`;
      if (section) filename += `_${section}`;
      if (placement) filename += `_${placement.replace(/\s+/g, "_")}`;
      filename += ".xlsx";

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Failed to generate Excel file:", err);
      res.status(500).send("Failed to generate Excel file");
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
