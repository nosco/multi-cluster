# multi-cluster

Create robust node.js applications with automatic forking of multiple processes and multiple apps, signal handling and reforking.


### This is an early BETA version

The thoughts and techniques behind this module, has been derived from live systems running incredibly stabile!
That said, this is not code tested on live systems (yet).

As soon as the module has shown it's worth and stability on a live system, it will be marked as version >= 1.0.0.

Until then: Feel free to play around with it, learn from it.


### To install

	npm install multi-cluster

# The thoughts behind

Basically the module will enable you to seperate your app code from cluster and signal handling code.
You can start 1 or many apps with a single script.
The module will keep track on which processes (app childs) dies, which to restart and enables you to live reload all apps at once.

### You don't need to change a single line of code

The architecture of this module simplifies development by seperating everything completely!
You can write your app as if it should run by itself, without signal handling and clustering.

**Once you want to put it live, you can just write a start script like this:**

	var MultiCluster = require('multi-cluster');
	var multiCluster = new MultiCluster('myapp.js');

That's it!

--

**If you want to automate 3 more apps, it will look something like this:**


	var MultiCluster = require('multi-cluster');
	var multiCluster = new MultiCluster('myapp.js');
	var multiCluster = new MultiCluster('my_second_app.js');
	var multiCluster = new MultiCluster('my_third_app.js');
	var multiCluster = new MultiCluster('my_fourth_app.js');

Can it get any simpler?

