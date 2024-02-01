const mysql = require("mysql");

const connection = mysql.createConnection({
    host: "localhost",
    database:"placement_management",
    user:'root',
    password:""
});

module.exports = connection;

/* 
CREATE TABLE `placement_management`.`users` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `netid` VARCHAR(10) NOT NULL,
    `email` VARCHAR(45) NOT NULL,
    `password` VARCHAR(95) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `email_UNIQUE` (`email` ASC)
  );
   */
/* 
  CREATE TABLE student_details (
    id INT AUTO_INCREMENT,
    netid VARCHAR(45) NOT NULL,
    year VARCHAR(10) NOT NULL,
    reg_no VARCHAR(45) NOT NULL,
    full_name VARCHAR(45) NOT NULL,
    gender VARCHAR(45),
    nri VARCHAR(45),
    dob DATE,
    specialization VARCHAR(45),
    section VARCHAR(45) NOT NULL,
    srm_mail VARCHAR(45),
    personal_mail VARCHAR(45),
    mobile_no VARCHAR(45),
    father VARCHAR(45),
    fa VARCHAR(45),
    placement VARCHAR(45),  -- Initially empty
    package VARCHAR(45),    -- Initially empty
    company VARCHAR(45),    -- Initially empty
    PRIMARY KEY (id),
    UNIQUE (netid, year, reg_no)
);
   */

  /* return{
      
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
    } */