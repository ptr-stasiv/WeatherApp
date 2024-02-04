const express = require('express')
const mysql = require("mysql")
const fs = require('fs');
const path = require('path');
const MOMENT = require( 'moment' );
const app = express()
const bcrypt = require("bcrypt")
const ejs = require('ejs');
const session = require('express-session');

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
}));

app.set('view engine', 'ejs');

app.use(express.urlencoded());
app.use(express.json());

const PUBLIC_DIRECTORY = path.join(__dirname, '../public');

app.use('/public', express.static(PUBLIC_DIRECTORY));

const saltRounds = 10

const pool = mysql.createPool({
  host: "database-meteo.cjaoo4yk2a0q.eu-central-1.rds.amazonaws.com",
  port: "3306",
  user: 'admin',
  database: 'meteodb',
  password: '12345678',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function sendHoursDataForDay(res, datetime) {
  pool.getConnection((err, connection) => {
    connection.query('SELECT id FROM meteodb.measurements_days WHERE measure_day = ?', [datetime], (err, results) => {
      
      if(results[0])
      {
        dayId = results[0]['id'];

        connection.query('SELECT * FROM meteodb.measurements_hours WHERE day_id = ?', [dayId], (err, results) => {
          if(results.length > 0) {
              res.json(results);
            }
        });
      }
      else
      {
        res.json([]);
      }

      connection.release();
    });
  });
}

app.post("/create", (req, res) => {
  firstName = req.body['first-name'];
  lastName = req.body['last-name'];
  email = req.body['email'];
  password = req.body['password'];
  confirmPassword = req.body['confirm-password'];

  if(password.length < 4) {
    return res.status(400).json({ message: "Password less than 4 characters" })
  }

  if(confirmPassword != password){
    return res.status(400).json({ message: "Confirm password is not right" })
  }

  pool.getConnection((err, connection) => {
    connection.query('SELECT id FROM meteodb.users WHERE email = ?', 
    [email], (err, results) => {
      if(results.length > 0) {
        connection.release();
        return res.status(400).json({ message: "This email is already registered" })
      }
      else
      {
        bcrypt
        .genSalt(saltRounds)
        .then(salt => {
          return bcrypt.hash(password, salt)
        })
        .then(hash => {
          connection.query('INSERT INTO meteodb.users (name, email, password) VALUES (?, ?, ?)', 
          [firstName + " " + lastName, email, hash], (err, results) => {
            connection.release();
            if(!err)
            {
              res.status(200).json({ message: "Account created" })
            }
          });
        })
        .catch(err => console.error(err.message))
      }
    });
  });
})

app.post("/logout", (req, res) => { 
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      return res.redirect('/');
    }
  });
});

app.post("/login", (req, res) => {
  email = req.body['email'];
  password = req.body['password'];

  pool.getConnection((err, connection) => {
    connection.query('SELECT password FROM meteodb.users WHERE email = ?', 
    [email], (err, results) => {
      connection.release();

      if(!results[0]) {
        return res.status(400).json({ message: "This email is not yet registered" })
      }

      bcrypt.compare(password, results[0].password, (err, val) => {
        if(val)
        {
          req.session.isLoggedIn = true;
          return res.status(200).json({ message: "/main" });
        }
        else
        {
          return res.status(400).json({ message: "Password or login is invalid" });
        }
      });
    });
  });
});

app.get('/getHoursDate/:day', (req, res) => {
  datetime = req.params.day;
  sendHoursDataForDay(res, datetime);
});

app.get('/main', (req, res) => {

  if(!req.session.isLoggedIn) {
    return res.redirect('/login');
  }

  fs.readFile("public/views/index.html", function (err, html) {
    if (err) {
        throw err; 
    }      

    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(html);  
    res.end();  
  });
});

app.get('/login', (req, res) => {
  fs.readFile("public/views/login/login_page.html", function (err, html) {
    if (err) {
        throw err; 
    }      

    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(html);  
    res.end();  
  });
});

app.get('/', (req, res) => {
  res.redirect('/main');
});

function randomInRange(min, max) {  
  return Math.floor(
    Math.random() * (max - min) + min
  )
}

function insertPerTimeData(dayId) {
  const time = MOMENT().format("HH:mm:ss"); 
  const temperatureAir = randomInRange(0, 15);
  const temperatureGround = randomInRange(5, 10);
  const pressure = randomInRange(1000, 1030);
  const humidity = randomInRange(30, 70);
  const wind = randomInRange(4, 13);

  pool.getConnection((err, connection) => {
    connection.query('INSERT INTO meteodb.measurements_hours (measure_time, temperature_air, temperature_ground, pressure, humidity, wind, day_id) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [time, temperatureAir, temperatureGround, pressure, humidity, wind, dayId], (err, results) => {
      if(!err)
      {
        console.log(`New data generated: ${time},  Air: ${temperatureAir}, Ground: ${temperatureGround}, Pressure: ${pressure}, Humidity: ${humidity}, Wind: ${wind}`)
      }

      connection.release();
    });
  });
}

async function generateWeatherData() {
  try{
    const datetime = MOMENT().format('YYYY-MM-DD'); 


    pool.getConnection((err, connection) => {
      connection.query('SELECT id FROM meteodb.measurements_days WHERE measure_day = ?', [datetime], (err, results) => {
          if(!results[0])
          {
            connection.query(`INSERT INTO meteodb.measurements_days (measure_day) VALUES (?)`, [datetime], (err, results) => {              
              connection.query(`SELECT LAST_INSERT_ID() as lastId`, (err, results) => {
                if(!err)
                {
                  insertPerTimeData(results[0].lastId);
                }
              });

            });
          }
          else
          {
            id = results[0]['id'];
            insertPerTimeData(id);
          }

          connection.release();
      });
    });
  }
  catch(err){
    console.error('Error inserting data:', error);
  }
}

setInterval(generateWeatherData, 1800 * 1000);

app.listen(80);