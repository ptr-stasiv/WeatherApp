const express = require('express')
const mysql = require("mysql")
const fs = require('fs');
const { dirname } = require('path');
const app = express()

const db = mysql.createConnection({
  host: "database-meteo.cjaoo4yk2a0q.eu-central-1.rds.amazonaws.com",
  port: "3306",
  user: "admin",
  password: "12345678",
  database: "meteodb"
});

db.connect(err => {
  if(err) {
    console.log("Error connection to Data Base");
  }
  else
  {
    console.log("Data Base connected");
  }
});

app.get('/', (req, res) => {

  fs.readFile(__dirname + "/../views/index.html", function (err, html) {
    if (err) {
        throw err; 
    }      

    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(html);  
    res.end();  
  });

});

app.listen(80);