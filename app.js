var races = [];
var evt;
var maxChronos = 15;
var maxLaps = 12;
var counter = 0;
var colorgrade = 1000; // 1000 = 1000ms = 1 sec. i.e. every different seconds gap will give a different color 

// get the event code from the href (e.g. 20221009_cro)
var l = document.location.href;
l = l.split('/event/');
if (l.length > 0) {
    evt = l[1].split('/')[0];
    console.log(evt);
    init();
} else {
    console.log('Run this script on chronorace page');
}

function init() {

    // check the available gender / age races
    $('li small').each(function () {
        var id = $(this).text();
        console.log('race:' + id);
        races[id] = {id : id, name: $(this).parent().find('span').text()};
    })

    // html framework
    framework();

    for (var r in races) {
        races[r].urlStartlist = "https://prod.chronorace.be/api/results/xco/" + evt + "/registration/" + r;
        races[r].urlOverview = "https://prod.chronorace.be/api/results/xco/" + evt + "/overview/" + r;
        races[r].status = '';
        races[r].fastestLap = 0;
        races[r].lastLap = 3;
        races[r].lastChrono = 5;
        races[r].chronos = [];
    }


    startListening();
    //console.log(races);
}


function startListening() {
    setInterval(function () {
        for (var r in races) {
            var race = races[r];
            //log('Checking status for ' + r + ' - ' + race.name + ' - ' + race.status);
            switch(race.status) {
                case '':
                    // start status, get the startlist first
                    if(counter % 10 == 0) {
                        checkStartlist(r);
                    }
                    break;
                case 'Startlist':
                    // startlist was loaded, check for overview
                    loadOverview(r);
                    break;
                case 'InProgress':
                    // race is ongoing
                    loadOverview(r);
                    break;
                case 'Arrivals' : 
                    // first rider has finished
                    loadOverview(r);
                    break;
                case 'NotStarted':
                    // Check for overview, but not that often
                    if(counter % 5 == 0) {
                        loadOverview(r);
                    }
                    break;
                case 'Finished':
                    // Finished, do nothing
                    break;
                default:
                    console.log(race.status);

            }
        }
        counter++;
     }, 4000);
}


function loadOverview(r) {
    var race = races[r];
    log('Checking for overview ['+race.name+']');
    $.ajax({
        url: race.urlOverview,
        dataType: "json",
        async: true,
        race: r,
        success: function (data) {
            processData(this.race,data);
        }
    })
}


function processData(r, data) {
    log('Overview loaded for:' + r);
    //console.log(data);
    var race = races[r];
    var maxChrono = 0;
    var maxLap = 0;
    var expand = false;
    var updatedChronos = [];

    // update status NotStarted, ?, Finished
    if (race.status !== data.Status) {
        // new status
        log('Status for [' + race.name + '] changed from [' + race.status + '] to [' + data.Status + ']');
        races[r].status = data.Status;
    }

    for (var i=0; i<data.OverviewData.length; i++ ) {
        var d = data.OverviewData[i];
        var dossard = d.Dossard;
        if (d.CurrentSituation) {
            var pos = d.CurrentSituation.Pos;
            var lap = d.CurrentSituation.Lap;
            var chrono = d.CurrentSituation.LapLocation;
            var gap = d.GapWithFirst;
            var time = d.CurrentSituation.TotalTime;
            var gap = d.CurrentSituation.GapWithFirst
            var newLocation = false;
            var row = $('#r' + dossard);
    
    
            // show position
            $(row).find('.pos').html(pos);
            $(row).find('.gap').html(formatDuration(gap));
    
            // expand Table?
            if (chrono > maxChrono) { maxChrono = chrono };
            if (maxChrono > race.lastChrono) {
                races[r].lastChrono = maxChrono;
                expand = true;
            }
            if (lap > maxLap) { maxLap = lap };
            if (maxLap > race.lastLap) {
                races[r].lastLap = maxLap;
                expand = true;
            }
    
            // rider status
            var riderStatus = '';
            var riderTitle = 'Racing';
            if (d.Status !== 'OK') {
                // DNF or 80% rule
                riderStatus = d.Status;
                riderTitle = d.Status;
            } else if (!d.InRace) {
                // finished
                riderStatus = 'FINISHED';
                riderTitle = 'Finished';
            }
            $(row).find('.rider').attr('title',riderTitle);
            $(row).find('.rider').addClass(riderStatus);
    
    
    
            // cell info
            var cell = $(row).find('.l' + lap + '.c' + chrono);
            if (!cell.attr('time')) { newLocation = true };
    
            if (newLocation) {
                cell.html(pos);
                cell.attr('pos',pos);
                cell.attr('time',time);
                cell.attr('gap',gap);

                // remeber what columns to color
                updatedChronos = (updatedChronos || []).concat([chrono]);
                // mark chrono as active
                races[r].chronos[chrono] = true;
    
                // previous cell & duration
                const previous = getPrevious(r,lap,chrono);
                prevLap = previous.lap;
                prevChrono = previous.chrono;
                const previousCell = $(row).find('.l'+prevLap+'.c'+prevChrono);
                // get duration
                const prev_time = parseInt(previousCell.attr('time'));
                const prev_gap = parseInt(previousCell.attr('gap'))
                if (time > prev_time && prev_time > 0) {
                    cell.attr('duration',time - prev_time);
                    cell.attr('gap_delta',gap - prev_gap);
                }
    
                // laptimes
                if (d.LapTimes) {
                    var lapCounter = 1;
                    for (var l=0; l<d.LapTimes.length; l++) {
                        var lapTime = d.LapTimes[l];
                        // sometimes the "laptime" between the start and first start-finish passage is added
                        // ignore laptime < 120 seconds
                        if (lapTime > 120000) {
                            $(row).find('.lap.l' + lapCounter).html(formatDuration(lapTime));
                            $(row).find('.lap.l' + lapCounter).attr('duration',lapTime);
                            if (lapTime < races[r].fastestLap || races[r].fastestLap == 0) {
                                races[r].fastestLap = lapTime;
                            }
                            lapCounter++;
                        }
                    }
                }
                // color the row
                updateRow(row);

                $(cell).addClass('hand');
                $(cell).bind('click',showDetails);
            }
        }

    }

    // show extra laps or chronos?
    if (expand) {
        expandTable(r,maxChrono,maxLap);
    }

    // order by position.
    sortTable(document.getElementById('table_' + r),1);

    // mark the fastest lap(s)
    if (races[r].fastestLap > 0) {
        $('#table_'+r+' .fastest').removeClass('fastest');
        $('#table_'+r+' .lap[duration='+races[r].fastestLap+']').addClass('fastest');
    }

    // color the chronos
    for (var i=0; i < updatedChronos.length; i++) {
        formatChrono(r,updatedChronos[i]);
    }

}

formatChrono = function (r,chrono) {
    // find the overall record (it's better to remember it than searching)
    var record = 0;
    $('#table_' + r).find('.c' + chrono + '[duration]').each(function () {
        var duration = parseInt($(this).attr('duration'));
        if ((duration < record || record == 0) && duration > 0) {
            record = duration;
        }
    });

    // color the gap to the record
    $('#table_' + r).find('.c' + chrono + '[duration]').each(function () {
        var duration = parseInt($(this).attr('duration'));
        var gap = Math.floor((duration - record)/colorgrade); // milliseconds
        var bgcolor = '#f00';
        var color = '#000';
        switch(gap) {
            case 0: bgcolor = '#0f0'; break;
            case 1: bgcolor = '#3f3'; break;
            case 2: bgcolor = '#6f6'; break;
            case 3: bgcolor = '#9f9'; break;
            case 4: bgcolor = '#cfc'; break;
            case 5: bgcolor = '#fcc'; break;
            case 6: bgcolor = '#f99'; break;
            case 7: bgcolor = '#f66'; break;
            case 8: bgcolor = '#f33'; color = '#fff'; break;
            default: break;
        }
        if (duration == record) {
            bgcolor = '#B700FF';
            color = '#fff';
        }
        $(this).css('background-color',bgcolor);
        $(this).css('color',color);
    });    
}



showDetails = function showDetails() {
    var raceTime = parseInt($(this).attr('time'));
    var duration = parseInt($(this).attr('duration'));
    var position = parseInt($(this).attr('pos'));
    var gap = parseInt($(this).attr('gap'));
    var gap_delta = parseInt($(this).attr('gap_delta'));
    var riderName = $(this).parent().find('.rider').text();
    var race = $(this).closest('table').attr('race');
    var html = riderName + ' | <strong>Race time</strong> : ' + formatDuration(raceTime);

    // lap and chrono
    var classNames = $(this).attr('class');
    var lap = classNames.split('l')[1].split(' ')[0];
    var chrono = classNames.split('c')[2].split(' ')[0];
    chronoInt = parseInt(chrono);
    if (chrono == 0) { chrono = 'finish'} else {chrono = 'Intermediate ' + chrono};
    html += ' | at ' + chrono + ' of lap ' + lap;
    if (duration) {
        html += ' | <strong>duration</strong> : ' + formatDuration(duration);
    }
    html += ' | <strong>position</strong> : ' + position;
    html += ' | <strong>gap</strong> : ' + formatDuration(gap);
    if (gap_delta) {
        console.log('' + gap_delta);
        html += ' (' + ((gap_delta < 0) ? '' : '+') + (Math.round(gap_delta/100) / 10) + ')'
    }
    html += segmentLeaderBoard(race,chronoInt);

    $('#detail_' + race).html(html);
}


function updateRow(row) {
    // mark personal best row 
    var personal = 0;
    var counter = 0;
    var total = 0;
    $(row).find('.lap').each(function() {
        var duration = parseInt($(this).attr('duration'));
        if (duration > 0) {
            counter++;
            total += duration;
            if (personal == 0 || duration < personal) {
                personal = duration;
            }
        }
    })
    if (counter > 1) {
        $(row).find('.lap.personal').removeClass('personal');
        $(row).find('.lap[duration='+personal+']').addClass('personal');
    }
}



function checkStartlist(r) {
    $.ajax({
        url: races[r].urlStartlist,
        dataType : "json",
        async: true,
        race: r,
        success: function (data) {
            // rider data is available
            // console.log(data);
            if (data) {
                log('Startlist loaded for ' + this.race);
                races[this.race].riders = data;
                races[this.race].status = 'Startlist';
                buildTable(this.race);
            } else {
                log('No startlist found for ' + r)
            }

        }
      })
}



function framework() {
    var style = document.createElement('style');
    style.innerHTML = '#app { padding: 5px; xxxmin-width: 5000px}';
    style.innerHTML += '.matrix td { font-size: 11px; padding-left: 2px; padding-right: 2px; border-bottom: 2px solid #eee; text-align: right }';
    style.innerHTML += '.matrix { border-collapse: collapse; }';
    
    // personal best
    style.innerHTML += '.matrix td.personal { border-bottom: 2px solid #00D800 }';
    // laps best
    style.innerHTML += '.matrix td.fastest { border-bottom: 2px solid #B700FF }';
    // vertical line separation laps
    style.innerHTML += '.c0_0, .c1_0, .c2_0, .c3_0, .c4_0, .c5_0, .c6_0, .c7_0, .c8_0, .c9_0, .c10_0, .c11_0 { border-right: 1px solid #ddd }';   
    // header separator 
    style.innerHTML += '.matrix .intermediates_row td { border-bottom: 1px solid #555; text-align: right}';
    style.innerHTML += '.matrix .intermediates_row td.lap { background-color:#ddd }';
    // rider 
    style.innerHTML += '.matrix td.rider { text-align: left}\r\n';
    style.innerHTML += '.matrix .DNF { background-color: #f00; color: #fff}\r\n';
    style.innerHTML += '.matrix .R80 { background-color: #444; color: #fff}\r\n';
    style.innerHTML += '.matrix .FINISHED { font-weight: bold }\r\n';
    style.innerHTML += '.matrix tr:hover .rider { border-bottom-color: #000 }\r\n';
    // lap times
    style.innerHTML += '.lap { font-weight: bold; border-left: 1px solid #ccc; border-right: 1px solid #ccc }\r\n';
    // pointer
    style.innerHTML += '.hand { cursor: pointer }\r\n';
    // leaderboard
    style.innerHTML += '.leaderboard { width: 800px }\r\n';

    // let's try to fix the first columns
    style.innerHTML += '.d { background-color: #fff; white-space: nowrap; position: sticky; left: 0; z-index: 1; background-clip: padding-box;  }\r\n';
    style.innerHTML += '.d:nth-child(1) { width: 150px; }\r\n';
    style.innerHTML += '.d:nth-child(2) { width: 20px; left: 150px; }\r\n';
    style.innerHTML += '.d:nth-child(3) { left: 170px; }\r\n';
    style.innerHTML += '.tablecontainer { overflow: auto; max-width: 100%}\r\n';
    style.innerHTML += '.matrix th { z-index: 2; position: sticky; top: 0; background: #e0e0e0;}\r\n';

    style.innerHTML += '';
    document.head.appendChild(style);

    $('body').html('<div id=app><div id="legend"></div><div id="statusbar"></div><div id="content"></div></div>');
    $('#legend').html('<p>Colors green to red mark fast to slow duration.<br>' +
        'green = within 1 second of the sections best time.<br>' +
        'red = 9 seconds or more slower than the section best.<br>' + 
        'purple is the section best.<br>' + 
        'Purple underline is fastest lap. Green underline is personal best lap</p>');


    for (r in races) {
        var race = races[r];
        $('#selectbar').append('<a selector="'+r+'">'+race.name+' <span class="status"></span></a>');
    }

}


function buildTable(id) {
    // id = ME, WE, MJ, .....
    var race = races[id];
    var html = '<h3>'+race.name+'</h3>';
    var tableId = 'table_' + id;
    html += '<div id="detail_'+id+'"></div>';
    html += '<div class="tablecontainer">'
    html += '<table class="matrix" id="'+tableId+'" race="'+id+'">';
    // c0_0 is the first start-finish
    var manyCells = '<td class="c c0 l0"></td>';
    // 0_0, 1_1, 1_2, 1_3, ......, 1_0, 2_1, ....
    for (var l=1; l <= maxLaps; l++) {
        // laps
        for (var c=1; c <= maxChronos; c++) {
            // intermediates
            manyCells += '<td class="c l' + l + ' c' + c + '"></td>';
        }
        // finish of the lap
        manyCells += '<td class="c l' + l + ' c0"></td>';
        // Lap column
        manyCells += '<td class="lap l' + l + '"></td>';
    }
    html += '<thead>';
    html += '<tr class="intermediates_row"><td class="d"></td><td class="d"></td><td class="d"></td>' + manyCells + '</tr>';
    html += '</thead>';
    html += '<tbody>';
    var riders = races[id].riders;
    for (riderIndex in riders) {
        html += '<tr class="data_row" id="r'+riders[riderIndex].Dossard+'">';
        html += '<td class="rider d">'+riders[riderIndex].Nom+'</td><td class="pos d"></td><td class="gap d"></td>';
        html += manyCells;
        html += '</tr>';
    }
    html += '</table></div>';
    $('#content').append(html);

    // hide some cells
    for (var i=race.lastChrono + 1; i <= maxChronos; i++) {
        $('#' + tableId + ' .c' + i).hide();
    }
    for (var i=race.lastLap + 1; i <= maxLaps; i++) {
        $('#' + tableId + ' .l' + i).hide();
    }

    // fill the header
    for (var l=1; l <= maxLaps; l++) {
        $('#' + tableId + ' .intermediates_row .lap.l' + l).html('lap ' + l);
    }
    $('#' + tableId + ' .intermediates_row .c0').html('F');
    for (var c=1; c <= maxChronos; c++) {
        $('#' + tableId + ' .intermediates_row .c' + c).html(c);
    }
}


cellInfo = function (cell) {
    // cell info from onclick
    var result = {};

    // get selected cell info
    const classNames = $(cell).attr('class');
    result.lap = parseInt(classNames.split('l')[1].split(' ')[0]);
    result.chrono = parseInt(classNames.split('c')[2].split(' ')[0]);
    result.raceId = $(this).closest('table').attr('race');

    return result;
}


getPrevious = function (raceId, lap, chrono) {
    const race = races[raceId];
    var result = {};

    // find the previous cell
    // intermediates can be offline. For example intermediates 3 and 5 may not be functioning, we'll try to ignore them
    // Current, StartFinish and lastIntermediate are assumed active
    // An intermediate may be active, but data still may be missing
    var found = false;
    var prevLap = lap;
    var prevChrono = chrono;
    var counter = 0;

    while (!found && counter <= 2 && (prevLap > 0 || prevChrono > 0)) {
        if (prevChrono == 0) {
            // start-finish
            prevChrono = race.lastChrono;
            found = true;
        } else if (prevChrono == 1) {
            prevChrono--;
            prevLap--;
            found = true;
        } else {
            prevChrono--;
        }

        if (race.chronos[prevChrono]) {
            // the chrono is active
            found = true;
        }
        counter++;
    }

    result.lap = prevLap;
    result.chrono = prevChrono;

    return result;

}

function expandTable(r,chrono,lap) {
    for (var l=1; l<=Math.max(lap,3); l++) {
        for (var c=0; c<=chrono; c++) {
            $('#table_' + r + ' .l' + l + '.c' + c).show();
        }
        $('#table_' + r + ' .lap.l' + l).show();
    }
}

segmentLeaderBoard = function (r,chrono,chronoFrom = false) {
    const tableId = '#table_' + r;
    var html = '';

    var leaderBoard = [];

    if (!chronoFrom) { 
        const previous = getPrevious(r,1,chrono);
        chronoFrom = previous.chrono;
    }

    $(tableId + ' .c.c' + chrono).each(function () {
        var startTime;
        var finishTime;
        var duration;
        var lap;
        var rider;
        var lapFrom;

        // collect the durations
        if ($(this).attr('time')) {
            var info = cellInfo(this);

            lap = info.lap;
            lapFrom = lap;
            if (chronoFrom == 0) lapFrom = lap - 1;


            // check if the starting intermediate exists
            var cell = $(this).parent().find('.l'+lapFrom + '.c' + chronoFrom);
            if ($(cell).attr('time')) {
                // start and finish has data
                startTime = parseInt($(cell).attr('time'));
                finishTime = parseInt($(this).attr('time'));
                duration = finishTime - startTime;
                rider = $(this).parent().find('.rider').text();

                if (finishTime > startTime) {
                    leaderBoard.push(
                        {
                            "duration" : duration,
                            "startTime" : startTime,
                            "finishTime" : finishTime,
                            "lap" : lap,
                            "rider" : rider
                        }
                    );
                }
            }
        }
    })
    if (leaderBoard.length > 0) {

        // order by duration   
        leaderBoard.sort((a, b) => a.duration - b.duration);

        html += '<br><br><h4>Segment leaderboard [chrono ' + ((chronoFrom == 0) ? 'start' : chronoFrom) + ' - ' + ((chrono == 0) ? 'finish' : chrono) +']</h4><table class="leaderboard">'
        for (var i=0; i < Math.min(20,leaderBoard.length); i++) {
            var row = leaderBoard[i];
            html += '<tr><td>' + (i+1) + '</td><td>' + row.rider + '</td><td>lap ' + row.lap + '</td><td>' + formatDuration(row.duration,true) + '</td>';
            html += '<td>(' + formatDuration(row.startTime) + ' -  ' + formatDuration(row.finishTime) + ')</td></tr>\r\n'
        }
        html += '</table><br><br>'
    }
    return html;
}


/***************************************
 * 
 * Common functions
 * 
 ***************************************/



function playBeep(frequency = 440, duration = 500) {
    // Create an audio context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create an oscillator node (for generating sound)
    const oscillator = audioCtx.createOscillator();
    
    // Set the frequency of the beep (440Hz is a common pitch, like an A note)
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    // Connect the oscillator to the audio context's destination (speakers)
    oscillator.connect(audioCtx.destination);

    // oscillator.type = 'square'; // Types: 'sine', 'square', 'sawtooth', 'triangle'
    
    // Start the sound
    oscillator.start();

    // Stop the sound after the duration specified in milliseconds
    setTimeout(() => {
        oscillator.stop();
        audioCtx.close(); // Close the audio context when done to save resources
    }, duration);
}



function sortTable(table, columnIndex) {
    const tbody = table.tBodies[0]; // Get the first <tbody> of the table
    const rowsArray = Array.from(tbody.rows); // Convert rows to an array for sorting
  
    // Sort rows based on the specified column (convert cell content to a number)
    rowsArray.sort((rowA, rowB) => {
      var cellA = parseInt(rowA.cells[columnIndex].textContent, 10);
      var cellB = parseInt(rowB.cells[columnIndex].textContent, 10);
      // DNS / DNF
      if (!cellA) {cellA = 999};
      if (!cellB) {cellB = 999};
      return cellA - cellB;
    });
  
    // Append sorted rows back to the tbody
    rowsArray.forEach(row => tbody.appendChild(row));
}



function log(msg) {
    console.log(getCurrentTime() + ' ' + msg);
}


function getCurrentTime() {
    const now = new Date();
  
    // Get hours, minutes, and seconds
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
  
    // Return in HH:MM:SS format
    return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(milliseconds, showTenths = false) {
    // Calculate total seconds, minutes, and hours
    const totalSeconds = Math.floor(milliseconds / 1000);
    const tenths = Math.floor((milliseconds % 1000) / 100); // Tenths of a second
    const seconds = totalSeconds % 60;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const hours = Math.floor(totalSeconds / 3600);
  
    // Format seconds with leading zero
    const formattedSeconds = String(seconds).padStart(2, '0');
    const formattedTenths = String(tenths);
  
    // Return the formatted string based on duration
    if (hours > 0) {
        // Include leading zeros for minutes and seconds when hours are present
        const formattedMinutes = String(minutes).padStart(2, '0');
        if (showTenths) {
            return `${hours}:${formattedMinutes}:${formattedSeconds}.${formattedTenths}`;
        } else {
            return `${hours}:${formattedMinutes}:${formattedSeconds}`;
        }
    } else {
      // No leading zero for minutes when less than an hour
      if (showTenths) {
        return `${minutes}:${formattedSeconds}.${formattedTenths}`;
      } else {
        return `${minutes}:${formattedSeconds}`;
      }
    }
  }

