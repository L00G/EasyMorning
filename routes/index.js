var moment = require('moment');
var ipFinderAccessKey = "947501ebc5f2cabd80b864ec4b08ac5be99250906db4da8cda9073825c8524ec"; 
var openWeaterMapAccessKey ="66ee59a78a506abaf0759b1004440c65";

module.exports.user = function (app, User, request) {
    app.get('/api/start/:arduino', function (req, res) {
        var ip = (req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress).split(':').slice(-1);

        User.update({ alarmNum: req.params.alarmNum }, { connectIp: ip }, function (err, output) {
            User.find(function (err, users) {
                if (err) return res.status(500).send({ error: 'database failure' });
                var t = {};
                t = Object.assign(t, { "length": users.length });
                var time = moment().format('YYMMDDHHmmssd');
                res.json(Object.assign(t, { "time": time }));
            })
        })
    });

    app.get('/api/users', function (req, res) {
        User.find(function (err, users) {
            if (err) return res.status(500).send({ error: 'database failure' });
            res.json(users);
        })
    });

    app.get('/api/users/:alarmNum', function (req, res) {
        User.find({ alarmNum: req.params.alarmNum }, function (err, users) {
            if (err) return res.status(500).send({ error: 'database failure' });
            res.json(users);
        })
    });

    app.get('/api/weathers', function (req, res) {
        console.log("load weather");
        if (req.body.connectIp != "0") {
            request({
                method: 'GET',
                url: 'http://api.ipinfodb.com/v3/ip-city/?key='+ipFinderAccessKey+'&ip=' + req.body.connectIp + '&format=json',
            }, function (err, resp, data) {
                data = JSON.parse(data);
                request({
                    method: 'GET',
                    url: 'http://api.openweathermap.org/data/2.5/weather?lat=' + data.latitude + '&lon=' + data.longitude + '&appid='+openWeaterMapAccessKey,
                }, function (err, resp, data) {
                    request({
                        method: 'PUT',
                        url: 'http://localhost:3000/api/users/optionUpdate/' + req.body.alarmNum,
                        json: { weatherState: JSON.parse(data).weather[0].id },
                    }, function (err, resp) {
                        return res.json({ success: 'weatherState' });
                    });
                });
            });
        } else {
            return res.json({ success: 'dont need change state' });
        }
    });

    app.post('/api/users', function (req, res) {
        var user = new User();
        user.name = req.body.name;
        user.alarmNum = req.body.alarmNum;
        user.maxVolume = 15;
        user.duration = 0;
        user.volumeDelay = 0;

        user.save(function (err) {
            if (err) {
                console.error(err);
                res.json({ result: 0 });
                return;
            }
            res.json({ result: 1 });
        });
    });

    app.put('/api/users/optionUpdate/:alarmNum', function (req, res) {
        User.update({ alarmNum: req.params.alarmNum }, { $set: req.body }, function (err, output) {
            if (err) res.status(500).json({ error: 'database failure' });
            console.log(output);
            if (!output.n) return res.status(404).json({ error: 'book not found' });
            res.json({ message: 'book updated' });
        })
    });

    app.put('/api/users/allUpdate', function (req, res) {
        User.find().sort({ "alarmNum": 1 }).exec(function (err, users) {
            if (err) return res.status(500).send({ error: 'database failure' });
            var count = 1;
            var length = users.length;
            var cbcount = 0;
            if (users.length == 0) {
                return res.status(200).send({ success: 'update end' });
            } else {
                users.forEach(function (val) {
                    var mycount = count;
                    length--;
                    if (val.alarmNum != mycount) {
                        length++;
                        request({
                            method: "PUT",
                            url: 'http://localhost:3000/api/alarms/allUpdate/' + val.alarmNum,
                            json: { alarmNum: mycount },
                        }, function (err, resp) {
                            User.update({ alarmNum: val.alarmNum }, { alarmNum: mycount }, function (err, output) {
                                //console.log(output);
                                cbcount++;
                                console.log(val.name, mycount, cbcount, length);
                                if (cbcount == length) {
                                    (function () {
                                        return res.status(200).send({ success: 'update end' });
                                    }());
                                }
                            });
                        });
                    }
                    if (length == 0) {
                        (function () {
                            return res.status(200).send({ success: 'update end' });
                        }());
                    }
                    count++;
                });
            }
        })
    });

    app.delete('/api/users/:alarmNum', function (req, res) {
        User.remove({ alarmNum: req.params.alarmNum }, function (err, output) {
            if (err) return res.status(500).json({ error: "database failure" });
            request({
                method: "DELETE",
                url: 'http://localhost:3000/api/alarms/alarmNum/' + req.params.alarmNum,
            }, function (err, resp) {
                res.json({ success: 'same alarmNum all clear' });
            });
        })
    });
}

module.exports.alarm = function (app, Alarm, request) {
    // GET SINGLE BOOK
    app.get('/api/alarms', function (req, res) {
        Alarm.find(function (err, alarms) {
            if (err) return res.status(500).send({ error: 'database failure' });
            res.json(alarms);
        })
    });

    app.get('/api/alarms/:alarmNum', function (req, res) {
        Alarm.find({ alarmNum: req.params.alarmNum }, function (err, alarms) {
            if (err) return res.status(500).send({ error: 'database failure' });
            res.json(alarms);
        })
    });

    // GET BOOK BY AUTHOR
    app.get('/api/arduino/alarms/:alarmNum/:isMove', function (req, res) {
        request({
            method: 'GET',
            url: 'http://localhost:3000/api/users/' + req.params.alarmNum,
        }, function (err, resp, user) {
            user = JSON.parse(user)[0];
            var nowHour = moment().hour();
            var nowMinute = moment().minute();
            var checkHour = nowHour
            var checkMinute = nowMinute
            if (user.isCheckWeather) {
                if (user.weatherState / 100 == 5 || user.weatherState / 100 == 6) {
                    checkMinute += 10;
                    if (checkMinute >= 60) {
                        checkHour += 1;
                        checkMinute -= 60;
                    }
                }
            }
            if (req.params.isMove) {
                if (user.isCheckMotion) {
                    checkMinute += 30;
                    if (checkMinute >= 60) {
                        checkHour += 1;
                        checkMinute -= 60;
                    }
                }
            }
            var m = [];
            if (nowMinute < checkMinute) {
                for (var i = nowMinute; i <= checkMinute; i++) {
                    m.push(i)
                }
            }
            if (nowMinute >= checkMinute) {
                for (var i = nowMinute; i < 60; i++) {
                    m.push(i)
                }
                for (var i = 0; i <= checkMinute; i++) {
                    m.push(i);
                }
            }
            Alarm.find({
                alarmNum: req.params.alarmNum, hour: { $gte: nowHour, $lte: checkHour }, minute: { $in: m }, isActivity: true
            }).sort({ "day": 1 }).exec(function (err, alarms) {
                if (err) return res.status(500).send({ error: 'database failure' });
                else if (alarms.length != 0) {
                    var find = false;
                    var cbcount = 0;
                    alarms.forEach(function (val) {
                        if (!find) {
                            if (val.lastWorkDay != moment().weekday()) {
                                if (val.day == 0) {
                                    find = true;
                                    request({
                                        method: 'PUT',
                                        url: 'http://localhost:3000/api/alarms/update/' + val._id,
                                        json: { isActivity: false, lastWorkDay: moment().weekday() },
                                    }, function (err, resp) {
                                        console.log(err);
                                        return res.json({
                                            "maxVolume": user.maxVolume, "duration": user.duration,
                                            "volumeDelay": user.volumeDelay, "success": 'anything today'
                                        });
                                    });
                                } else if (val.day & (1 << moment().weekday())) {
                                    find = true;
                                    request({
                                        method: 'PUT',
                                        url: 'http://localhost:3000/api/alarms/update/' + val._id,
                                        json: { lastWorkDay: moment().weekday() },
                                    }, function (err, resp) {
                                        return res.json({
                                            "maxVolume": user.maxVolume, "duration": user.duration,
                                            "volumeDelay": user.volumeDelay, "success": 'find match Alarm'
                                        });
                                    });
                                }
                            }
                        }
                        cbcount++;
                        if (!find && cbcount == alarms.length) {
                            (function () {
                                return res.status(500).send({ error: 'cant find match Alarm' });
                            }());
                        }
                    });
                }
                else return res.status(500).send({ error: 'cant find running Alarm' });
            });
        });
    });

    // CREATE BOOK
    app.post('/api/alarms', function (req, res) {
        var alarm = new Alarm();
        alarm.alarmNum = req.body.alarmNum;
        alarm.hour = req.body.hour;
        alarm.minute = req.body.minute;
        alarm.day = req.body.day;

        alarm.save(function (err) {
            if (err) {
                console.error(err);
                res.json({ result: 0 });
                return;
            }
            res.json({ result: 1 });
        });
    });

    // UPDATE THE BOOK
    app.put('/api/alarms/update/:_id', function (req, res) {
        Alarm.update({ _id: req.params._id }, { $set: req.body }, function (err, output) {
            if (err) res.status(500).json({ error: 'database failure' });
            console.log(output);
            if (!output.n) return res.status(404).json({ error: 'book not found' });
            res.json({ message: 'book updated' });
        })
    });

    app.put('/api/alarms/allUpdate/:alarmNum', function (req, res) {
        Alarm.updateMany({ alarmNum: req.params.alarmNum }, { $set: req.body }, function (err, output) {
            if (err) res.status(500).json({ error: 'database failure' });
            console.log(output);
            if (!output.n) return res.status(404).json({ error: 'book not found' });
            res.json({ message: 'book updated' });
        })
    });

    // DELETE BOOK
    app.delete('/api/alarms/id/:_id', function (req, res) {
        Alarm.remove({ _id: req.params._id }, function (err, output) {
            if (err) return res.status(500).json({ error: "database failure" });
            res.status(204).end();
        })
    });

    app.delete('/api/alarms/alarmNum/:alarmNum', function (req, res) {
        Alarm.remove({ alarmNum: req.params.alarmNum }, function (err, output) {
            if (err) return res.status(500).json({ error: "database failure" });
            res.status(204).end();
        })
    });


}
