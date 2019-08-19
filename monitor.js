let tk = require('terminal-kit').terminal;
let axios = require('axios');

let configs = {
    sunova: 'http://localhost',
    partacc: 'http://partacc',
    blackhole: 'http://blackhole'
}

let sunovahealth = '';
let sunovaout = 0;
let sunovain = 0;
let sunovaerror = 0;

let partacchealth = '';
let partacccount = 0;

let blackholehealth = '';
let blackholevain = 0;

setInterval(() => {
    // sunova
    axios.get(`${configs.sunova}/health`).then((res) => {
        sunovahealth = res.data.status;
    }).catch((err) => { sunovahealth = 'dead'; });
    axios.get(`${configs.sunova}/status/ptout`).then((res) => {
        sunovaout = res.data;
    }).catch((err) => {});
    axios.get(`${configs.sunova}/status/ptin`).then((res) => {
        sunovain = res.data;
    }).catch((err) => {});
    axios.get(`${configs.sunova}/status/errors`).then((res) => {
        sunovaerror = res.data;
    }).catch((err) => {});

    // partacc
    axios.get(`${configs.partacc}/health`).then((res) => {
        partacchealth = res.data.status;
    }).catch((err) => { partacchealth = 'dead'; });
    axios.get(`${configs.partacc}/status/rcount`).then((res) => {
        partacccount = res.data;
    }).catch((err) => {});

    // blackhole
    axios.get(`${configs.blackhole}/health`).then((res) => {
        blackholehealth = res.data.status;
    }).catch((err) => { blackholehealth = 'dead'; });
    axios.get(`${configs.blackhole}/status/ptin`).then((res) => {
        blackholevain = res.data;
    }).catch((err) => {});

}, 1000)

setInterval(() => {
    tk.clear();

    tk.moveTo(2, 2, '*** supernova -> blackhole monitor ***\n');
    tk.moveTo(2, 3, `sunova: [${sunovain}/${sunovaout}/${sunovaerror}] - ${sunovahealth}`);
    tk.moveTo(2, 4, `partacc: ${partacchealth} - ${partacccount}`);
    tk.moveTo(2, 5, `blackhole: [${blackholevain}] - ${blackholehealth}`);


    tk.moveTo(2, 6, `[`);
    for (var i = 0; i < sunovain/sunovaout * 10; i++) {
        tk.moveTo(i+4, 6, '*');
    }
    tk.moveTo(15, 6, ']' + ` -- ${sunovain/sunovaout * 100} %`);

    tk.moveTo(2, 9, '\n')
    
    
}, 1000)
