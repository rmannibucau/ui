const fs = require('fs');

const pck = require('../package.json');
const content = fs.readFileSync('./pom.xml').toString();
fs.writeFileSync('./pom.xml', content.replace(/<version>[^<]+<\/version>/, `<version>${pck.version}</version>`));

