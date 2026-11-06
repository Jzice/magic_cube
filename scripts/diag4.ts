import {
  solvedCube, applyMove, getURtoUL, getUBtoDF, getURtoDF, getURtoDF_standalone,
  MergeURtoULandUBtoDF, warmup, URtoUL_Move, UBtoDF_Move,
} from '../src/solver/kociembaPure';

warmup();

function check(c: any, label: string): void {
  const u = getURtoUL(c);
  const v = getUBtoDF(c);
  const merged = getURtoDF_standalone(u, v);
  const direct = getURtoDF(c);
  const tbl = MergeURtoULandUBtoDF[u * 336 + v];
  console.log(`${label}: u=${u} v=${v} merged=${merged} direct=${direct} tbl=${tbl} ${merged===direct?'OK':'MISMATCH'}`);
}

const c = solvedCube();
check(c, 'solved');
applyMove(c, 3); check(c, 'after R');
applyMove(c, 0); check(c, 'after R,U');
applyMove(c, 16); check(c, 'after R,U,B2');

// 校验移动表追踪一致性：用 move 表递推应等于直接读取
let rnd = 12345;
function rndMove(): number { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd % 18; }
const c2 = solvedCube();
let uT = getURtoUL(c2), vT = getUBtoDF(c2);
let mismatch = 0;
for (let i = 0; i < 200; i++) {
  const mv = rndMove();
  applyMove(c2, mv);
  const uD = getURtoUL(c2), vD = getUBtoDF(c2);
  const uM = URtoUL_Move[uT * 18 + mv], vM = UBtoDF_Move[vT * 18 + mv];
  if (uM !== uD || vM !== vD) { mismatch++; if (mismatch < 5) console.log(`mv=${mv} uM=${uM} uD=${uD} vM=${vM} vD=${vD}`); }
  uT = uM; vT = vM;
}
console.log('move-table mismatch count:', mismatch);
