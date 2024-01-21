const mysql = require("mysql");

const connection = mysql.createConnection({
    host: "localhost",
    database:"placement_management",
    user:'root',
    password:""
});

module.exports = connection;