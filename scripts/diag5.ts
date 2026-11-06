import {
  solvedCube, getURtoUL, getUBtoDF, getURtoDF, getURtoDF_standalone,
  setURtoUL, setUBtoDF, warmup,
} from '../src/solver/kociembaPure';

console.log('start');
warmup();
console.log('warmed');

const a = solvedCube();
setURtoUL(a, 0);
console.log('setURtoUL(0).ep =', JSON.stringify(a.ep));

const b = solvedCube();
setUBtoDF(b, 114);
console.log('setUBtoDF(114).ep =', JSON.stringify(b.ep));

console.log('getURtoDF(b) =', getURtoDF(b));
console.log('getURtoDF_standalone(0,114) =', getURtoDF_standalone(0, 114));
