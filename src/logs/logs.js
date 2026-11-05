import morgan from 'morgan';
import fs from 'fs';

const logFile = fs.createWriteStream(new URL('./access.log', import.meta.url), { flags: 'a' });

const Logger = [
  morgan('combined'),
  morgan('combined', { stream: logFile }),
];

export default Logger;