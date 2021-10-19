const deploy = require("./deploy.js");

let idx = parseInt(process.argv[2]);
if(idx==0) deploy.prepare();
else if(idx==1) deploy.deploy();