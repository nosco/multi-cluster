var http = require('http');
console.log('Hellooo... I\'m da third worker bee.');
http.createServer(function (req, res) {
                      res.writeHead(200, {'Content-Type': 'text/plain'});
                      res.end('Hello Third World from pid '+process.pid+'\n');
                  }).listen(1338, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1338/');
