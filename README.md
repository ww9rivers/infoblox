# Infoblox API

This project implements a subset of the Infoblox API via REST API using NodeJS

#### Installation

```
npm install infoblox
```

#### Usage

Example:

```javascript
const Infoblox = require('infoblox');
const config = require('./config.json');

var ipam = new Infoblox(config);
ipam.getAdminGroup().then(admGrps => {
  console.log(admGrps);
});
```
See ```examples/config.json``` for configuration for the API.

## Change Log

2021-02-26 Revised the infoblox module to use axios from using request.
