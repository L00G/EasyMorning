var dayStr = ["Mon ", "Tue ", "Wed ", "Thu ", "Fri ", "Sat ", "Sun"];
var nowAlarmNum = -1;

function changeBody(val) {
    if (val == 0) {
        $('#noUserMessage').css("display", "block");
        $('#alarmMenu').css("display", "none");
        $('#users').css("display", "none");
        $('#mainBody').css("display", "none");
        $('#optionBody').css("display", "none");
    }
    else if (val == 1) {
        $('#noUserMessage').css("display", "none");
        $('#alarmMenu').css("display", "none");
        $('#users').css("display", "block");
        $('#mainBody').css("display", "none");
        $('#optionBody').css("display", "none");
    }
    else if (val == 2) {
        $('#noUserMessage').css("display", "none");
        $('#alarmMenu').css("display", "block");
        $('#users').css("display", "block");
        $('#mainBody').css("display", "block");
        $('#optionBody').css("display", "none");
    }
    else if (val == 3) {
        $('#noUserMessage').css("display", "none");
        $('#alarmMenu').css("display", "block");
        $('#users').css("display", "block");
        $('#mainBody').css("display", "none");
        $('#optionBody').css("display", "block");
    }
}

function makeDayStr(dayNum) {
    var str = "";
    if (dayNum == 0) {
        str = "Today"
    } else for (var i = 0; i < 7; i++) {
        if (dayNum & (1 << (i + 1))) {
            str += dayStr[i];
        }
    }
    return str;
}

function isChecked(isActivity) {
    if (isActivity)
        return "checked";
    return "unchecked";
}

function refreshUser() {
    $.get("/api/users", function (data, status) {
        $("#users").empty();
        nowAlarmNum = -1;
        if (data.length == 0) {
            changeBody(0);
        }
        else {
            $.each(data, function (key, val) {
                var str = '<input type = "button" class = "user" value = "' + val.name + '" id="' + val.alarmNum + '">';
                $("#users").append(str);
            });
            changeBody(1);
            refreshPage();
        }
    });

}

function refreshPage() {
    $(".ListTable").empty();
    $.get("/api/alarms/" + nowAlarmNum, function (data, status) {
        $.each(data, function (key, val) {
            val.hour = (val.hour < 10) ? "0" + val.hour : val.hour;
            val.minute = (val.minute < 10) ? "0" + val.minute : val.minute;
            var str = '<tr class="ListItem" id="ListItem"' + val._id + '>\
                    <td class="ListTime">\
                        <h3>'+ val.hour + ' : ' + val.minute + '</h3>\
                        <h4>'+ makeDayStr(val.day) + '</h4> \
                    </td>\
                    <td class="toggleItem">\
                        <div class="toggle">\
                            <input  type="checkbox" id='+ val._id + ' class="alarm cmn-toggle cmn-toggle-round">\
                            <label for='+ val._id + '></label>\
                        </div>\
                    </td>\
                    <td class="ListBtn">\
                        <input type ="button" class="btn removeAlarmBtn" id='+ val._id + ' value="Del"/>\
                    </td>\
                </tr>';
            $(".ListTable").append(str);
            $("#" + val._id).prop("checked", val.isActivity);
        });
    });
}

function refreshOption() {
    $.get("/api/users/" + nowAlarmNum, function (data, status) {
        $("#volume").val(data[0].maxVolume);
        $("#volume").next().next().next().html(data[0].maxVolume);
        $("#length").val(data[0].duration);
        $("#length").next().next().next().html(data[0].duration + "min");
        $("#volumeDelay").attr("max", data[0].duration);
        $("#volumeDelay").next().next().html(data[0].duration + "min");
        $("#volumeDelay").next().next().next().html(data[0].volumeDelay + "min");
        $("#volumeDelay").val(data[0].volumeDelay);
        $("#checkMotion").prop("checked", data[0].isCheckMotion);
        $("#checkWeather").prop("checked", data[0].isCheckWeather);
    });
}

$(document).ready(function () {

    refreshUser();

    $(".dayBtn").click(function () {
        if ($(this).attr("id") == "1") {
            $(this).css("background-color", "#ffffff");
            $(this).attr("id", "0");
        }
        else {
            $(this).css("background-color", "#008CBA");
            $(this).attr("id", "1");
        }
    });

    $("#addAlarmBtn").click(function () {
        var dayStr = "";
        var dayData = 0;
        var dayBtn = $("#dayBtnSet").children(".dayBtn");
        for (var i = 0; i < 7; i++) {
            if (dayBtn.eq(i).attr("id") == "1") {
                dayData = dayData | (1 << (i + 1));
            }
        }
        $.post("/api/alarms", { "alarmNum": nowAlarmNum, "hour": hour, "minute": minute, "day": dayData }, function (data, status) {
            refreshPage();
        }, "json");
    });

    $(document).on("click", ".removeAlarmBtn", function () {
        $.ajax(
            {
                url: '/api/alarms/id/' + $(this).attr("id"), type: 'DELETE', success: function (data) {
                    refreshPage();
                }
            });
    });

    $("#addUser").click(function () {
        var answer = prompt("사용자 이름을 입력하세요.");
        if (answer == "") {
            while (answer == "")
                answer = prompt("다시 입력해주세요.");
        }
        if (answer != null) {
            $.post("/api/users", { "name": answer, "alarmNum": $("#users").children().length + 1 }, function (data, status) {
                refreshUser();
            }, "json");
        }
    });

    $("#deleteUser").click(function () {
        $.ajax(
            {
                url: '/api/users/' + nowAlarmNum, type: 'DELETE', success: function (data) {
                    $.ajax(
                        {
                            url: '/api/users/allUpdate', type: 'PUT', success: function (data) {
                                refreshUser();
                            }
                        });
                }
            });
    });

    $("#saveBtn").click(function () {
        $.ajax({
            url: '/api/users/optionUpdate/' + nowAlarmNum,
            type: 'PUT',
            data: {
                maxVolume: $("#volume").val(), duration: $("#length").val(), volumeDelay: $("#volumeDelay").val(),
                isCheckMotion: $("#checkMotion").is(':checked'), isCheckWeather: $("#checkWeather").is(':checked')
            },
            dataType: 'json',
        });
        $("#completeMessage").show();
    });

    $("#optionBody").change(function () {
        $("#completeMessage").hide();
    });

    $("#main").click(function () {
        changeBody(2);
        refreshPage();
    })

    $("#option").click(function () {
        changeBody(3);
        refreshOption();
    })

    $(document).on("click", ".user", function () {
        $("#users").children(".user").css("color", "#bdc3c7");
        nowAlarmNum = $(this).attr("id");
        $(this).css("color", "black");
        changeBody(2);
        refreshPage();
    });

    $(document).on("change", ".alarm", function () {
        if ($(this).is(':checked')) {
            $.ajax({
                url: '/api/alarms/update/' + $(this).attr("id"),
                type: 'PUT',
                data: { "isActivity": true, "lastWorkDay": -1 },
                dataType: 'json',

                success: function (data) {
                }
            });
        } else {
            $.ajax({
                url: '/api/alarms/update/' + $(this).attr("id"),
                type: 'PUT',
                data: { "isActivity": false },
                dataType: 'json',

                success: function (data) {
                }
            });
        }
    });

});