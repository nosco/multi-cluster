var os = require('os');
var fs = require('fs');
var util = require('util');
var cluster = require('cluster');

var statsTimer = undefined;
var statsReportTimer = undefined;
var workerPidToId = {};

/**
 * childs and usageReport are both optional
 */
var MultiCluster = function(appPath, childs, usageReport) {
  // Time (ms) before killing child processes, that sends a disconnect message
  this.killWait = 5000;
  // Time in ms between requesting stats from child processes
  this.statsInterval = 5000;
  // Time in ms between reporting stats
  this.statsReportInterval = 5000;
  // File watch timer - the grace period between first change till next, before
  // assuming a restart is necessary
  // This is important, since it's possible to get 2 events per change
  this.watchTimer = 5000;
  // If the worker was restarted in less than defaultGracePeriod time ago, a
  // slowdown is initiated, making sure we don't wildly restart a faulty worker
  this.defaultGracePeriod = 2000;

  usageReport = usageReport || false;

  if (arguments.length === 2) {
    if (typeof arguments[1] === 'boolean') {
      usageReport = arguments[1];
      childs = undefined;
    }
  }

  this.watchReloadInProgress = false;

  cluster.setupMaster();

  this.childs = childs || os.cpus().length;

  this.workers = {};

  this.appPath = String(appPath);

  if (arguments.length < 1) {
    console.log('No app or app file not provided! Exiting...');
    process.exit(1);
  }

  if (!fs.existsSync(this.appPath)) {
    console.log('error', 'App file "' + this.appPath + '" does not exist! Exiting...');
    process.exit(1);
  }

  for (var cpu = 1; cpu <= this.childs; cpu++) {
    this.startWorker(cpu);
  }

  // Start up the stats request timer
  if (statsTimer == undefined) {
    statsTimer = setInterval(this.requestStats, this.statsInterval);

    if (usageReport) {
      setInterval(function() {
        console.log(util.inspect(MultiCluster.aggregateStats().aggregated, {
          depth: 10
        }));
      }, this.statsReportInterval);
    }
  }

  // We really don't want the main process to go down
  process.on('uncaughtException', function(err) {
    console.log('Error from MultiCluster:', err);
  });

};
module.exports = MultiCluster;


/** Initialize a worker and start listening for events from it */
MultiCluster.prototype.startWorker = function(workerId, gracePeriod) {
  var self = this;
  gracePeriod = gracePeriod || this.defaultGracePeriod;

  cluster.settings.exec = this.appPath;

  var worker = cluster.fork({
    WORKER: workerId
  });
  worker.last_start = new Date().getTime();
  worker.restart_grace_period = gracePeriod;

  this.workers[worker.process.pid] = worker.id;
  workerPidToId[worker.process.pid] = worker.id;

  worker.on('disconnect', function() {
    delete self.workers[worker.process.pid];
    delete workerPidToId[worker.process.pid];

    setTimeout(function() {
      if (worker.state !== 'dead') {
        try {
          worker.kill();
        } catch ( e ) {
          /* in case it exited by itself */
        }
      }
      delete worker;
    }, self.killWait);

    if (!worker.suicide || worker.restart) {
      var timeSinceLastStart = (new Date().getTime() - worker.last_start);

      // Check if a slowdown of restarts are needed
      if (timeSinceLastStart < worker.restart_grace_period) {
        worker.restart_grace_period = worker.restart_grace_period * 2;

        // Make sure we don't wait to long
        if (worker.restart_grace_period > 30000) {
          worker.restart_grace_period = 30000;
        }

        setTimeout(function() {
          self.startWorker(workerId, gracePeriod);
        }, gracePeriod);

      } else {
        // Reset the grace period
        worker.restart_grace_period = self.defaultGracePeriod;
        self.startWorker(workerId);
      }
    }
  });

  worker.on('message', this.messageHandler);
};

MultiCluster.prototype.messageHandler = function(msg) {
  if (msg.cmd && (msg.cmd == 'stats')) {
    var workerId = workerPidToId[msg.data.pid];
    cluster.workers[workerId].stats = msg.data;
  }
  if (msg.broadcast) {
    for (var id in cluster.workers) {
      cluster.workers[id].send(msg);
    }
  }
};

MultiCluster.prototype.requestStats = function() {
  for (var id in cluster.workers) {
    cluster.workers[id].send({
      cmd: 'send stats'
    });
  }
};

MultiCluster.prototype.watch = function(watchPath, ignorePathsRegexp) {
  var self = this;

  ignorePathsRegexp = ignorePathsRegexp || /^(\.|node_modules|test|log)/;

  if (!fs.existsSync(watchPath)) {
    console.log('error', 'The requested path to watch does not exist! Exiting...');
    process.exit(1);
  }

  var watchPaths = [watchPath];

  if (fs.statSync(watchPath).isDirectory()) {
    watchPaths = watchPaths.concat(this.getAllDirsSync(watchPath, ignorePathsRegexp));
  }

  for (var i in watchPaths) {

    fs.watch(watchPaths[i], function(event, filename) {
      if ((event === 'change') && (self.watchReloadInProgress === false)) {
        self.watchReloadInProgress = true;

        // Use a timer, to ensure we don't try to startup with a half-written file
        setTimeout(function() {
          for (var id in cluster.workers) {
            if (self.workers[cluster.workers[id].process.pid] != null) {
              cluster.workers[id].restart = true;
              cluster.workers[id].disconnect();
            }
          }
        }, 1000);

        setTimeout(function() {
          self.watchReloadInProgress = false
        }, self.watchTimer);
      }

    });

  }

};

MultiCluster.prototype.getAllDirsSync = function(startPath, ignorePathsRegexp) {
  var allDirs = [];

  if (startPath !== undefined) {
    var paths = fs.readdirSync(startPath);

    for (var i in paths) {

      if (ignorePathsRegexp.test(paths[i]) === false) {
        var curPath = startPath + '/' + paths[i];

        if (fs.statSync(curPath).isDirectory()) {
          allDirs.push(curPath);
          allDirs = allDirs.concat(this.getAllDirsSync(curPath, ignorePathsRegexp));
        }
      }
    }
  }
  return allDirs;
};


var aggregateStats = function(callback) {
  var masterMem = process.memoryUsage();

  var stats = {
    all: {},
    perApp: {},
    aggregated: {}
  };

  stats.aggregated = {
    loadavg: os.loadavg(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    usedmem: (os.totalmem() - os.freemem()),
    cpus: os.cpus().length,
    processes: 1,
    workers: 0,
    rss: masterMem.rss,
    heapTotal: masterMem.heapTotal,
    heapUsed: masterMem.heapUsed
  };

  stats.perApp[process.argv[1]] = util._extend({
    workers: 1
  }, process.memoryUsage());

  for (var id in cluster.workers) {
    stats.aggregated.processes++;

    if (cluster.workers[id].stats != undefined) {
      var workerStats = cluster.workers[id].stats;

      stats.all[workerStats.pid] = workerStats;

      if (stats.perApp[workerStats.filename] == undefined) {
        stats.perApp[workerStats.filename] = {
          workers: 0,
          rss: 0,
          heapTotal: 0,
          heapUsed: 0
        };
      }

      stats.perApp[workerStats.filename].workers++;
      stats.perApp[workerStats.filename].rss += workerStats.memory.rss;
      stats.perApp[workerStats.filename].heapTotal += workerStats.memory.heapTotal;
      stats.perApp[workerStats.filename].heapUsed += workerStats.memory.heapUsed;

      stats.aggregated.workers++;
      stats.aggregated.rss += workerStats.memory.rss;
      stats.aggregated.heapTotal += workerStats.memory.heapTotal;
      stats.aggregated.heapUsed += workerStats.memory.heapUsed;
    }
  }

  if (callback != undefined) {
    callback(stats);
  } else {
    return stats;
  }
};
MultiCluster.aggregateStats = aggregateStats;


if (process.env.WORKER && (process.env.WORKER == 1)) {
  process.on('message', function(msg) {
    if (msg.cmd && (msg.cmd == 'send stats')) {
      process.send({
        cmd: 'stats',
        data: {
          memory: process.memoryUsage(),
          pid: process.pid,
          uptime: process.uptime(),
          filename: process.argv[1]
        }
      });
    }
  });

} else {

  /**
   * Signal handling
   */
  var signalHandler = function(signal, args) {
    console.log('GOT SIGNAL:', signal);
    if (signal == 'SIGHUP') {
      for (var i in cluster.workers) {
        cluster.workers[i].disconnect();
      }

    } else {
      console.log('TERMINATING ALL');

      for (var i in cluster.workers) {
        cluster.workers[i].kill();
      }
      process.exit(0);
    }
  };

  process.on('SIGHUP', function() {
    signalHandler('SIGHUP', arguments);
  });
  process.on('SIGINT', function() {
    signalHandler('SIGINT', arguments);
  });
  process.on('SIGQUIT', function() {
    signalHandler('SIGQUIT', arguments);
  });
  process.on('SIGTERM', function() {
    signalHandler('SIGTERM', arguments);
  });
  // We know this through the disconnect message:
  // process.on('SIGCHLD', function() { signalHandler('SIGCHLD', arguments); });
}


/**
 * A description of the signals and their values
 *
 * POSIX.1-1990
 *
 * Signal       Value    Action   Comment
 * -----------------------------------------------------
 * SIGHUP         1       Term    Hangup detected on controlling terminal
 *                                or death of controlling process
 * SIGINT         2       Term    Interrupt from keyboard
 * SIGQUIT        3       Core    Quit from keyboard
 * SIGILL         4       Core    Illegal Instruction
 * SIGABRT        6       Core    Abort signal from abort(3)
 * SIGFPE         8       Core    Floating point exception
 * SIGKILL        9       Term    Kill signal
 * SIGSEGV       11       Core    Invalid memory reference
 * SIGPIPE       13       Term    Broken pipe: write to pipe with no readers
 * SIGALRM       14       Term    Timer signal from alarm(2)
 * SIGTERM       15       Term    Termination signal
 * SIGUSR1    30,10,16    Term    User-defined signal 1
 * SIGUSR2    31,12,17    Term    User-defined signal 2
 * SIGCHLD    20,17,18    Ign     Child stopped or terminated
 * SIGCONT    19,18,25    Cont    Continue if stopped
 * SIGSTOP    17,19,23    Stop    Stop process
 * SIGTSTP    18,20,24    Stop    Stop typed at tty
 * SIGTTIN    21,21,26    Stop    tty input for background process
 * SIGTTOU    22,22,27    Stop    tty output for background process
 *
 *
 * POSIX.1-2001 (SUSv2)
 *
 * Signal      Value     Action   Comment
 * -------------------------------------------------------------------------
 * SIGBUS     10,7,10     Core    Bus error (bad memory access)
 * SIGPOLL                Term    Pollable event (Sys V). Synonym of SIGIO
 * SIGPROF    27,27,29    Term    Profiling timer expired
 * SIGSYS     12,-,12     Core    Bad argument to routine (SVr4)
 * SIGTRAP       5        Core    Trace/breakpoint trap
 * SIGURG     16,23,21    Ign     Urgent condition on socket (4.2BSD)
 * SIGVTALRM  26,26,28    Term    Virtual alarm clock (4.2BSD)
 * SIGXCPU    24,24,30    Core    CPU time limit exceeded (4.2BSD)
 * SIGXFSZ    25,25,31    Core    File size limit exceeded (4.2BSD)
 */
