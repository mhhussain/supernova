let e =  require('express');

let configs = require('./config');
let health = require('./health');
let supernova = require('./supernova');

/// start up
let app = e();

// uses
app.use(e.json());

let h = new health(app);

new supernova(h, configs, app);

app.listen(configs.port, () => { 
    h.updateStatus({
        status: 'listening',
        msg: `listening on port [${configs.port}]`
    });
});
