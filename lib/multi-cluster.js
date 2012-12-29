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

    process.on('SIGHUP', function() { signalHandler('SIGHUP', arguments); });
}

