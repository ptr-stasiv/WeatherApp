const express = require('express')
const mysql = require("mysql")
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

  console.log("Data Base connected");
});

app.get('/', (req, res) => {
  res.send('hello world')
})

app.listen(80);