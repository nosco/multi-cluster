var os = require('os');
var util = require('util');
var fs = require('fs');
var events = require('events');
var cluster = require('cluster');
cluster.setupMaster();

var MultiCluster = function(name, appPath) {
    this.workers = {};
    this.clusterName = 'unknown';

    this.appPath = String(arguments[arguments.length-1]);

    if(arguments.length < 1) {
        console.log('No app or app file not provided! Exiting...');
        process.exit(1);

    } else if(arguments.length > 1) {
        this.clusterName = name;

    } else {
        var appNameMatch = this.appPath.match(/(?:.*\/|^)([a-z0-9\-_\.]+?)(?:\.js|$)|$/i);
        if(appNameMatch[1] != undefined) {
            this.clusterName = appNameMatch[1];
        }
    }

    if(!fs.existsSync(this.appPath)) {
        console.log('error', 'App file does not exist! Exiting...');
        process.exit(1);
    }

    this.initializeCluster();
};
module.exports = MultiCluster;

MultiCluster.prototype.initializeCluster = function() {
    var numCpus = os.cpus().length;

    for(var cpu=1 ; cpu <= numCpus ; cpu++) {
        this.startWorker();
    }
};

MultiCluster.prototype.startWorker = function() {
    cluster.settings.exec = this.appPath;
    
    var worker = cluster.fork();

    var self = this;

    worker.on('disconnect', function() {
                  setTimeout(function() {
                                 try { process.kill(worker.process.pid); }
                                 catch(e) { /* just in case it exited by itself */ }
                             }, 5000);
                  self.startWorker();
              });
    //worker.on('exit', function() { });
    //worker.on('close', function() { });
}



/* Now going to do all of the main signal handling */

if(cluster.isMaster) {

    var signalHandler = function(signal, args) {
        // TODO: Implement a way to signal to the child, it should go down when done and then handle it like a disconnect
        if(signal == 'SIGHUP') {
            for(var i in cluster.workers) { process.kill(cluster.workers[i].process.pid, 'SIGHUP'); }

        } else if(signal == 'SIGTERM') {
            for(var i in cluster.workers) { process.kill(cluster.workers[i].process.pid, 'SIGTERM'); }

        } else if(signal == 'SIGKILL') {
            for(var i in cluster.workers) { process.kill(cluster.workers[i].process.pid, 'SIGKILL'); }
            process.exit(0);

        } else if(signal == 'SIGCHLD') {
            /* Don't do a thing - the worker.on('disconnect') will handle the restart */
            //console.log('SIGCHLD');

        } else {
            console.log('TERMINATING ALL');

            for(var i in cluster.workers) { process.kill(cluster.workers[i].process.pid, 'SIGTERM'); }
            process.exit(0);
        }
    }

                                                                                  // Value     Action   Comment
                                                                                  // ----------------------------------------------------------------------
    process.on('SIGHUP' , function() { signalHandler('SIGHUP' , arguments); });   //     1       Term    Hangup detected on controlling terminal or death of controlling process
    process.on('SIGINT' , function() { signalHandler('SIGINT' , arguments); });   //     2       Term    Interrupt from keyboard
    process.on('SIGQUIT', function() { signalHandler('SIGQUIT', arguments); });   //     3       Core    Quit from keyboard
    process.on('SIGILL' , function() { signalHandler('SIGILL' , arguments); });   //     4       Core    Illegal Instruction
    process.on('SIGABRT', function() { signalHandler('SIGABRT', arguments); });   //     6       Core    Abort signal from abort(3)
    process.on('SIGFPE' , function() { signalHandler('SIGFPE' , arguments); });   //     8       Core    Floating point exception
    process.on('SIGKILL', function() { signalHandler('SIGKILL', arguments); });   //     9       Term    Kill signal
    process.on('SIGSEGV', function() { signalHandler('SIGSEGV', arguments); });   //    11       Core    Invalid memory reference
    process.on('SIGPIPE', function() { signalHandler('SIGPIPE', arguments); });   //    13       Term    Broken pipe: write to pipe with no readers
    process.on('SIGALRM', function() { signalHandler('SIGALRM', arguments); });   //    14       Term    Timer signal from alarm(2)
    process.on('SIGTERM', function() { signalHandler('SIGTERM', arguments); });   //    15       Term    Termination signal
    process.on('SIGUSR1', function() { signalHandler('SIGUSR1', arguments); });   // 30,10,16    Term    User-defined signal 1
    process.on('SIGUSR2', function() { signalHandler('SIGUSR2', arguments); });   // 31,12,17    Term    User-defined signal 2
    process.on('SIGCHLD', function() { signalHandler('SIGCHLD', arguments); });   // 20,17,18    Ign     Child stopped or terminated
    process.on('SIGCONT', function() { signalHandler('SIGCONT', arguments); });   // 19,18,25    Cont    Continue if stopped
    process.on('SIGSTOP', function() { signalHandler('SIGSTOP', arguments); });   // 17,19,23    Stop    Stop process
    process.on('SIGTSTP', function() { signalHandler('SIGTSTP', arguments); });   // 18,20,24    Stop    Stop typed at tty
    process.on('SIGTTIN', function() { signalHandler('SIGTTIN', arguments); });   // 21,21,26    Stop    tty input for background process
    process.on('SIGTTOU', function() { signalHandler('SIGTTOU', arguments); });   // 22,22,27    Stop    tty output for background process

}

