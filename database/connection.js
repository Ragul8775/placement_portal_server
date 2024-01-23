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
    `name` VARCHAR(45) NOT NULL,
    `email` VARCHAR(45) NOT NULL,
    `password` VARCHAR(45) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `email_UNIQUE` (`email` ASC)
  );
   */