/** cubejs@1.3.2：Kociemba 两阶段算法的纯 JS 实现（无类型声明，此处按项目用到的 API 声明）。 */
declare module 'cubejs' {
  export interface CubeInstance {
    /** 返回标准记号解法，如 "R U' F2"；无解时可能返回空串。 */
    solve(maxDepth?: number): string;
  }

  export interface CubeConstructor {
    new (state?: unknown): CubeInstance;
    /** 由 54 字符面片串（U,R,F,D,L,B 顺序）构造。 */
    fromString(facelets: string): CubeInstance;
    /** 预计算移动表与剪枝表，首次求解前必须调用一次。 */
    initSolver(): void;
  }

  const Cube: CubeConstructor;
  export default Cube;
}
