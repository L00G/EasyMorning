var express = require('express'),
  request = require('request'),
  app = express(),
  bodyParser = require('body-parser'),
  mongoose = require('mongoose'),
  schedule = require('node-schedule');

var weatherUpdateRule = new schedule.RecurrenceRule(),
  resetRule = new schedule.RecurrenceRule();
weatherUpdateRule.minute = 30;
resetRule.dayOfWeek = 0;

app.use(express.static('./views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var db = mongoose.connection;
console.log("connecting");
db.on('error', console.error);
db.once('open', function () {
  // CONNECTED TO MONGODB SERVER
  console.log("Connected to mongod server");
});

mongoose.connect('mongodb://localhost/iotAlarm');

var User = require('./models/alarm').user,
  Alarm = require('./models/alarm').alarm,
  router = require('./routes').alarm(app, Alarm, request);
router = require('./routes').user(app, User, request);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/mainPage.html');
})

app.get('/optionPage', function (req, res) {
  res.sendFile(__dirname + '/views/optionPage.html');
})

app.listen(3000);

schedule.scheduleJob(weatherUpdateRule, function () {
  console.log("start check weather")
  request({
    method: 'GET',
    url: 'http://localhost:3000/api/users',
  }, function (err, resp, data) {
    users = JSON.parse(data);
    users.forEach(function (user) {
      if (user.isCheckWeather) {
        request({
          method: 'GET',
          url: 'http://localhost:3000/api/weathers',
          json: { alarmNum: user.alarmNum, connectIp: user.connectIp }
        }, function (err, resp, data) {

        });
      }
    }, this);
  });
})

schedule.scheduleJob(resetRule, function () {
  console.log("start reset workday")
  request({
    method: 'GET',
    url: 'http://localhost:3000/api/alarms',
  }, function (err, resp, data) {
    alarms = JSON.parse(data);
    alarms.forEach(function (alarm) {
      request({
        method: 'PUT',
        url: 'http://localhost:3000/api/alarms/update/' + alarm._id,
        json: { lastWorkDay: -1 },
      }, function (err, resp) {
        console.log(err);
        return res.json({ success: 'reset Alarm workday' });
      });
    })
  });
})
