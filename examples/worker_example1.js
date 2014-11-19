var http = require('http');
console.log('Hellooo... I\'m da first worker bee.');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  for(i=0 ; i < 100000000 ; i++) {
    var tmpvar = i;
  }
  setTimeout(function() { res.end('Hello World from pid '+process.pid+'\n'); }, 2000);
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
