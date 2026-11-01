import { TUTORIAL_STEPS } from '../config/tutorialConfig';
import { executeFormula } from '../core/notation';

/** 渲染七步层先法互动教学面板。 */
export function buildTutorialSteps(): void {
  const container = document.getElementById('tutorialContent');
  if (!container) return;
  container.innerHTML = '';

  const tokenRegex = /([RLUDFB])(['2]?)/g;

  TUTORIAL_STEPS.forEach((step) => {
    const div = document.createElement('div');
    div.className = 'step';

    let match: RegExpExecArray | null;
    let formulaHtml = '';
    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(step.formula)) !== null) {
      formulaHtml += `<span class="move-token" title="点击演示单步">${match[0]}</span>`;
    }

    div.innerHTML = `
      <div class="title">${step.title}</div>
      <div class="desc">${step.desc}</div>
      <div class="formula-container">${formulaHtml}</div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="play-btn" data-formula="${step.formula}">▶ 一键演示</button>
      </div>
    `;

    div.querySelectorAll('.move-token').forEach((token) => {
      token.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('#tutorial .step').forEach((s) => s.classList.remove('active'));
        div.classList.add('active');
        void executeFormula(token.textContent ?? '', true);
      });
    });

    const playBtn = div.querySelector('.play-btn');
    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('#tutorial .step').forEach((s) => s.classList.remove('active'));
      div.classList.add('active');
      void executeFormula(step.formula);
    });

    container.appendChild(div);
  });
}

/** 开/关教学面板并联动 #app/#topbar/#bottombar 的 with-panel 布局。 */
export function toggleTutorial(): void {
  const tutorial = document.getElementById('tutorial');
  const app = document.getElementById('app');
  const topbar = document.getElementById('topbar');
  const bottombar = document.getElementById('bottombar');
  if (!tutorial || !app || !topbar || !bottombar) return;

  const isOpen = tutorial.classList.toggle('open');

  if (isOpen) {
    app.classList.add('with-panel');
    topbar.classList.add('with-panel');
    bottombar.classList.add('with-panel');
  } else {
    app.classList.remove('with-panel');
    topbar.classList.remove('with-panel');
    bottombar.classList.remove('with-panel');
  }
}
