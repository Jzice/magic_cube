/** 七步层先法互动教学的步骤数据（与原版一致）。 */
export interface TutorialStep {
  title: string;
  formula: string;
  desc: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { title: '① 底部白十字', formula: "R' F", desc: '找到白色棱块，先在黄色中心面拼出“小花”，再对齐侧面中心后转到底面。' },
  { title: '② 第一层角块', formula: "R U R'", desc: '白色角块白色朝右用右手公式，朝前用左手公式，重复直到四个角块归位。' },
  { title: '③ 第二层棱块', formula: "U R U' R' U' F' U F", desc: '在顶层找不含黄色的棱块，对准侧面中心形成倒 T，根据去向选择左插或右插公式。' },
  { title: '④ 顶层十字', formula: "F R U R' U' F'", desc: '观察顶层黄色棱块分布：点 → 拐 → 线 → 十字，每次做一遍公式直到出现十字。' },
  { title: '⑤ 顶面颜色', formula: "R U R' U R U2 R'", desc: '把黄色角块转到朝上的位置。每次只关注一个角块，做完公式后用 U 调整顶层继续。' },
  { title: '⑥ 顶层角块归位', formula: "U R U' L' U R' U' L", desc: '找到一个已归位的角块放在正确位置，执行公式调整其余三个角块。' },
  { title: '⑦ 顶层棱块归位', formula: "F2 U L R' F2 L' R U F2", desc: '最后一步：将顶层棱块归位。根据三棱/四棱交换情况执行一次或两次即可完成。' },
];
