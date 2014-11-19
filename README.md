[![NPM version](https://badge.fury.io/js/block-scope.png)](http://badge.fury.io/js/multi-cluster)

# multi-cluster

> **NOTICE**: Stats has been removed and can now be found in a seperate module: [stats-server](http://npmjs.org/package/stats-server)

Create robust node.js applications with automatic forking of multiple processes and multiple apps, signal handling and reforking.

All in a couple of lines and without changing your existing code!

>CAUTION:
>
>The watch feature can cause problems under certain versions of node.js.
>
>Make sure to test it with the node.js version and the OS you intend to use it under.
>
>What to look for when testing:
>When a file changes, the main process will die and throw this error: Bus error 10
>
>Known problem versions are: 0.10.17 - 0.10.20 both included.
>Version 0.10.21 are known to work.
>UPDATE: package.json updated to reflect the need for node 0.10.21
>
>You really shouldn't use watchers on live systems!
>At least not for systems that has a lot of file updates.

### This is an early BETA version

The thoughts and techniques behind this module, has been derived from live systems running incredibly stabile!
That said, this is not code tested on live systems (yet).

As soon as the module has shown it's worth and stability on a live system, it will be marked as version >= 1.0.0.

Until then: Feel free to play around with it, learn from it.


### To install

	npm install multi-cluster



### Possible pitfall

You can NOT run 2 different applications, that both starts an HTTP (or TCP) server and tries to listen on the same port!!!

This would not fail when trying - just give you some weird results!

The reason for this lies in the node.js cluster handler, which CAN split incoming requests between processes, but can't know, which application should get which requests.

This will of course result in unwanted results, where you will see all requests being handled by one app and suddenly shift to the other app.


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
	var multiCluster1 = new MultiCluster('myapp.js');
	var multiCluster2 = new MultiCluster('my_second_app.js');
	var multiCluster3 = new MultiCluster('my_third_app.js');

	// The second argument with a value of 10 is the amount of children to start
	// Default is to start as many children as there is CPUs
	var multiCluster4 = new MultiCluster('my_fourth_app.js', 10);

Can it get any simpler?


# Reload on file change

This is a simple implementation for now.

The following will look for file changes in the current working dir and reload the child processes. It will wait for up to 5 secs, for all connections to close properly.

	var MultiCluster = require('multi-cluster');
	var multiCluster = new MultiCluster('myapp.js');
	multiCluster.watch(__dirname);


# Resource usage info

If you want the library to gather information about resource usage, you just need to include the multi-cluster lib for each app, you want info from.

I.e. in myapp.js add this line:

	var MultiCluster = require('multi-cluster');
