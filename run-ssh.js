const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected!');
  conn.exec('cd /opt/tmfood && docker-compose restart backend && sleep 8 && curl -s -H "Host: api.116.118.22.122.nip.io" http://localhost/api/v1/categories', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Exit code:', code);
      conn.end();
    }).on('data', (data) => console.log('' + data))
      .stderr.on('data', (data) => console.log('STDERR: ' + data));
  });
}).connect({
  host: '116.118.22.122',
  port: 22,
  username: 'root',
  password: 'X#pC1IX@e8s2!d'
});
