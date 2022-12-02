const net = require('net');

const server = net.createServer();

const response_407 = 'HTTP/1.0 407 Proxy Authentication Required\r\n' +
    'Proxy-Authenticate: Basic realm="proxy"\r\n' +
    'Connection: close\r\n' +
    'Content-type: text/html; charset=utf-8\r\n' +
    '\r\n';

const auth = 'some_base64_login_pass';

server.on('connection', (clientToProxySocket) => {
  console.log('Client Connected To Proxy');
  // We need only the data once, the starting packet
  clientToProxySocket.once('data', (data) => {
    // If you want to see the packet uncomment below
    // console.log(data.toString());

    if (data.toString().indexOf('Proxy-Authorization: Basic') === -1) {
      console.log('Auth header not found. 407');
      clientToProxySocket.write(response_407, () => {clientToProxySocket.destroy()});
      return;
    }

    if (data.toString().split('Proxy-Authorization: Basic ')[1].split('\r\n')[0] !== auth) {
      console.log('Invalid login/password. 407');
      clientToProxySocket.write(response_407, () => {clientToProxySocket.destroy()});
      return;
    }

    let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;

    // By Default port is 80
    let serverPort = 80;
    let serverAddress;
    if (isTLSConnection) {
      // Port changed if connection is TLS
      serverPort = data.toString()
          .split('CONNECT ')[1].split(' ')[0].split(':')[1];
      serverAddress = data.toString()
          .split('CONNECT ')[1].split(' ')[0].split(':')[0];
    } else {
      serverAddress = data.toString().split('Host: ')[1].split('\r\n')[0];
    }

    console.log(serverAddress);

    let proxyToServerSocket = net.createConnection({
      host: serverAddress,
      port: serverPort
    }, () => {
      console.log('PROXY TO SERVER SET UP');
      if (isTLSConnection) {
        clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
      } else {
        proxyToServerSocket.write(data);
      }

      clientToProxySocket.pipe(proxyToServerSocket);
      proxyToServerSocket.pipe(clientToProxySocket);

    });

    proxyToServerSocket.on('error', (err) => {
      console.log('PROXY TO SERVER ERROR');
      console.log(err);
      clientToProxySocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n', () => {clientToProxySocket.destroy()});
      proxyToServerSocket.destroy();
    });

    clientToProxySocket.on('error', err => {
      console.log('CLIENT TO PROXY ERROR');
      console.log(err);
    });
  });
});

server.on('error', (err) => {
  console.log('SERVER ERROR');
  console.log(err);
  throw err;
});

server.on('close', () => {
  console.log('Client Disconnected');
});

server.listen(8124, () => {
  console.log('Server runnig at http://localhost:' + 8124);
});
