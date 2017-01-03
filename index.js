var config = require('./config');
var casper = require('casper').create({
  clientScripts: ['./jquery.min.js'],
});

var url = 'https://goes-app.cbp.dhs.gov/goes/jsp/login.jsp';
var username = config.username;
var password = config.password;
var airport = config.airport;
var accountSid = config.twilio.accountSid;
var serviceSid = config.twilio.serviceSid;
var authToken = config.twilio.authToken;
var toNumber = config.twilio.toNumber;
var fromNumber = config.twilio.fromNumber;
var providedDay;
var notify;

function CasperException(message, stack) {
  this.name = 'CasperException';
  this.message = message;
  this.stack = stack;
}

casper.on('error', function(msg, backtrace) {
  this.echo('Exception: ' + msg + backtrace);
  this.capture('./out/error.png');
  throw new CasperException(msg, backtrace);
});

casper.on('remote.message', function(msg) {
  this.echo('remote console.log:' + msg);
});

casper.start(url);

casper.then(function() {
  this.echo('Landed on page: ' + this.getTitle());
});

casper.then(function() {
  this.echo('Clicking on login button...');
  this.evaluate(function(u, p) {
    $('#j_username').val(u);
    $('#j_password').val(p);
    $('#SignIn').click();
  }, username, password);
});

casper.then(function() {
  this.echo('Waiting for checkbox...');
  this.waitForSelector('#checkMe');
});

casper.then(function() {
  this.echo('Checkbox found. Clicking on checkbox...');
  this.evaluate(function() {
    $('#checkMe').click();
  });
});

casper.then(function() {
  this.echo('Waiting on manage appointments button...');
  this.waitForSelector('input[name=manageAptm]');
});

casper.then(function() {
  this.echo('Appointments button found. Clicking on button...');
  this.evaluate(function() {
    $('input[name=manageAptm]').click();
  });
});

casper.then(function() {
  this.echo('Waiting on reschedule appointment button...');
  this.waitForSelector('input[name=reschedule]');
});

casper.then(function() {
  this.echo('Reschedule button found. Clicking on button...');
  this.evaluate(function() {
    $('input[name=reschedule]').click();
  });
});

casper.then(function() {
  this.echo('Waiting on airport dropdown...');
  this.waitForSelector('#selectedEnrollmentCenter');
});

casper.then(function() {
  this.echo('Airport dropdown found, selecting next...');
  this.evaluate(function(a) {
    $('#selectedEnrollmentCenter').val(a);
    $('input[name=next]').click();
  }, airport);
});

casper.then(function() {
  this.echo('Waiting on calendar to render...');
  this.waitForSelector('.date');
});

casper.then(function() {
  this.echo('Calendar found. Parsing date...');
  providedDay = this.evaluate(function() {
    var day = $('.date td')[0].innerHTML;
    console.log(day);
    var monthYear = $('.date div')[1].innerText;
    console.log(monthYear);
    return day + ' ' + monthYear;
  });
});

casper.then(function() {
  this.echo('Date found: ' + providedDay);

  var nextDay = new Date(providedDay);
  var today = new Date();
  console.log('Next available: ' + nextDay);
  console.log('Today: ' + today);
  var oneDay = 1000 * 60 * 60 * 24;
  var numDays = Math.ceil(
    (nextDay.getTime() - today.getTime()) / (oneDay)
  );
  this.echo('Number of days away: ' + numDays);

  if (numDays < 30) {
    notify = true;
    this.echo('New appointment slot available within a month');
  } else {
    notify = false;
    this.echo('No appointment slots available within a month');
  }
});

casper.then(function() {
  if (notify) {
    this.echo('Sending twilio request...');
    this.open(
      'https://' + accountSid + ':' + authToken + '@' +
      'api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages',
      {
        method: 'post',
        data: {
          To: toNumber,
          From: fromNumber,
          Body: 'New appointment slot open: ' + providedDay,
          MessagingServiceSid: serviceSid,
        },
      }
    ).then(function() {
      require('utils').dump(this.getPageContent());
    });
  }
});

casper.run(function() {
  this.echo('Done');
  this.exit();
});