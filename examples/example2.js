var MultiCluster = require('../');

console.log('STARTED!');

var multiCluster1 = new MultiCluster('worker_example1.js');
var multiCluster2 = new MultiCluster('worker_example3.js');
