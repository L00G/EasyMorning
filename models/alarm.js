var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var alarmSchema = new Schema({
    alarmNum: Number,
    hour: Number,
    minute: Number,
    day: Number,
    lastWorkDay: { type: Number, default: -1 },
    isActivity: { type: Boolean, default: true }
});

var playerSchema = new Schema({
    alarmNum: Number,
    name: String,
    maxVolume: Number,
    duration: Number,
    volumeDelay: Number,
    isCheckWeather: { type: Boolean, default: false },
    isCheckMotion: { type: Boolean, default: false },
    weatherState: { type: Number, default: Number },
    connectIp: { type: String, default: "0" }
});

module.exports.alarm = mongoose.model('alarm', alarmSchema);
module.exports.user = mongoose.model('user', playerSchema);