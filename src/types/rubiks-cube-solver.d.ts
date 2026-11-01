declare module 'rubiks-cube-solver' {
  type SolveResult =
    | string
    | { cross: string[]; f2l: string[]; oll: string; pll: string };
  const solver: (state: string, options?: { partitioned?: boolean }) => SolveResult;
  export default solver;
}
