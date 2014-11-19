var MultiCluster = require('../');

console.log('STARTING!');

var multiCluster1 = new MultiCluster('worker_example1.js');
var multiCluster2 = new MultiCluster('worker_example2.js');
