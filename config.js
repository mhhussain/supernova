let configs = {
    port: 80,
    novaurl: `http://${process.env.SUNOVA_SERVICE_HOST}`,
    particleaccelerator: `http://${process.env.PARTACC_SERVICE_HOST}/outbox`
};

module.exports = configs;
