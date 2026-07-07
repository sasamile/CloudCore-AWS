const fs = require('fs');
const path = require('path');

const shim = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
`;

const targets = [
  path.join(__dirname, '../src/generated/prisma/enums.js'),
  path.join(__dirname, '../dist/generated/prisma/enums.js'),
];

for (const file of targets) {
  const dir = path.dirname(file);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(file, shim);
  }
}
