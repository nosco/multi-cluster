var MultiCluster = require('../');

console.log('STARTED!');

var multiCluster1 = new MultiCluster('worker_test1.js');
var multiCluster2 = new MultiCluster('worker_test2.js');
